const COOKIE_NAME = "session";
const MAX_AGE = 60 * 60 * 24 * 7;

export interface Session {
  slack_id: string;
}

async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function encodeSession(
  session: Session,
  secret: string,
): Promise<string> {
  const payload = btoa(JSON.stringify(session));
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${payload}.${sigB64}`;
}

export async function decodeSession(
  cookie: string,
  secret: string,
): Promise<Session | null> {
  const dot = cookie.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = cookie.slice(0, dot);
  const sigB64 = cookie.slice(dot + 1);
  const key = await getKey(secret);
  const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(payload),
  );
  if (!valid) return null;
  try {
    return JSON.parse(atob(payload)) as Session;
  } catch {
    return null;
  }
}

export async function getSession(
  cookies: { get: (name: string) => { value: string } | undefined },
  secret: string,
): Promise<Session | null> {
  const raw = cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return decodeSession(raw, secret);
}

export async function setSessionCookie(
  session: Session,
  secret: string,
): Promise<string> {
  const value = await encodeSession(session, secret);
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
