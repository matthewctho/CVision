export type GoogleUser = {
  email: string;
  name: string;
  picture?: string;
};

export type GoogleSession = GoogleUser & {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

export const googleAuthCookies = {
  session: "google_session",
  state: "google_oauth_state",
  demo: "parkwise_demo",
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Buffer.from(signature).toString("base64url");
}

function equal(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

export async function createSession(session: GoogleSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${await sign(payload)}`;
}

export async function readSession(value: string | undefined): Promise<GoogleSession | null> {
  if (!value) return null;
  const [payload, signature, ...rest] = value.split(".");
  if (!payload || !signature || rest.length || !equal(signature, await sign(payload))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GoogleSession;
    return typeof session.email === "string" && typeof session.name === "string" && typeof session.accessToken === "string" && typeof session.expiresAt === "number" ? session : null;
  } catch {
    return null;
  }
}

export const sessionCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
