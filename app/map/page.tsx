"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import ParkingMap, { type MapSpot } from "../components/ParkingMap";
import { useParkingRoute, type DestinationQuery } from "../components/useParkingRoute";
import { formatClock, formatDistance, formatDuration, spotPopupHtml } from "../components/parkingFormat";
import { MAX_STOPS, buildGoogleMapsLink } from "@/src/lib/googleMapsLink";

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

  const title = destination?.name ?? query.name ?? ("address" in query ? query.address : "Destination");
  const selected = routed.find((spot) => spot.id === selectedId) ?? null;

  const mapSpots = useMemo<MapSpot[]>(
    () =>
      routed.map((spot, index) => ({
        id: spot.id,
        lat: spot.lat,
        lng: spot.lng,
        popupHtml: spotPopupHtml(spot, index, title),
      })),
    [routed, title],
  );

  const tour = useMemo(() => {
    if (routed.length < 2) return null;
    const stops = routed.slice(0, MAX_STOPS);
    return { link: buildGoogleMapsLink(stops), stops: stops.length };
  }, [routed]);

  const leaveBy =
    start && origin && selected
      ? new Date(start.getTime() - (selected.cumulativeDriveSeconds + selected.walkSeconds) * 1000)
      : null;

  const banner = error || locationError;

  return (
    <>
      <ParkingMap
        className="h-dvh"
        destination={destination}
        spots={mapSpots}
        selectedSpotId={selectedId}
        onSelectSpot={setSelectedId}
        onLocation={setOrigin}
        onLocationError={setLocationError}
      />

      <Link
        href="/"
        className="absolute top-3 right-3 z-1000 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#7a3040] shadow"
      >
        ← Dashboard
      </Link>

      {banner && (
        <p className="absolute inset-x-0 top-0 z-1000 bg-red-600 p-2 text-center text-sm text-white">
          {banner}
        </p>
      )}

      <div className="absolute inset-x-0 bottom-0 z-1000 max-h-[45dvh] overflow-y-auto rounded-t-xl bg-white shadow-[0_-2px_10px_rgba(0,0,0,.2)]">
        <div className="sticky top-0 border-b bg-white px-4 py-3">
          <h1 className="text-sm font-semibold">Parking near {title}</h1>
          {destination?.address && <p className="truncate text-xs text-gray-500">{destination.address}</p>}
          <p className="text-xs text-gray-500">
            {loading
              ? "Finding nearby parking…"
              : `${routed.length} spot${routed.length === 1 ? "" : "s"} in try-order`}
            {start && ` · starts ${formatClock(start)}`}
            {leaveBy && ` · leave by ${formatClock(leaveBy)}`}
          </p>
          {tour && (
            <a
              href={tour.link}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block rounded-md bg-gray-900 px-3 py-2 text-center text-xs font-medium text-white"
            >
              Route through {tour.stops} spots in order
            </a>
          )}
        </div>

        <ul className="divide-y">
          {routed.map((spot, index) => (
            <li
              key={spot.id}
              className={`flex items-center gap-3 px-4 py-3 ${selectedId === spot.id ? "bg-[#f9f1ec]" : ""}`}
            >
              <button
                type="button"
                onClick={() => setSelectedId(spot.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-medium">
                  {index + 1}. {spot.name}
                </span>
                <span className="block truncate text-xs text-gray-500">
                  {formatDuration(spot.walkSeconds)} walk ·{" "}
                  {formatDuration(spot.cumulativeDriveSeconds)} drive ·{" "}
                  {formatDistance(spot.distanceMeters)}
                </span>
                <span className="block truncate text-xs text-gray-500">
                  ~${spot.estimatedPricePerHour.toFixed(2)}/hr est.
                  {spot.rating !== null && ` · ★ ${spot.rating}`}
                  {spot.isOpenNow === false && " · closed"}
                </span>
              </button>
              <a
                href={buildGoogleMapsLink([{ lat: spot.lat, lng: spot.lng }])}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
              >
                Directions
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
