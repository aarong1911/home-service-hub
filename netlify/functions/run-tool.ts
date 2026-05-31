/// <reference types="node" />
/**
 * run-tool.ts
 * Netlify Function — runs an AI tool on demand.
 *
 * POST { toolDefinitionId, orgId, userId, input }
 * Returns { output, sections? }
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { seedAiCenter } from "../../supabase/seed-ai-center";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method Not Allowed" }) };

  let body: {
    toolDefinitionId: string;
    orgId: string;
    userId?: string;
    input: Record<string, string>;
  };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { toolDefinitionId, orgId, userId, input = {} } = body;
  if (!toolDefinitionId || !orgId)
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "toolDefinitionId and orgId required" }) };

  // Seed on first run if needed
  await seedAiCenter().catch(() => {});

  // 1. Load tool definition
  const { data: tool } = await supabase
    .from("tool_definitions")
    .select("*")
    .eq("id", toolDefinitionId)
    .maybeSingle();

  if (!tool)
    return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: "Tool definition not found" }) };

  try {
    // 2. Fetch any real data the tool needs
    const contextData = await fetchToolContext(tool, orgId, input);

    // 3. Build the user prompt
    const userPrompt = buildToolPrompt(tool, input, contextData);

    // 4. Call Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: tool.model ?? "claude-haiku-4-5",
        max_tokens: 4096,
        system: tool.system_prompt ?? "You are a helpful AI assistant.",
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const claudeData = await claudeRes.json() as any;

    if (!claudeRes.ok) {
      console.error("[run-tool] Claude error:", claudeData);
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "Claude API error" }) };
    }

    const rawOutput: string = claudeData.content?.[0]?.text ?? "";
    const tokensUsed = (claudeData.usage?.input_tokens ?? 0) + (claudeData.usage?.output_tokens ?? 0);
    const costUsd = tool.model?.includes("sonnet")
      ? ((claudeData.usage?.input_tokens ?? 0) / 1_000_000) * 3 +
        ((claudeData.usage?.output_tokens ?? 0) / 1_000_000) * 15
      : (tokensUsed / 1_000_000) * 0.25;

    // 5. Parse and format the output
    const { output, sections } = formatOutput(tool, rawOutput);

    // 6. Insert tool_run record
    await supabase.from("tool_runs").insert({
      org_id: orgId,
      tool_definition_id: toolDefinitionId,
      user_id: userId ?? null,
      input,
      output: rawOutput,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
    });

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ output, sections }),
    };
  } catch (err: any) {
    console.error("[run-tool] error:", err);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: err.message ?? "Tool execution failed" }),
    };
  }
};

// ── Context fetching ─────────────────────────────────────────────────────────

async function fetchToolContext(
  tool: any,
  orgId: string,
  input: Record<string, string>,
): Promise<Record<string, any>> {
  const ctx: Record<string, any> = {};

  // Proposal Writer: fetch org info for branding
  if (tool.name === "Proposal Writer") {
    const { data: org } = await supabase
      .from("organizations")
      .select("name, phone, address, website")
      .eq("id", orgId)
      .maybeSingle();
    if (org) ctx.org = org;
  }

  // AI Insights: auto-fetch business stats
  if (tool.name === "AI Insights") {
    const days = parseInt(input.date_range ?? "30", 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [leadsRes, projectsRes, invoicesRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id, status, source, created_at, score")
        .eq("org_id", orgId)
        .gte("created_at", since),
      supabase
        .from("projects")
        .select("id, status, completion_percentage, budget_total")
        .eq("org_id", orgId)
        .gte("created_at", since),
      supabase
        .from("invoices")
        .select("id, status, total_amount, amount_paid, due_date")
        .eq("org_id", orgId)
        .gte("created_at", since),
    ]);

    const leads = leadsRes.data ?? [];
    const projects = projectsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];

    // Compute aggregates
    const totalLeads = leads.length;
    const convertedLeads = leads.filter((l: any) => l.status === "won").length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    const sourceCounts: Record<string, number> = {};
    leads.forEach((l: any) => {
      if (l.source) sourceCounts[l.source] = (sourceCounts[l.source] ?? 0) + 1;
    });
    const topSources = Object.entries(sourceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([source, count]) => ({ source, count }));

    const totalInvoiced = invoices.reduce((s: number, i: any) => s + (Number(i.total_amount) || 0), 0);
    const totalCollected = invoices.reduce((s: number, i: any) => s + (Number(i.amount_paid) || 0), 0);
    const outstanding = totalInvoiced - totalCollected;
    const overdueInvoices = invoices.filter((i: any) => i.status === "overdue");

    const avgCompletion =
      projects.length > 0
        ? Math.round(projects.reduce((s: number, p: any) => s + (Number(p.completion_percentage) || 0), 0) / projects.length)
        : 0;

    const projectsByStatus: Record<string, number> = {};
    projects.forEach((p: any) => {
      if (p.status) projectsByStatus[p.status] = (projectsByStatus[p.status] ?? 0) + 1;
    });

    ctx.businessData = {
      period_days: days,
      leads: { total: totalLeads, converted: convertedLeads, conversion_rate_pct: conversionRate, top_sources: topSources },
      projects: {
        total: projects.length,
        by_status: projectsByStatus,
        avg_completion_pct: avgCompletion,
        total_budget: projects.reduce((s: number, p: any) => s + (Number(p.budget_total) || 0), 0),
      },
      invoices: {
        total_invoiced: totalInvoiced,
        total_collected: totalCollected,
        outstanding,
        overdue_count: overdueInvoices.length,
        collection_rate_pct: totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0,
      },
    };
  }

  return ctx;
}

function buildToolPrompt(
  tool: any,
  input: Record<string, string>,
  ctx: Record<string, any>,
): string {
  const parts: string[] = [];

  // Add context data
  if (ctx.org) {
    const org = ctx.org as any;
    parts.push(
      `Company: ${org.name ?? "Unknown"}\nPhone: ${org.phone ?? ""}\nAddress: ${org.address ?? ""}`,
    );
  }

  if (ctx.businessData) {
    parts.push(
      `Business data for last ${ctx.businessData.period_days} days:\n${JSON.stringify(ctx.businessData, null, 2)}`,
    );
  }

  // Add user inputs
  const inputLines = Object.entries(input)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}: ${v}`);
  if (inputLines.length > 0) parts.push(inputLines.join("\n"));

  // For Proposal Writer, substitute org placeholders
  if (ctx.org && tool.name === "Proposal Writer") {
    const prompt = parts.join("\n\n");
    return prompt
      .replace(/{ORG_NAME}/g, (ctx.org as any).name ?? "")
      .replace(/{ORG_PHONE}/g, (ctx.org as any).phone ?? "")
      .replace(/{ORG_ADDRESS}/g, (ctx.org as any).address ?? "");
  }

  return parts.join("\n\n");
}

// ── Output formatting ─────────────────────────────────────────────────────────

function formatOutput(
  tool: any,
  rawText: string,
): { output: string; sections: Record<string, string> } {
  // For Proposal Writer — plain prose, split by numbered headings
  if (tool.name === "Proposal Writer") {
    const sections: Record<string, string> = {};
    const headingRegex = /^#+\s+(.+)$|^\d+\.\s+(.+)$/gm;
    const parts = rawText.split(headingRegex).filter(Boolean);

    if (parts.length > 1) {
      for (let i = 0; i < parts.length - 1; i += 2) {
        const heading = parts[i]?.trim();
        const content = parts[i + 1]?.trim() ?? "";
        if (heading) sections[heading] = content;
      }
    }

    if (Object.keys(sections).length === 0) {
      sections["Proposal"] = rawText.trim();
    }
    return { output: rawText, sections };
  }

  // For JSON-output tools — parse and format each top-level key as a section
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    const sections: Record<string, string> = {};

    if (Array.isArray(parsed)) {
      // Task Extractor returns an array
      sections["Extracted Tasks"] = parsed
        .map((t: any, i: number) =>
          `${i + 1}. [${t.priority?.toUpperCase() ?? "MEDIUM"}] ${t.title}${t.assignee_hint ? ` → ${t.assignee_hint}` : ""}${t.due_date_hint ? ` (${t.due_date_hint})` : ""}${t.context ? `\n   ${t.context}` : ""}`,
        )
        .join("\n");
    } else {
      // CRM Update, Conversation Summary, AI Insights
      for (const [key, value] of Object.entries(parsed)) {
        const label = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        if (Array.isArray(value)) {
          if (value.length === 0) continue;
          if (typeof value[0] === "string") {
            sections[label] = value.map((s: string) => `• ${s}`).join("\n");
          } else {
            sections[label] = value
              .map((item: any) => {
                if (item.title && item.description) return `**${item.title}**\n${item.description}`;
                if (item.task) return `• ${item.task}${item.owner ? ` (${item.owner})` : ""}${item.due ? ` — ${item.due}` : ""}`;
                if (item.action) return `• [${item.priority?.toUpperCase() ?? "MED"}] ${item.action} — ${item.estimated_impact ?? ""}`;
                if (item.source) return `• ${item.source}: ${item.count}`;
                return `• ${JSON.stringify(item)}`;
              })
              .join("\n");
          }
        } else if (typeof value === "object" && value !== null) {
          sections[label] = Object.entries(value)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n");
        } else {
          sections[label] = String(value);
        }
      }
    }

    if (Object.keys(sections).length === 0) {
      sections["Output"] = rawText.trim();
    }
    return { output: rawText, sections };
  } catch {
    return { output: rawText, sections: { Output: rawText.trim() } };
  }
}
