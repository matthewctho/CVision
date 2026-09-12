/**
 * Calendar event shapes and helpers shared by the dashboard, the events list
 * and the map. Client-safe: nothing here touches the Google session.
 */

export type EventTime = { dateTime?: string; date?: string };

export type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: EventTime;
  end?: EventTime;
};

/** An event the app can actually find parking for. */
export type LocatedEvent = CalendarEvent & { location: string };

export type CalendarResponse = { items?: CalendarEvent[]; error?: string };

export function hasLocation(event: CalendarEvent): event is LocatedEvent {
  return typeof event.location === "string" && event.location.trim().length > 0;
}

/** Only events with a location can be parked for, so that's all the UI shows. */
export function eventsWithLocation(events: readonly CalendarEvent[]): LocatedEvent[] {
  return events.filter(hasLocation);
}

export function eventTitle(event: CalendarEvent): string {
  return event.summary?.trim() || "Untitled event";
}

export function isAllDay(value: EventTime | undefined): boolean {
  return Boolean(value?.date && !value.dateTime);
}

export function eventTimeToDate(value: EventTime | undefined): Date | null {
  if (value?.dateTime) return new Date(value.dateTime);
  if (value?.date) return new Date(`${value.date}T00:00:00`);
  return null;
}

/** "Fri, Sep 19, 3:00 PM" or "Fri, Sep 19, 2026" for all-day events. */
export function formatEventTime(value: EventTime | undefined): string {
  const date = eventTimeToDate(value);
  if (!date) return "Time unavailable";
  if (isAllDay(value)) {
    return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

/** "10:30 AM – 12:00 PM", or "All day" for date-only events. */
export function formatEventRange(event: CalendarEvent): string {
  if (isAllDay(event.start)) return "All day";
  const start = eventTimeToDate(event.start);
  const end = eventTimeToDate(event.end);
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  if (!start) return "Time unavailable";
  return end ? `${time.format(start)} – ${time.format(end)}` : time.format(start);
}

/** "Today", "Tomorrow" or "Fri, Sep 19". */
export function formatEventDay(event: CalendarEvent): string {
  const start = eventTimeToDate(event.start);
  if (!start) return "Date unavailable";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(start);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(start);
}

/** Hours between start and end, for estimating what the parking will cost. */
export function eventDurationHours(event: CalendarEvent): number | null {
  const start = eventTimeToDate(event.start);
  const end = eventTimeToDate(event.end);
  if (!start || !end || isAllDay(event.start)) return null;
  const hours = (end.getTime() - start.getTime()) / 3_600_000;
  return hours > 0 ? hours : null;
}

/** Link to the full-screen map for this event's location. */
export function parkingHref(event: LocatedEvent): string {
  const params = new URLSearchParams({ location: event.location, name: eventTitle(event) });
  if (event.start?.dateTime) params.set("start", event.start.dateTime);
  return `/map?${params.toString()}`;
}

export type CalendarLoad = { events: CalendarEvent[]; error: string; signedIn: boolean };

/** Loads the signed-in user's upcoming events; an error means not signed in or Google failed. */
export async function fetchCalendarEvents(signal?: AbortSignal): Promise<CalendarLoad> {
  try {
    const response = await fetch("/api/calendar/events", { signal, cache: "no-store" });
    const data = (await response.json()) as CalendarResponse;
    if (!response.ok) {
      return { events: [], error: data.error ?? "Unable to load your calendar.", signedIn: response.status !== 401 };
    }

    return { events: data.items ?? [], error: "", signedIn: true };
  } catch (err) {
    if (signal?.aborted) return { events: [], error: "", signedIn: false };
    return { events: [], error: err instanceof Error ? err.message : "Unable to load your calendar.", signedIn: false };
  }
}

export async function saveCalendarRoute(eventId: string, routeLink: string): Promise<{ error: string }> {
  try {
    const response = await fetch(`/api/calendar/events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routeLink }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      return { error: data.error ?? "Unable to save the route to Google Calendar." };
    }
    return { error: "" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unable to save the route to Google Calendar." };
  }
}
