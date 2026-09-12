import { NextRequest, NextResponse } from "next/server";
import { googleAuthCookies } from "@/lib/google/auth";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Set GOOGLE_CLIENT_ID (or NEXT_PUBLIC_GOOGLE_CLIENT_ID) in .env.local, then restart the dev server" },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();
  const callbackUrl = new URL("/api/auth/google/callback", request.nextUrl.origin).toString();
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile https://www.googleapis.com/auth/calendar.events.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(googleAuthCookies.state, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return response;
}
