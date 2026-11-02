// Passcode session: a signed, expiring cookie. Uses Web Crypto so it runs in the proxy too.
// The signing key includes the passcode, so changing APP_PASSCODE signs everyone out.

export const SESSION_COOKIE = "sat_session";
export const SESSION_DAYS = 365;

const encoder = new TextEncoder();

function secrets() {
  const secret = process.env.SESSION_SECRET;
  const passcode = process.env.APP_PASSCODE;
  if (!secret || secret.length < 32 || !passcode) {
    throw new Error("Set SESSION_SECRET (32+ characters) and APP_PASSCODE. See README → Environment variables.");
  }
  return { secret, passcode };
}

async function hmacKey() {
  const { secret, passcode } = secrets();
  return crypto.subtle.importKey("raw", encoder.encode(`${secret}:${passcode}`), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function toBase64Url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

export async function createSession(now = Date.now()) {
  const payload = `v1.${now + SESSION_DAYS * 86_400_000}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(payload));
  return `${payload}.${toBase64Url(sig)}`;
}

export async function verifySession(value: string | undefined, now = Date.now()) {
  if (!value) return false;
  const [version, expires, sig] = value.split(".");
  if (version !== "v1" || !expires || !sig || !(Number(expires) > now)) return false;
  try {
    return await crypto.subtle.verify("HMAC", await hmacKey(), fromBase64Url(sig), encoder.encode(`${version}.${expires}`));
  } catch {
    return false;
  }
}

// Compares SHA-256 digests so the check takes the same time however close the guess is.
export async function passcodeMatches(attempt: string) {
  const { passcode } = secrets();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(attempt.trim())),
    crypto.subtle.digest("SHA-256", encoder.encode(passcode.trim())),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
