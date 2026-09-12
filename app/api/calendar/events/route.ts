import { NextRequest, NextResponse } from "next/server";
import { createSession, googleAuthCookies, readSession, sessionCookie, type GoogleSession } from "@/lib/google/auth";

type RefreshResponse = { access_token?: string; expires_in?: number };

async function refreshSession(session: GoogleSession): Promise<GoogleSession | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!session.refreshToken || !clientId || !clientSecret) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: session.refreshToken, grant_type: "refresh_token" }),
  });
  const token = (await response.json()) as RefreshResponse;
  if (!response.ok || !token.access_token || !token.expires_in) return null;
  return { ...session, accessToken: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
}

export async function GET(request: NextRequest) {
  let session = await readSession(request.cookies.get(googleAuthCookies.session)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with Google first" }, { status: 401 });

  let didRefresh = false;
  if (session.expiresAt < Date.now() + 60_000) {
    session = await refreshSession(session);
    didRefresh = true;
  }
  if (!session) return NextResponse.json({ error: "Google session expired; sign in again" }, { status: 401 });

  const calendarUrl = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  calendarUrl.search = new URLSearchParams({ timeMin: new Date().toISOString(), maxResults: "5", singleEvents: "true", orderBy: "startTime" }).toString();
  const calendarResponse = await fetch(calendarUrl, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  if (!calendarResponse.ok) {
    console.error("Google Calendar request failed:", await calendarResponse.text());
    return NextResponse.json({ error: "Could not load Calendar events" }, { status: 502 });
  }

  const response = NextResponse.json(await calendarResponse.json());
  if (didRefresh) response.cookies.set(googleAuthCookies.session, await createSession(session), sessionCookie);
  return response;
}
