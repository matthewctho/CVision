"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  Car,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  ExternalLink,
  Footprints,
  GripVertical,
  Home,
  Info,
  MapPin,
  Maximize2,
  Menu,
  Navigation,
  ParkingCircle,
  Route,
  Sparkles,
  Star,
  Timer,
} from "lucide-react";

import ParkingMap, { type MapSpot } from "./ParkingMap";
import { useParkingRoute, type DestinationQuery } from "./useParkingRoute";
import {
  formatClock,
  formatDistance,
  formatDuration,
  priceOrAvailability,
  spotPopupHtml,
  type RoutedSpot,
} from "./parkingFormat";
import {
  eventDurationHours,
  eventTimeToDate,
  eventTitle,
  eventsWithLocation,
  fetchCalendarEvents,
  formatEventDay,
  formatEventRange,
  parkingHref,
  saveCalendarRoute,
  type LocatedEvent,
} from "@/lib/calendar/events";
import { annotateRoute } from "@/lib/parking/route";
import { MAX_STOPS, buildGoogleMapsLink } from "@/src/lib/googleMapsLink";

const EVENT_TONES = ["purple", "orange", "blue"] as const;
type Tone = (typeof EVENT_TONES)[number];
type SortMode = "route" | "nearest" | "cheapest" | "custom";

function toneFor(index: number): Tone {
  return EVENT_TONES[index % EVENT_TONES.length];
}

function initials(name: string | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PW";
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <ParkingCircle size={18} />
      </span>
      <span>CVision</span>
    </div>
  );
}

function SignIn() {
  return (
    <main className="auth-shell">
      <div className="auth-orb orb-one" />
      <div className="auth-orb orb-two" />
      <header className="auth-nav">
        <Logo />
      </header>
      <section className="auth-content">
        <div className="auth-copy">
          <h1>
            Welcome to <em>CVision</em>
          </h1>
        </div>
        <div className="signin-card glass-card">
          <div className="signin-icon">
            <CalendarDays size={22} />
          </div>
          <h2>Welcome to CVision</h2>
          <p>Sign in with Google to plan parking around your calendar.</p>
          <a className="google-button" href="/api/auth/google">
            <span className="google-g">G</span> Sign in with Google
          </a>
        </div>
      </section>
      <footer className="auth-footer">
        <span>© 2026 CVision</span>
      </footer>
    </main>
  );
}

function EventCard({
  event,
  tone,
  selected,
  onClick,
}: {
  event: LocatedEvent;
  tone: Tone;
  selected: boolean;
  onClick: () => void;
}) {
  const start = eventTimeToDate(event.start);
  return (
    <button type="button" className={`event-card ${selected ? "selected" : ""}`} onClick={onClick}>
      <span className={`event-date ${tone}`}>
        <strong>{start ? start.getDate() : "–"}</strong>
        <small>{start ? new Intl.DateTimeFormat(undefined, { month: "short" }).format(start).toUpperCase() : ""}</small>
      </span>
      <span className="event-copy">
        <strong>{eventTitle(event)}</strong>
        <span>{event.location}</span>
        <small>
          {formatEventDay(event)} · {formatEventRange(event)}
        </small>
      </span>
      <ChevronRight size={18} className="event-arrow" />
    </button>
  );
}

