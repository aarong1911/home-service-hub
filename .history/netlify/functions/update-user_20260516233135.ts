// netlify/functions/update-user.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };

  const token = event.headers.authorization?.slice(7);
  if (!token) return { statusCode: 401, body: "" };

  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return { statusCode: 401, body: "" };

  const { phone, firstName, lastName } = JSON.parse(event.body ?? "{}");

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    phone: phone || undefined,
    user_metadata: {
      ...user.user_metadata,
      first_name: firstName || user.user_metadata?.first_name,
      last_name:  lastName  || user.user_metadata?.last_name,
      full_name:  `${firstName || ""} ${lastName || ""}`.trim() || user.user_metadata?.full_name,
      phone:      phone || user.user_metadata?.phone,
    },
  });

  if (error) {
    console.error("[update-user] failed:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  console.log(`[update-user] updated user ${user.id}`);
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};