"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Maximize2, Minus } from "lucide-react";
import ParkingMap, { type MapSpot } from "../components/ParkingMap";
import { useParkingRoute, type DestinationQuery } from "../components/useParkingRoute";
import {
  formatClock,
  formatDistance,
  formatDuration,
  priceOrAvailability,
  spotPopupHtml,
} from "../components/parkingFormat";
import { MAX_STOPS, buildGoogleMapsLink } from "@/src/lib/googleMapsLink";
import { annotateRoute } from "@/lib/parking/route";
import type { RoutedParkingSpot } from "@/lib/parking/route";

// Used when the page is opened without an event, so it still shows something.
const DEFAULT_DESTINATION: DestinationQuery = {
  name: "The University of Sydney Law School",
  lat: -33.8875005,
  lng: 151.1907605,
};

/**
 * Accepts either `?location=<text>&name=<title>[&start=<iso>]` from the
 * events pages, or raw `?lat=&lng=&name=` coordinates.
 */
function parseQuery(params: URLSearchParams): { query: DestinationQuery; start: Date | null } {
  const startParam = params.get("start");
  const startDate = startParam ? new Date(startParam) : null;
  const start = startDate && !Number.isNaN(startDate.getTime()) ? startDate : null;

  const location = params.get("location")?.trim();
  if (location) {
    return { query: { address: location, name: params.get("name")?.trim() || undefined }, start };
  }
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (params.has("lat") && params.has("lng") && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { query: { lat, lng, name: params.get("name")?.trim() || "Destination" }, start };
  }
  return { query: DEFAULT_DESTINATION, start };
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <MapView />
    </Suspense>
  );
}

