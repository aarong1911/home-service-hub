/// <reference types="node" />
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function toE164(raw: string): string | undefined {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length > 10) return `+${d}`;
  return undefined;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };

  const token = event.headers.authorization?.slice(7);
  if (!token) return { statusCode: 401, body: "" };

  // Verify caller is authenticated
  const { data: { user: caller } } = await admin.auth.getUser(token);
  if (!caller) return { statusCode: 401, body: "" };

  const { targetUserId, phone, firstName, lastName } = JSON.parse(event.body ?? "{}");
  if (!targetUserId) return { statusCode: 400, body: JSON.stringify({ error: "targetUserId required" }) };

  const e164 = phone ? toE164(phone) : undefined;

  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    ...(e164 ? { phone: e164 } : {}),
    user_metadata: {
      ...(firstName !== undefined ? { first_name: firstName } : {}),
      ...(lastName  !== undefined ? { last_name:  lastName  } : {}),
      ...(firstName !== undefined || lastName !== undefined
        ? { full_name: `${firstName ?? ""} ${lastName ?? ""}`.trim() } : {}),
      ...(phone !== undefined ? { phone } : {}),
    },
  });

  if (error) {
    console.error("[update-user-by-id] failed:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  console.log(`[update-user-by-id] updated user ${targetUserId}`);
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};