import { NextRequest, NextResponse } from "next/server";
import { createSession, googleAuthCookies, sessionCookie, type GoogleUser } from "@/lib/google/auth";

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number };

export async function GET(request: NextRequest) {
  const home = new URL("/", request.nextUrl.origin);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(googleAuthCookies.state)?.value;
  if (!code || !state || state !== expectedState) return NextResponse.redirect(home);

  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json({ error: "Google OAuth credentials are not configured" }, { status: 500 });

  const callbackUrl = new URL("/api/auth/google/callback", request.nextUrl.origin).toString();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: callbackUrl, grant_type: "authorization_code" }),
  });
  const token = (await tokenResponse.json()) as TokenResponse;
  if (!tokenResponse.ok || !token.access_token || !token.expires_in) return NextResponse.redirect(home);

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
  const profile = (await profileResponse.json()) as Partial<GoogleUser>;
  if (!profileResponse.ok || !profile.email || !profile.name) return NextResponse.redirect(home);

  const response = NextResponse.redirect(home);
  response.cookies.set(googleAuthCookies.session, await createSession({ email: profile.email, name: profile.name, picture: profile.picture, accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000 }), sessionCookie);
  response.cookies.delete(googleAuthCookies.state);
  response.cookies.set(googleAuthCookies.demo, "", { path: "/", maxAge: 0 });
  return response;
}
