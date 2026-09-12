"use client";

import { useEffect, useState } from "react";

type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};
type CalendarResponse = { items?: CalendarEvent[]; error?: string };

function eventDate(value: CalendarEvent["start"] | CalendarEvent["end"]) {
  const date = value?.dateTime ?? value?.date;
  if (!date) return "Time unavailable";
  if (value?.date) return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T00:00:00`));
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

export default function Home() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const loadEvents = async () => {
      const response = await fetch("/api/calendar/events");
      const data = (await response.json()) as CalendarResponse;
      if (!response.ok) setError(data.error ?? "Unable to load your calendar.");
      else {
        setEvents(data.items ?? []);
        setSignedIn(true);
      }
      setLoading(false);
    };
    void loadEvents();
  }, []);

  return (
    <main className="min-h-dvh bg-[#f7f8fc] px-5 py-6 text-[#1c1b20] sm:px-8 dark:bg-[#121318] dark:text-[#e4e1e9]">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-3xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">CVision</h1>
          {signedIn ? (
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="rounded-full border border-[#dadce0] bg-white px-4 py-2.5 text-sm font-medium text-[#3c4043] shadow-sm transition hover:bg-[#f8f9fa] dark:border-[#5f6368] dark:bg-[#292a2d] dark:text-white dark:hover:bg-[#3c4043]">
                Log out
              </button>
            </form>
          ) : (
            <a href="/api/auth/google" className="inline-flex items-center gap-3 rounded-full border border-[#dadce0] bg-white px-4 py-2.5 text-sm font-medium text-[#3c4043] shadow-sm transition hover:bg-[#f8f9fa] dark:border-[#5f6368] dark:bg-[#292a2d] dark:text-white dark:hover:bg-[#3c4043]">
              <GoogleMark />
              Sign in with Google
            </a>
          )}
        </header>

        <section className="mt-10 flex-1">
          <div className="mb-4 flex items-end justify-between">
            <div><p className="text-sm font-medium text-[#5f6368] dark:text-[#c7c5d0]">Your schedule</p><h2 className="text-xl font-semibold">Upcoming events</h2></div>
            {!loading && !error && <span className="text-sm text-[#5f6368] dark:text-[#c7c5d0]">Next {events.length} events</span>}
          </div>
          {loading ? <p className="rounded-2xl bg-white p-5 text-[#5f6368] shadow-sm dark:bg-[#1e1f25] dark:text-[#c7c5d0]">Loading calendar…</p> : error ? <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-[#1e1f25]"><p className="font-medium">Connect your Google Calendar to see events.</p><p className="mt-1 text-sm text-[#5f6368] dark:text-[#c7c5d0]">{error}</p></div> : events.length === 0 ? <p className="rounded-2xl bg-white p-5 text-[#5f6368] shadow-sm dark:bg-[#1e1f25] dark:text-[#c7c5d0]">No upcoming events found.</p> : <ul className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#1e1f25]">{events.map((event) => <li key={event.id} className="border-b border-[#e7e7eb] last:border-0 dark:border-[#34353c]"><button type="button" onClick={() => setSelectedEvent(event)} className="w-full px-5 py-4 text-left transition hover:bg-[#f1f5fe] dark:hover:bg-[#292a31]"><p className="font-medium">{event.summary ?? "Untitled event"}</p><p className="mt-1 text-sm text-[#5f6368] dark:text-[#c7c5d0]">{eventDate(event.start)}</p></button></li>)}</ul>}
        </section>

        <footer className="mt-10 flex justify-center gap-5 pb-2 text-sm text-[#5f6368] dark:text-[#c7c5d0]"><button type="button" className="underline underline-offset-4">Terms of use</button><button type="button" className="underline underline-offset-4">Privacy</button></footer>
      </div>

      {selectedEvent && <div role="dialog" aria-modal="true" aria-labelledby="event-title" className="fixed inset-0 z-10 grid place-items-center bg-black/45 p-5" onMouseDown={() => setSelectedEvent(null)}><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1e1f25]" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><h2 id="event-title" className="text-xl font-semibold">{selectedEvent.summary ?? "Untitled event"}</h2><button type="button" aria-label="Close event details" onClick={() => setSelectedEvent(null)} className="rounded-full p-1 text-xl leading-none hover:bg-black/5 dark:hover:bg-white/10">×</button></div><dl className="mt-5 space-y-4 text-sm"><div><dt className="font-medium">Starts</dt><dd className="mt-1 text-[#5f6368] dark:text-[#c7c5d0]">{eventDate(selectedEvent.start)}</dd></div><div><dt className="font-medium">Ends</dt><dd className="mt-1 text-[#5f6368] dark:text-[#c7c5d0]">{eventDate(selectedEvent.end)}</dd></div>{selectedEvent.location && <div><dt className="font-medium">Location</dt><dd className="mt-1 text-[#5f6368] dark:text-[#c7c5d0]">{selectedEvent.location}</dd></div>}{selectedEvent.description && <div><dt className="font-medium">Description</dt><dd className="mt-1 whitespace-pre-wrap text-[#5f6368] dark:text-[#c7c5d0]">{selectedEvent.description}</dd></div>}</dl>{selectedEvent.htmlLink && <a href={selectedEvent.htmlLink} target="_blank" rel="noreferrer" className="mt-6 inline-block font-medium text-[#1a73e8] hover:underline">Open in Google Calendar</a>}</section></div>}
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