function SortButton({
  active,
  children,
  onClick,
  icon,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button type="button" className={`sort-chip ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

function SpotRow({
  spot,
  index,
  selected,
  dropTarget,
  costLabel,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  spot: RoutedSpot;
  index: number;
  selected: boolean;
  dropTarget: boolean;
  costLabel: string;
  onSelect: (id: string) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, index: number) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, index: number) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      className={`spot-row ${selected ? "selected" : ""} ${dropTarget ? "drop-target" : ""}`}
      draggable
      onDragStart={(event) => onDragStart(event, index)}
      onDragOver={(event) => onDragOver(event, index)}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event, index);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(spot.id)}
    >
      <GripVertical size={16} className="drag-handle" />
      <span className={`spot-number ${toneFor(index)}`}>{index + 1}</span>
      <div className="spot-main">
        <div className="spot-title">
          <strong>{spot.name}</strong>
          {spot.isOpenNow === false ? <span className="status paid">CLOSED</span> : <span className="status paid">PAID</span>}
        </div>
        <div className="spot-meta">
          <span>
            <Navigation size={12} /> {formatDistance(spot.distanceMeters)}
          </span>
          <span>
            <Footprints size={12} /> {formatDuration(spot.walkSeconds)} walk
          </span>
          <span>
            <Car size={12} /> {formatDuration(spot.cumulativeDriveSeconds)} drive
          </span>
          {spot.rating !== null && (
            <span>
              <Star size={12} /> {spot.rating}
            </span>
          )}
        </div>
      </div>
      <div className="spot-cost">
        <strong>{priceOrAvailability(spot)}</strong>
        <span>{costLabel}</span>
      </div>
      <ChevronRight size={16} className="row-arrow" />
    </div>
  );
}

function Dashboard({ onSignOut, userName }: { onSignOut: () => void; userName?: string }) {
  const [events, setEvents] = useState<LocatedEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [sortMode, setSortMode] = useState<SortMode>("route");
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [routeSaveError, setRouteSaveError] = useState("");
  const savedRouteKeyRef = useRef("");

  useEffect(() => {
    let controller = new AbortController();
    let firstLoad = true;
    const refresh = () => {
      controller.abort();
      controller = new AbortController();
      const requestController = controller;
      fetchCalendarEvents(requestController.signal).then((result) => {
      if (requestController.signal.aborted) return;
      setEvents(eventsWithLocation(result.events));
      setEventsError(result.error);
      if (firstLoad) {
        setEventsLoading(false);
        firstLoad = false;
      }
      });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0] ?? null;

  const query = useMemo<DestinationQuery | null>(
    () => (selectedEvent ? { address: selectedEvent.location, name: eventTitle(selectedEvent) } : null),
    [selectedEvent],
  );
  const { destination, routed, loading: parkingLoading, error: parkingError, origin, setOrigin } =
    useParkingRoute(query);

  const selectEvent = (event: LocatedEvent) => {
    setSelectedEventId(event.id);
    setSortMode("route");
    setCustomOrder([]);
    setSelectedSpotId(null);
  };

  // Displayed order, with drive legs recomputed along it so the numbers still
  // mean something after a re-sort or a drag.
  const spots = useMemo<RoutedSpot[]>(() => {
    const list = [...routed];
    if (sortMode === "nearest") list.sort((a, b) => a.distanceMeters - b.distanceMeters);
    else if (sortMode === "cheapest")
      // Spots with no price data (TfNSW - real availability, no rate) sort last rather than first.
      list.sort(
        (a, b) => (a.estimatedPricePerHour ?? Infinity) - (b.estimatedPricePerHour ?? Infinity),
      );
    else if (sortMode === "custom") {
      const rank = new Map(customOrder.map((id, index) => [id, index]));
      list.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
    }
    if (!destination) return list;
    return annotateRoute(origin ?? destination, destination, list);
  }, [routed, sortMode, customOrder, origin, destination]);

  const selectedSpot = spots.find((spot) => spot.id === selectedSpotId) ?? spots[0] ?? null;

  const mapSpots = useMemo<MapSpot[]>(
    () =>
      spots.map((spot, index) => ({
        id: spot.id,
        lat: spot.lat,
        lng: spot.lng,
        popupHtml: spotPopupHtml(spot, index, destination?.name ?? "destination"),
      })),
    [spots, destination?.name],
  );

  const durationHours = selectedEvent ? eventDurationHours(selectedEvent) : null;
  const costLabel = (spot: RoutedSpot) => {
    if (spot.estimatedPricePerHour == null) return "live availability";
    return durationHours
      ? `~$${(spot.estimatedPricePerHour * durationHours).toFixed(0)} for ${durationHours % 1 === 0 ? durationHours : durationHours.toFixed(1)} hr`
      : "estimated";
  };

  const eventStart = selectedEvent ? eventTimeToDate(selectedEvent.start) : null;
  const lastSpot = spots[spots.length - 1] ?? null;
  const totalTripSeconds =
    selectedSpot && origin ? selectedSpot.cumulativeDriveSeconds + selectedSpot.walkSeconds : null;
  const leaveBy =
    eventStart && totalTripSeconds !== null ? new Date(eventStart.getTime() - totalTripSeconds * 1000) : null;

  const tourLink = useMemo(() => {
    if (spots.length === 0) return null;
    return buildGoogleMapsLink(spots.slice(0, MAX_STOPS));
  }, [spots]);

  useEffect(() => {
    if (!selectedEvent || !tourLink || parkingLoading) return;
    const key = `${selectedEvent.id}:${tourLink}`;
    if (savedRouteKeyRef.current === key) return;
    savedRouteKeyRef.current = key;
    setRouteSaveError("");
    void saveCalendarRoute(selectedEvent.id, tourLink).then((result) => {
      if (result.error) setRouteSaveError(result.error);
    });
  }, [selectedEvent, tourLink, parkingLoading]);

  const startDragging = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    setDragSourceIndex(index);
  };
  const dragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragTargetIndex(index);
  };
  const reorder = (event: DragEvent<HTMLDivElement>, targetIndex: number) => {
    const parsedSource = event.dataTransfer.getData("text/plain");
    const sourceIndex = parsedSource === "" ? dragSourceIndex : Number(parsedSource);
    setDragSourceIndex(null);
    setDragTargetIndex(null);
    if (sourceIndex === null || Number.isNaN(sourceIndex) || sourceIndex === targetIndex) return;
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= spots.length || targetIndex >= spots.length) return;
    const next = spots.map((spot) => spot.id);
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved!);
    setCustomOrder(next);
    setSortMode("custom");
  };
  const copyLink = () => {
    if (!tourLink) return;
    navigator.clipboard?.writeText(tourLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const parkingStatus = !selectedEvent
    ? null
    : parkingLoading
      ? `Finding parking near ${eventTitle(selectedEvent)}…`
      : parkingError
        ? parkingError
        : spots.length === 0
          ? "No parking found within walking distance."
          : null;

  return (
    <div className="dashboard-shell">
      <header className="topbar">
        <Logo />
        <nav>
          <span className="nav-link active">
            <Home size={15} /> Overview
          </span>
          <Link className="nav-link" href="/events">
            <CalendarDays size={15} /> Calendar
          </Link>
          {selectedEvent && (
            <Link className="nav-link" href={parkingHref(selectedEvent)}>
              <Route size={15} /> Full map
            </Link>
          )}
        </nav>
        <span className="location-button" title={selectedEvent?.location}>
          <MapPin size={14} /> {selectedEvent ? selectedEvent.location : "No destination"}
        </span>
        <button type="button" className="profile-button" onClick={onSignOut} title="Sign out">
          <span>{initials(userName)}</span>
        </button>
        <Link className="mobile-menu" href="/events" aria-label="Open calendar">
          <Menu size={19} />
        </Link>
      </header>

      <main className="dashboard-content">
        <section className="dash-hero">
          <div>
            <div className="eyebrow">
              <span className="live-dot" /> synced with Google Calendar
            </div>
            <h1>
              Hi, <em>{userName ?? "there"}</em>
            </h1>
            <p>
              {selectedEvent
                ? `Closest parking to ${eventTitle(selectedEvent)}, ranked in the order to try it.`
                : "Pick a calendar event with a location and we'll find the closest parking."}
            </p>
          </div>
          <div className="hero-actions">
            <Link className="primary-button" href="/events">
              <CalendarDays size={16} /> View calendar
            </Link>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="left-column">
            <div className="section-header">
              <div>
                <span className="section-label">UP NEXT</span>
                <h2>Events with a location</h2>
              </div>
              <Link className="view-all" href="/events">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="event-list">
              {eventsLoading ? (
                <p className="empty-note">Loading your calendar…</p>
              ) : eventsError ? (
                <p className="empty-note">
                  {eventsError} <a href="/api/auth/google">Sign in again</a>
                </p>
              ) : events.length === 0 ? (
                <p className="empty-note">
                  None of your upcoming events have a location. Add one in Google Calendar and it will show up here.
                </p>
              ) : (
                events.map((event, index) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    tone={toneFor(index)}
                    selected={selectedEvent?.id === event.id}
                    onClick={() => selectEvent(event)}
                  />
                ))
              )}
            </div>

            <div className="section-header path-header">
              <div>
                <span className="section-label">SMART ROUTE</span>
                <h2>Parking stops</h2>
                <p className="sub-copy">Drag to reorder your route</p>
              </div>
            </div>
            <div className="sort-bar">
              <span>Rank by</span>
              <SortButton active={sortMode === "route"} onClick={() => setSortMode("route")} icon={<Sparkles size={13} />}>
                Suggested route
              </SortButton>
              <SortButton active={sortMode === "nearest"} onClick={() => setSortMode("nearest")} icon={<Navigation size={13} />}>
                Nearest
              </SortButton>
              <SortButton active={sortMode === "cheapest"} onClick={() => setSortMode("cheapest")} icon={<Star size={13} />}>
                Cheapest
              </SortButton>
            </div>
            <div className="route-summary">
              <span className="summary-icon">
                <Timer size={17} />
              </span>
              <div>
                <span>Drive through all stops</span>
                <strong>{lastSpot && origin ? formatDuration(lastSpot.cumulativeDriveSeconds) : "—"}</strong>
              </div>
              <i />
              <div>
                <span>Event starts</span>
                <strong>{eventStart ? formatClock(eventStart) : "—"}</strong>
              </div>
              <Info size={14} className="summary-info" />
            </div>
            <div className="spots-list">
              {parkingStatus ? (
                <p className="empty-note">{parkingStatus}</p>
              ) : (
                spots.map((spot, index) => (
                  <SpotRow
                    key={spot.id}
                    spot={spot}
                    index={index}
                    selected={selectedSpot?.id === spot.id}
                    dropTarget={dragTargetIndex === index}
                    costLabel={costLabel(spot)}
                    onSelect={setSelectedSpotId}
                    onDragStart={startDragging}
                    onDragOver={dragOver}
                    onDrop={reorder}
                    onDragEnd={() => {
                      setDragSourceIndex(null);
                      setDragTargetIndex(null);
                    }}
                  />
                ))
              )}
            </div>
            {tourLink && (
              <>
                <a className="save-button" href={tourLink} target="_blank" rel="noreferrer">
                  <ExternalLink size={17} /> Open this route in Google Maps
                </a>
                <div className="share-row">
                  <span>
                    <Check size={14} /> {Math.min(spots.length, MAX_STOPS)} stops in order
                  </span>
                  <button type="button" onClick={copyLink}>
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied!" : "Copy link"}
                  </button>
                </div>
                {routeSaveError && <p className="empty-note">{routeSaveError}</p>}
              </>
            )}
          </div>

          <div className="right-column">
            <div className="map-card">
              <div className="map-toolbar">
                <div className="map-heading">
                  <div>
                    <strong>{destination?.name ?? (selectedEvent ? eventTitle(selectedEvent) : "Route preview")}</strong>
                    <span>{destination?.address ?? selectedEvent?.location ?? "Pick an event with a location"}</span>
                  </div>
                </div>
                {selectedEvent && (
                  <Link className="map-tool" href={parkingHref(selectedEvent)}>
                    <Maximize2 size={15} /> Full map
                  </Link>
                )}
              </div>
              <div className="map-live">
                <ParkingMap
                  className="map-live-canvas"
                  destination={destination}
                  spots={mapSpots}
                  selectedSpotId={selectedSpot?.id ?? null}
                  onSelectSpot={setSelectedSpotId}
                  onLocation={setOrigin}
                  onLocationError={setLocationError}
                />
                {parkingStatus && <div className="map-status">{parkingStatus}</div>}
                {locationError && !parkingStatus && <div className="map-status map-status-warn">{locationError}</div>}
              </div>
            </div>

            <div className="arrival-card">
              <div className="arrival-title">
                <div>
                  <span>YOUR DESTINATION</span>
                  <strong>{destination?.name ?? selectedEvent?.location ?? "—"}</strong>
                </div>
                {selectedEvent?.htmlLink && (
                  <a href={selectedEvent.htmlLink} target="_blank" rel="noreferrer" className="more-icon" title="Open in Google Calendar">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
              <div className="arrival-stats">
                <div>
                  <span>Drive to {selectedSpot ? `stop ${spots.indexOf(selectedSpot) + 1}` : "first stop"}</span>
                  <strong>{selectedSpot && origin ? formatDuration(selectedSpot.cumulativeDriveSeconds) : "—"}</strong>
                </div>
                <div>
                  <span>Walk to destination</span>
                  <strong>{selectedSpot ? formatDuration(selectedSpot.walkSeconds) : "—"}</strong>
                </div>
                <div>
                  <span>Leave by</span>
                  <strong>{leaveBy ? formatClock(leaveBy) : "—"}</strong>
                </div>
              </div>
              <div className="arrival-note">
                <span>
                  {selectedSpot && selectedEvent ? (
                    <>
                      Park at <strong>{selectedSpot.name}</strong> and walk{" "}
                      {formatDuration(selectedSpot.walkSeconds)} to {eventTitle(selectedEvent)}.
                    </>
                  ) : origin ? (
                    "Select a parking stop to see when to leave."
                  ) : (
                    "Allow location access to get drive times and a leave-by time."
                  )}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="dash-footer">
        <span>
          <ParkingCircle size={14} /> CVision
        </span>
        <button type="button" onClick={onSignOut}>
          Sign out
        </button>
        <span>
          <Clock3 size={13} /> Times are estimates from straight-line distance.
          <CircleHelp size={13} />
        </span>
      </footer>
    </div>
  );
}

export default function ParkwiseApp({
  initialSignedIn = false,
  userName,
}: {
  initialSignedIn?: boolean;
  userName?: string;
}) {
  const [signedIn, setSignedIn] = useState(initialSignedIn);
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setSignedIn(false);
    window.location.replace("/");
  };

  return signedIn ? <Dashboard onSignOut={signOut} userName={userName} /> : <SignIn />;
}
