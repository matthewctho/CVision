import { NextRequest, NextResponse } from "next/server";
import { createSession, googleAuthCookies, readSession, sessionCookie, type GoogleSession } from "@/lib/google/auth";

type RefreshResponse = { access_token?: string; expires_in?: number };
const ROUTE_MARKER = "CVision parking route:";

async function refreshSession(session: GoogleSession): Promise<GoogleSession | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!session.refreshToken || !clientId || !clientSecret) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: session.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const token = (await response.json()) as RefreshResponse;
  if (!response.ok || !token.access_token || !token.expires_in) return null;
  return { ...session, accessToken: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const body = (await request.json()) as { routeLink?: string };
  if (!body.routeLink || !/^https?:\/\//.test(body.routeLink)) {
    return NextResponse.json({ error: "A valid route link is required." }, { status: 400 });
  }

  let session = await readSession(request.cookies.get(googleAuthCookies.session)?.value);
  if (!session) {
    if (request.cookies.get(googleAuthCookies.demo)?.value === "1") {
      return NextResponse.json({ saved: true, demo: true });
    }
    return NextResponse.json({ error: "Sign in with Google first." }, { status: 401 });
  }

  let didRefresh = false;
  if (session.expiresAt < Date.now() + 60_000) {
    session = await refreshSession(session);
    didRefresh = true;
  }
  if (!session) return NextResponse.json({ error: "Google session expired; sign in again." }, { status: 401 });

  const { eventId } = await params;
  const eventUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;
  const currentResponse = await fetch(eventUrl, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!currentResponse.ok) {
    return NextResponse.json(
      { error: currentResponse.status === 403 ? "Calendar write access is missing. Sign in with Google again to grant permission." : "Could not read the calendar event." },
      { status: currentResponse.status === 403 ? 403 : 502 },
    );
  }

  const current = (await currentResponse.json()) as { description?: string };
  const withoutPreviousRoute = (current.description ?? "")
    .split("\n")
    .filter((line) => !line.startsWith(ROUTE_MARKER))
    .join("\n")
    .trim();
  const description = [withoutPreviousRoute, `${ROUTE_MARKER} ${body.routeLink}`].filter(Boolean).join("\n\n");
  const updateResponse = await fetch(eventUrl, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!updateResponse.ok) {
    return NextResponse.json(
      { error: updateResponse.status === 403 ? "Calendar write access is missing. Sign in with Google again to grant permission." : "Could not save the route to Google Calendar." },
      { status: updateResponse.status === 403 ? 403 : 502 },
    );
  }

  const response = NextResponse.json({ saved: true });
  if (didRefresh) response.cookies.set(googleAuthCookies.session, await createSession(session), sessionCookie);
  return response;
}
