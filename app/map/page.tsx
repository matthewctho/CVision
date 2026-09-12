"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Circle, Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ParkingCandidate } from "@/lib/types";
import { MAX_STOPS, buildGoogleMapsLink } from "@/src/lib/googleMapsLink";
import { routeParkingSpots, type RoutedParkingSpot } from "@/lib/parking/route";

type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

// Hardcoded until the app takes a real destination from the user.
const DESTINATION = {
  name: "The University of Sydney Law School",
  lat: -33.8875005,
  lng: 151.1907605,
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? "<1 min" : `${minutes} min`;
}

export default function MapPage() {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [candidates, setCandidates] = useState<ParkingCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const markersRef = useRef(new Map<string, Marker>());

  useEffect(() => {
    let instance: LeafletMap | undefined;
    let cancelled = false;
    let onCompass: ((e: DeviceOrientationEvent) => void) | undefined;

    import("leaflet").then((L) => {
      if (cancelled) return;

      const m = L.map(ref.current!).setView([DESTINATION.lat, DESTINATION.lng], 16);
      instance = m;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(m);

      L.marker([DESTINATION.lat, DESTINATION.lng], {
        icon: L.divIcon({
          className: "",
          html:
            '<div style="width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;' +
            'background:#d93025;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></div>',
          iconSize: [0, 0],
        }),
      })
        .addTo(m)
        .bindPopup(`<b>${DESTINATION.name}</b><br>Destination`);

      const icon = L.divIcon({
        className: "",
        html: '<div class="cv-beam"></div><div class="cv-dot"></div>',
        iconSize: [0, 0],
      });
      let dot: Marker | undefined;
      let ring: Circle | undefined;
      let gpsHeadingAt = 0;

      const point = (deg: number) => {
        const beam = dot?.getElement()?.firstElementChild as HTMLElement | null;
        if (!beam) return;
        beam.style.transform = `rotate(${deg}deg)`;
        beam.style.opacity = "1";
      };

      m.on("locationfound", (e) => {
        setError("");
        if (dot && ring) {
          dot.setLatLng(e.latlng);
          ring.setLatLng(e.latlng).setRadius(e.accuracy);
        } else {
          dot = L.marker(e.latlng, { icon, interactive: false }).addTo(m);
          ring = L.circle(e.latlng, {
            radius: e.accuracy,
            interactive: false,
            color: "#1a73e8",
            weight: 1,
            fillOpacity: 0.12,
          }).addTo(m);
        }
        // First fix only: re-ordering the route under the driver mid-drive
        // could point them back at a lot they have already passed.
        setOrigin((current) => current ?? { lat: e.latlng.lat, lng: e.latlng.lng });
        // The view stays on the destination — that's what the parking is for.
        // GPS heading only exists while actually moving.
        if (Number.isFinite(e.heading)) {
          gpsHeadingAt = Date.now();
          point(e.heading);
        }
      });

      m.on("locationerror", (e) => setError(e.message));
      m.locate({ watch: true, enableHighAccuracy: true });

      onCompass = (e) => {
        if (Date.now() - gpsHeadingAt < 5000) return;
        const c = e as CompassEvent;
        const heading =
          c.webkitCompassHeading ??
          (c.absolute && c.alpha !== null ? 360 - c.alpha : undefined);
        if (heading !== undefined) point(heading);
      };
      addEventListener("deviceorientationabsolute", onCompass);
      addEventListener("deviceorientation", onCompass);

      // iOS only hands out compass data after a request tied to a user gesture.
      const ask = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      if (ask.requestPermission) {
        m.once("click", () => ask.requestPermission?.().catch(() => {}));
      }

      setMap(m);
    });

    return () => {
      cancelled = true;
      if (onCompass) {
        removeEventListener("deviceorientationabsolute", onCompass);
        removeEventListener("deviceorientation", onCompass);
      }
      setMap(null);
      instance?.stopLocate();
      instance?.remove();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/parking?lat=${DESTINATION.lat}&lng=${DESTINATION.lng}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
        setCandidates(body.candidates ?? []);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load parking");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  // Before the first GPS fix, score as though the driver were arriving at the
  // destination — the walk term dominates anyway, so the list is still sane.
  const routed = useMemo(
    () => routeParkingSpots(origin ?? DESTINATION, DESTINATION, candidates),
    [origin, candidates],
  );

  useEffect(() => {
    if (!map || routed.length === 0) return;
    let cancelled = false;
    const markers = markersRef.current;

    import("leaflet").then((L) => {
      if (cancelled) return;

      for (const [index, spot] of routed.entries()) {
        const marker = L.marker([spot.lat, spot.lng], {
          icon: L.divIcon({
            className: "",
            html:
              '<div style="width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:4px;' +
              "background:#1a73e8;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);" +
              'color:#fff;font:700 13px/18px system-ui,sans-serif;text-align:center">' +
              `${index + 1}</div>`,
            iconSize: [0, 0],
          }),
        })
          .addTo(map)
          .bindPopup(
            `<b>${index + 1}. ${escapeHtml(spot.name)}</b>` +
              `<br>${formatDuration(spot.walkSeconds)} walk to ${escapeHtml(DESTINATION.name)}` +
              `<br>${formatDuration(spot.cumulativeDriveSeconds)} drive to get here` +
              `<br>~$${spot.estimatedPricePerHour.toFixed(2)}/hr (estimated)` +
              `<br><a href="${buildGoogleMapsLink([{ lat: spot.lat, lng: spot.lng }])}" ` +
              'target="_blank" rel="noreferrer">Directions</a>',
          );
        markers.set(spot.id, marker);
      }
    });

    return () => {
      cancelled = true;
      for (const marker of markers.values()) marker.remove();
      markers.clear();
    };
  }, [map, routed]);

  const tour = useMemo(() => {
    if (routed.length < 2) return null;
    const stops = routed.slice(0, MAX_STOPS);
    return { link: buildGoogleMapsLink(stops), stops: stops.length };
  }, [routed]);

  const focus = useCallback(
    (spot: RoutedParkingSpot<ParkingCandidate>) => {
      map?.setView([spot.lat, spot.lng], 18);
      markersRef.current.get(spot.id)?.openPopup();
    },
    [map],
  );

  return (
    <>
      <div ref={ref} className="h-dvh" />

      {error && (
        <p className="absolute inset-x-0 top-0 z-1000 bg-red-600 p-2 text-center text-sm text-white">
          {error}
        </p>
      )}

      <div className="absolute inset-x-0 bottom-0 z-1000 max-h-[45dvh] overflow-y-auto rounded-t-xl bg-white shadow-[0_-2px_10px_rgba(0,0,0,.2)]">
        <div className="sticky top-0 border-b bg-white px-4 py-3">
          <h1 className="text-sm font-semibold">Parking near {DESTINATION.name}</h1>
          <p className="text-xs text-gray-500">
            {loading
              ? "Finding nearby parking…"
              : `${routed.length} spot${routed.length === 1 ? "" : "s"} in try-order`}
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
            <li key={spot.id} className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => focus(spot)}
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
