/// <reference types="node" />
// netlify/functions/update-user-by-id.ts
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

  const { data: { user: caller } } = await admin.auth.getUser(token);
  if (!caller) return { statusCode: 401, body: "" };

  const { targetUserId, phone, firstName, lastName, role } = JSON.parse(event.body ?? "{}");
  if (!targetUserId) return { statusCode: 400, body: JSON.stringify({ error: "targetUserId required" }) };

  const e164 = phone ? toE164(phone) : undefined;

  // 1. Update auth.users metadata + phone
  const { error: authErr } = await admin.auth.admin.updateUserById(targetUserId, {
    ...(e164 ? { phone: e164 } : {}),
    user_metadata: {
      ...(firstName !== undefined ? { first_name: firstName } : {}),
      ...(lastName  !== undefined ? { last_name:  lastName  } : {}),
      ...(firstName !== undefined || lastName !== undefined
        ? { full_name: `${firstName ?? ""} ${lastName ?? ""}`.trim() } : {}),
      ...(phone !== undefined ? { phone } : {}),
    },
  });
  if (authErr) console.error("[update-user-by-id] auth update failed:", authErr);

  // 2. Update profiles table (admin bypasses RLS)
  const profilePatch: Record<string, any> = {};
  if (firstName !== undefined) profilePatch.first_name = firstName;
  if (lastName  !== undefined) profilePatch.last_name  = lastName;
  if (phone     !== undefined) profilePatch.phone      = phone || null;

  if (Object.keys(profilePatch).length > 0) {
    const { error: profileErr } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("id", targetUserId);
    if (profileErr) console.error("[update-user-by-id] profiles update failed:", profileErr);
    else console.log(`[update-user-by-id] profile updated for ${targetUserId}`);
  }

  // 3. Update role in org_memberships if provided
  if (role) {
    const { error: roleErr } = await admin
      .from("org_memberships")
      .update({ role })
      .eq("member_id", targetUserId);
    if (roleErr) console.error("[update-user-by-id] role update failed:", roleErr);
    else console.log(`[update-user-by-id] role updated to ${role} for ${targetUserId}`);
  }

  console.log(`[update-user-by-id] ✓ updated user ${targetUserId}`);
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};