function MapView() {
  const params = useSearchParams();
  const { query, start } = useMemo(() => parseQuery(params), [params]);
  const { destination, routed, loading, error, origin, setOrigin } = useParkingRoute(query);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locationError, setLocationError] = useState("");
  const [sortMode, setSortMode] = useState<"route" | "nearest" | "cheapest" | "custom">("route");
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [dragSource, setDragSource] = useState<number | null>(null);
  const [dragTarget, setDragTarget] = useState<number | null>(null);
  const [drawerMinimized, setDrawerMinimized] = useState(false);

  const title = destination?.name ?? query.name ?? ("address" in query ? query.address : "Destination");
  const spots = useMemo<RoutedParkingSpot<(typeof routed)[number]>[]>(() => {
    const list = [...routed];
    if (sortMode === "nearest") list.sort((a, b) => a.distanceMeters - b.distanceMeters);
    if (sortMode === "cheapest") {
      list.sort((a, b) => (a.estimatedPricePerHour ?? Infinity) - (b.estimatedPricePerHour ?? Infinity));
    }
    if (sortMode === "custom") {
      const rank = new Map(customOrder.map((id, index) => [id, index]));
      list.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
    }
    return destination ? annotateRoute(origin ?? destination, destination, list) : list;
  }, [routed, sortMode, customOrder, origin, destination]);

  const selected = spots.find((spot) => spot.id === selectedId) ?? null;

  const mapSpots = useMemo<MapSpot[]>(
    () =>
      spots.map((spot, index) => ({
        id: spot.id,
        lat: spot.lat,
        lng: spot.lng,
        popupHtml: spotPopupHtml(spot, index, title),
      })),
    [spots, title],
  );

  const tour = useMemo(() => {
    if (spots.length < 2) return null;
    const stops = spots.slice(0, MAX_STOPS);
    return { link: buildGoogleMapsLink(stops), stops: stops.length };
  }, [spots]);

  const leaveBy =
    start && origin && selected
      ? new Date(start.getTime() - (selected.cumulativeDriveSeconds + selected.walkSeconds) * 1000)
      : null;

  const banner = error || locationError;
  const reorder = (targetIndex: number) => {
    if (dragSource === null || dragSource === targetIndex) return;
    const next = spots.map((spot) => spot.id);
    const [moved] = next.splice(dragSource, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    setCustomOrder(next);
    setSortMode("custom");
    setDragSource(null);
    setDragTarget(null);
  };

  return (
    <main className="map-page">
      <ParkingMap
        className="map-full-canvas"
        destination={destination}
        spots={mapSpots}
        selectedSpotId={selectedId}
        onSelectSpot={setSelectedId}
        onLocation={setOrigin}
        onLocationError={setLocationError}
      />

      {banner && (
        <p className="map-banner">
          {banner}
        </p>
      )}

      <div className={`map-drawer ${drawerMinimized ? "minimized" : ""}`}>
        <div className="map-drawer-head">
          <div className="map-drawer-topline">
            <p className="map-overline">CVISION ROUTE</p>
            <div className="map-drawer-actions">
              <Link href="/" className="map-back">← Dashboard</Link>
              <button type="button" className="map-minimize" onClick={() => setDrawerMinimized((current) => !current)} aria-label={drawerMinimized ? "Expand route panel" : "Minimize route panel"} title={drawerMinimized ? "Expand route panel" : "Minimize route panel"}>
                {drawerMinimized ? <Maximize2 size={14} strokeWidth={2.25} aria-hidden="true" /> : <Minus size={16} strokeWidth={2.25} aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div className="map-drawer-title-row">
            <h1>Parking near {title}</h1>
          </div>
          {!drawerMinimized && <>
            {destination?.address && <p className="map-address">{destination.address}</p>}
            <p className="map-summary">
              {loading
                ? "Finding nearby parking…"
                : `${spots.length} spot${spots.length === 1 ? "" : "s"} in try-order`}
              {start && ` · starts ${formatClock(start)}`}
              {leaveBy && ` · leave by ${formatClock(leaveBy)}`}
            </p>
            <div className="map-filters" aria-label="Route filters">
              <span>Rank by</span>
              <button type="button" className={sortMode === "route" ? "active" : ""} onClick={() => setSortMode("route")}>Suggested</button>
              <button type="button" className={sortMode === "nearest" ? "active" : ""} onClick={() => setSortMode("nearest")}>Nearest</button>
              <button type="button" className={sortMode === "cheapest" ? "active" : ""} onClick={() => setSortMode("cheapest")}>Cheapest</button>
            </div>
            {tour && (
              <a href={tour.link} target="_blank" rel="noreferrer" className="map-tour">
                Route through {tour.stops} spots in order
              </a>
            )}
          </>}
        </div>

        {!drawerMinimized && <ul className="map-stop-list">
          {spots.map((spot, index) => (
            <li
              key={spot.id}
              className={`map-stop ${selectedId === spot.id ? "selected" : ""}`}
              draggable
              onDragStart={() => setDragSource(index)}
              onDragOver={(event) => { event.preventDefault(); setDragTarget(index); }}
              onDrop={(event) => { event.preventDefault(); reorder(index); }}
              onDragEnd={() => { setDragSource(null); setDragTarget(null); }}
            >
              <span className={`map-drag ${dragTarget === index ? "target" : ""}`} aria-hidden="true">⋮⋮</span>
              <button
                type="button"
                onClick={() => setSelectedId(spot.id)}
                className="map-stop-details"
              >
                <span className="map-stop-name">
                  {index + 1}. {spot.name}
                </span>
                <span className="map-stop-meta">
                  {formatDuration(spot.walkSeconds)} walk ·{" "}
                  {formatDuration(spot.cumulativeDriveSeconds)} drive ·{" "}
                  {formatDistance(spot.distanceMeters)}
                </span>
                <span className="map-stop-meta">
                  {priceOrAvailability(spot)}
                  {spot.rating !== null && ` · ★ ${spot.rating}`}
                  {spot.isOpenNow === false && " · closed"}
                </span>
              </button>
              <a
                href={buildGoogleMapsLink([{ lat: spot.lat, lng: spot.lng }])}
                target="_blank"
                rel="noreferrer"
                className="map-directions"
              >
                Directions
              </a>
            </li>
          ))}
        </ul>}
      </div>
    </main>
  );
}
