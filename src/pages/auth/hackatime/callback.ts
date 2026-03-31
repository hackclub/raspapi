import type { APIRoute } from "astro";
import { getSession } from "../../../lib/session";
import { updateHackatimeToken } from "../../../lib/airtable";

export const GET: APIRoute = async ({ url, cookies }) => {
  const base = import.meta.env.PUBLIC_BASE_URL;

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || !state)
    return Response.redirect(`${base}/me?error=hackatime_denied`);

  const parts = state.split(".");
  if (parts.length !== 2)
    return Response.redirect(`${base}/me?error=invalid_state`);

  const [payload, sigB64] = parts;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(import.meta.env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    encoder.encode(payload),
  );
  if (!valid) return Response.redirect(`${base}/me?error=invalid_state`);

  let slack_id: string;
  try {
    ({ slack_id } = JSON.parse(atob(payload)));
  } catch {
    return Response.redirect(`${base}/me?error=invalid_state`);
  }

  const session = await getSession(cookies, import.meta.env.SESSION_SECRET);
  if (!session || session.slack_id !== slack_id)
    return Response.redirect(`${base}/auth/login`);

  // token exchange
  const tokenRes = await fetch("https://hackatime.hackclub.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: import.meta.env.HACKATIME_UID,
      client_secret: import.meta.env.HACKATIME_SECRET,
      code,
      redirect_uri: `${base}/auth/hackatime/callback`,
    }),
  });

  if (!tokenRes.ok)
    return Response.redirect(`${base}/me?error=hackatime_token_failed`);

  const { access_token } = await tokenRes.json();
  if (!access_token)
    return Response.redirect(`${base}/me?error=hackatime_token_failed`);

  const ok = await updateHackatimeToken(slack_id, access_token);
  if (!ok) return Response.redirect(`${base}/me?error=hackatime_save_failed`);

  return Response.redirect(`${base}/me?hackatime=connected`);
};
