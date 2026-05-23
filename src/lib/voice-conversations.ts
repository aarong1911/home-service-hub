// src/lib/voice-conversations.ts
// Fetches voice_calls from Supabase and maps them to Conversation/Message
// types so they appear in the Inbox under the Voice channel filter.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Conversation, Message } from "@/lib/mock-data";

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.organization_id) return profile.organization_id;
  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("member_id", user.id)
    .maybeSingle();
  return membership?.org_id ?? null;
}

function formatTranscriptPreview(transcript: any): string {
  if (!transcript) return "Voice call — no transcript";
  if (typeof transcript === "string") return transcript.slice(0, 80) + "…";
  if (Array.isArray(transcript)) {
    const lastMsg = [...transcript]
      .reverse()
      .find((m: any) => m.role && m.message);
    if (lastMsg) {
      const role = lastMsg.role === "assistant" ? "Agent" : "Caller";
      return `${role}: ${lastMsg.message.slice(0, 70)}…`;
    }
  }
  return "Voice call";
}

export function useVoiceConversations(): {
  conversations: Conversation[];
  messages: Message[];
  loading: boolean;
} {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const orgId = await getOrgId();
    if (!orgId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("voice_calls")
      .select(`
        id,
        vapi_call_id,
        started_at,
        ended_at,
        caller_number,
        direction,
        duration_sec,
        status,
        summary,
        transcript,
        contact_id,
        voice_agents ( name )
      `)
      .eq("tenant_id", orgId)
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[voice-conversations] fetch failed:", error);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setConversations([]);
      setMessages([]);
      setLoading(false);
      return;
    }

    // Batch-fetch contact names
    const contactIds = data
      .map((r: any) => r.contact_id)
      .filter(Boolean) as string[];

    let contactMap: Record<string, string> = {};
    if (contactIds.length > 0) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, full_name")
        .in("id", [...new Set(contactIds)]);

      if (contacts) {
        contactMap = Object.fromEntries(
          contacts.map((c: any) => [c.id, c.full_name])
        );
      }
    }

    const convs: Conversation[] = [];
    const msgs: Message[] = [];

    for (const row of data as any[]) {
      const convId = `voice-${row.id}`;
      const contactName = row.contact_id
        ? contactMap[row.contact_id] ?? row.caller_number ?? "Unknown Caller"
        : row.caller_number ?? "Unknown Caller";

      // Conversation entry
      convs.push({
        id: convId,
        contactId: row.contact_id ?? `voice-contact-${row.id}`,
        contactName,
        channel: "voice",
        preview: formatTranscriptPreview(row.transcript),
        unread: false,
        lastAt: row.started_at ?? new Date().toISOString(),
      });

      // Map transcript messages
      if (Array.isArray(row.transcript)) {
        row.transcript
          .filter((m: any) => m.role && m.message)
          .forEach((m: any, i: number) => {
            msgs.push({
              id: `voice-msg-${row.id}-${i}`,
              conversationId: convId,
              channel: "voice",
              direction: m.role === "assistant" ? "out" : "in",
              body: m.message,
              at: row.started_at ?? new Date().toISOString(),
            });
          });
      } else if (row.summary) {
        // Fallback: show summary as a single message
        msgs.push({
          id: `voice-msg-${row.id}-summary`,
          conversationId: convId,
          channel: "voice",
          direction: "in",
          body: row.summary,
          at: row.started_at ?? new Date().toISOString(),
        });
      }
    }

    setConversations(convs);
    setMessages(msgs);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { conversations, messages, loading };
}