/// <reference types="node" />
// netlify/functions/portal-action.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const handler: Handler = async (event) => {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

  let body: { token: string; action: string; payload?: any };
  try { body = JSON.parse(event.body ?? "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { token, action, payload } = body;
  if (!token || !action) return { statusCode: 400, headers, body: JSON.stringify({ error: "token and action required" }) };

  // Validate token
  const { data: inv } = await supabaseAdmin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .in("status", ["pending", "roster_only", "accepted"])
    .maybeSingle();

  if (!inv || inv.role !== "viewer")
    return { statusCode: 403, headers, body: JSON.stringify({ error: "Access denied" }) };

  // ── send_message ──────────────────────────────────────────────────────────
  if (action === "send_message") {
    const { projectId, message } = payload ?? {};
    if (!projectId || !message?.trim())
      return { statusCode: 400, headers, body: JSON.stringify({ error: "projectId and message required" }) };

    const clientName = inv.first_name
      ? `${inv.first_name} ${inv.last_name || ""}`.trim()
      : inv.email;

    const { error } = await supabaseAdmin.from("project_notes").insert({
      project_id:        projectId,
      body:              message.trim(),
      author:            clientName,
      is_client_message: true,
      client_email:      inv.email,
    });

    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  }

  // ── approve_estimate ──────────────────────────────────────────────────────
  if (action === "approve_estimate") {
    const { estimateId } = payload ?? {};
    if (!estimateId)
      return { statusCode: 400, headers, body: JSON.stringify({ error: "estimateId required" }) };

    const { error } = await supabaseAdmin
      .from("estimates")
      .update({ status: "accepted", esign_status: "signed", signed_at: new Date().toISOString() })
      .eq("id", estimateId);

    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  }

  // ── request_payment (marks invoice as payment requested by client) ─────────
  if (action === "pay_invoice") {
    const { invoiceId } = payload ?? {};
    if (!invoiceId)
      return { statusCode: 400, headers, body: JSON.stringify({ error: "invoiceId required" }) };

    // We don't process actual payments — mark as client acknowledged and notify
    // contractor. A Stripe integration can be layered on later.
    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("project_id, invoice_number, total_amount")
      .eq("id", invoiceId)
      .maybeSingle();

    if (!invoice) return { statusCode: 404, headers, body: JSON.stringify({ error: "Invoice not found" }) };

    // Leave a note on the project so contractor is notified
    const clientName = inv.first_name
      ? `${inv.first_name} ${inv.last_name || ""}`.trim()
      : inv.email;

    await supabaseAdmin.from("project_notes").insert({
      project_id:        invoice.project_id,
      body:              `${clientName} has requested to pay invoice #${invoice.invoice_number} ($${Number(invoice.total_amount).toLocaleString()}). Please follow up to process payment.`,
      author:            "Portal",
      is_client_message: true,
      client_email:      inv.email,
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: "Payment request sent to contractor" }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
};
