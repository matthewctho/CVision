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

export default function Events() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadEvents = async () => {
      const response = await fetch("/api/calendar/events");
      const data = (await response.json()) as CalendarResponse;
      if (!response.ok) setError(data.error ?? "Unable to load your calendar.");
      else {
        setEvents(data.items ?? []);
      }
      setLoading(false);
    };
    void loadEvents();
  }, []);

  return (
    <main className="events-page min-h-dvh px-5 py-6 text-[#3b1f25] sm:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-3xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <a href="/" className="text-3xl font-semibold tracking-tight">Parkwise</a>
          <a href="/" className="inline-flex items-center rounded-full border border-white/70 bg-white/55 px-4 py-2.5 text-sm font-medium text-[#7a3040] shadow-sm transition hover:bg-white/80">
            Back to homepage
          </a>
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
