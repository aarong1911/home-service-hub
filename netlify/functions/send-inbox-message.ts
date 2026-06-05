import type { Handler } from "@netlify/functions";
import nodemailer from "nodemailer";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };

  let reqBody: { channel: string; to: string; body: string; subject?: string; from_name?: string };
  try {
    reqBody = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { channel, to, body, subject, from_name } = reqBody;
  if (!channel || !to || !body) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "channel, to, body are required" }) };
  }

  try {
    if (channel === "sms") {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_PHONE_NUMBER;
      if (!sid || !token || !from) throw new Error("Twilio credentials not configured");

      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
        }
      );
      if (!res.ok) {
        const err: any = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Twilio error ${res.status}`);
      }
    } else if (channel === "email") {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      });
      await transporter.sendMail({
        from: `${from_name ?? "RenoMeta Connect"} <${process.env.SMTP_USER}>`,
        to,
        subject: subject || "(no subject)",
        text: body,
      });
    }
    // "note" channel: server-side no-op — stored client-side only

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err: any) {
    console.error("[send-inbox-message]", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
