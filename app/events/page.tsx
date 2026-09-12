"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  eventTitle,
  eventsWithLocation,
  fetchCalendarEvents,
  formatEventTime,
  parkingHref,
  type LocatedEvent,
} from "@/lib/calendar/events";

export default function Events() {
  const [events, setEvents] = useState<LocatedEvent[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<LocatedEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchCalendarEvents(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      // Parking needs somewhere to park near, so events without a location
      // are left out rather than shown as dead ends.
      const located = eventsWithLocation(result.events);
      setEvents(located);
      setSkipped(result.events.length - located.length);
      setError(result.error);
      setSignedIn(result.signedIn);
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  return (
    <main className="events-page min-h-dvh px-5 py-6 text-[#3b1f25] sm:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-3xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-3xl font-semibold tracking-tight">Parkwise</Link>
          {signedIn ? (
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="rounded-full border border-white/70 bg-white/55 px-4 py-2.5 text-sm font-medium text-[#7a3040] shadow-sm transition hover:bg-white/80">
                Log out
              </button>
            </form>
          ) : (
            <a href="/api/auth/google" className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/55 px-4 py-2.5 text-sm font-medium text-[#7a3040] shadow-sm transition hover:bg-white/80">
              <GoogleMark />
              Sign in with Google
            </a>
          )}
        </header>

        <section className="mt-10 flex-1">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-sm font-medium text-[#5f6368]">Your schedule</p>
              <h2 className="text-xl font-semibold">Upcoming events with a location</h2>
            </div>
            {!loading && !error && (
              <span className="text-right text-sm text-[#5f6368]">
                {events.length} event{events.length === 1 ? "" : "s"}
                {skipped > 0 && <><br />{skipped} without a location hidden</>}
              </span>
            )}
          </div>
          {loading ? (
            <p className="rounded-2xl bg-white p-5 text-[#5f6368] shadow-sm">Loading calendar…</p>
          ) : error ? (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="font-medium">Connect your Google Calendar to see events.</p>
              <p className="mt-1 text-sm text-[#5f6368]">{error}</p>
            </div>
          ) : events.length === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-[#5f6368] shadow-sm">
              No upcoming events have a location. Add a location to an event in Google Calendar and it will appear here.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {events.map((event) => (
                <li key={event.id} className="flex items-center border-b border-[#e7e7eb] last:border-0">
                  <button type="button" onClick={() => setSelectedEvent(event)} className="min-w-0 flex-1 px-5 py-4 text-left transition hover:bg-[#f9f1ec]">
                    <p className="font-medium">{eventTitle(event)}</p>
                    <p className="mt-1 text-sm text-[#5f6368]">{formatEventTime(event.start)}</p>
                    <p className="mt-1 truncate text-sm text-[#7a3040]">{event.location}</p>
                  </button>
                  <Link href={parkingHref(event)} className="mr-4 shrink-0 rounded-full bg-[#7a3040] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#59232f]">
                    Find parking
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-10 flex justify-center gap-5 pb-2 text-sm text-[#5f6368]">
          <Link href="/" className="underline underline-offset-4">Dashboard</Link>
          <button type="button" className="underline underline-offset-4">Terms of use</button>
          <button type="button" className="underline underline-offset-4">Privacy</button>
        </footer>
      </div>

      {selectedEvent && (
        <div role="dialog" aria-modal="true" aria-labelledby="event-title" className="fixed inset-0 z-10 grid place-items-center bg-black/45 p-5" onMouseDown={() => setSelectedEvent(null)}>
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <h2 id="event-title" className="text-xl font-semibold">{eventTitle(selectedEvent)}</h2>
              <button type="button" aria-label="Close event details" onClick={() => setSelectedEvent(null)} className="rounded-full p-1 text-xl leading-none hover:bg-black/5">×</button>
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="font-medium">Starts</dt><dd className="mt-1 text-[#5f6368]">{formatEventTime(selectedEvent.start)}</dd></div>
              <div><dt className="font-medium">Ends</dt><dd className="mt-1 text-[#5f6368]">{formatEventTime(selectedEvent.end)}</dd></div>
              <div><dt className="font-medium">Location</dt><dd className="mt-1 text-[#5f6368]">{selectedEvent.location}</dd></div>
              {selectedEvent.description && <div><dt className="font-medium">Description</dt><dd className="mt-1 whitespace-pre-wrap text-[#5f6368]">{selectedEvent.description}</dd></div>}
            </dl>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link href={parkingHref(selectedEvent)} className="rounded-full bg-[#7a3040] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#59232f]">
                Find parking on the map
              </Link>
              {selectedEvent.htmlLink && (
                <a href={selectedEvent.htmlLink} target="_blank" rel="noreferrer" className="font-medium text-[#1a73e8] hover:underline">Open in Google Calendar</a>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.24c1.9-1.75 2.97-4.34 2.97-7.36Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.12-1.31.31-1.92V7.49H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.51l3.35-2.59Z" />
      <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.96 2.97 14.7 2 12 2a10 10 0 0 0-8.94 5.49l3.35 2.59C7.2 7.72 9.4 5.96 12 5.96Z" />
    </svg>
  );
}
