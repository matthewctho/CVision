"use client";

import { useEffect, useRef, useState } from "react";
import type { Circle, Map as LeafletMap, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import { escapeHtml } from "./parkingFormat";

type Leaflet = typeof import("leaflet");
type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

export type MapPoint = { lat: number; lng: number };
export type MapDestination = MapPoint & { name: string };
export type MapSpot = MapPoint & { id: string; popupHtml: string };

type Props = {
  destination: MapDestination | null;
  /** Markers are numbered in array order — pass them in try-order. */
  spots: MapSpot[];
  selectedSpotId?: string | null;
  onSelectSpot?: (id: string) => void;
  /** Fired on every GPS fix; callers decide whether to keep the first only. */
  onLocation?: (point: MapPoint) => void;
  onLocationError?: (message: string) => void;
  className?: string;
};

const DESTINATION_ICON_HTML =
  '<div style="width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;' +
  'background:#d93025;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></div>';

const ROUTE_CAR_HTML =
  '<div style="width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;' +
  'background:#7a3040;border:3px solid #fff;box-shadow:0 2px 8px rgba(59,31,37,.35);' +
  'color:#fff;font:700 13px/18px system-ui,sans-serif;text-align:center">●</div>';

function spotIconHtml(label: number, selected: boolean): string {
  const size = selected ? 28 : 22;
  const background = selected ? "#7a3040" : "#1a73e8";
  return (
    `<div style="width:${size}px;height:${size}px;margin:-${size / 2}px 0 0 -${size / 2}px;border-radius:5px;` +
    `background:${background};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);` +
    `color:#fff;font:700 13px/${size - 4}px system-ui,sans-serif;text-align:center">${label}</div>`
  );
}

/**
 * Live OpenStreetMap view of the destination, the numbered parking spots to
 * try in order, and the driver's own position with a heading beam.
 */
export default function ParkingMap({
  destination,
  spots,
  selectedSpotId = null,
  onSelectSpot,
  onLocation,
  onLocationError,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [leaflet, setLeaflet] = useState<{ L: Leaflet; map: LeafletMap } | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const destinationMarkerRef = useRef<Marker | null>(null);
  const routeLineRef = useRef<Polyline | null>(null);
  const routeCarRef = useRef<Marker | null>(null);
  const routeAnimationRef = useRef<number | null>(null);
  const routeRequestRef = useRef<AbortController | null>(null);
  const fittedKeyRef = useRef("");
  const initialDestinationRef = useRef(destination);

  // Callbacks live in refs so the map is only ever built once.
  const onSelectRef = useRef(onSelectSpot);
  const onLocationRef = useRef(onLocation);
  const onLocationErrorRef = useRef(onLocationError);
  useEffect(() => {
    onSelectRef.current = onSelectSpot;
    onLocationRef.current = onLocation;
    onLocationErrorRef.current = onLocationError;
  });

  useEffect(() => {
    let instance: LeafletMap | undefined;
    let cancelled = false;
    let onCompass: ((e: DeviceOrientationEvent) => void) | undefined;
    let observer: ResizeObserver | undefined;
    const markers = markersRef.current;

    import("leaflet").then((L) => {
      if (cancelled || !ref.current) return;

      const start = initialDestinationRef.current;
      const m = L.map(ref.current);
      if (start) m.setView([start.lat, start.lng], 16);
      else m.setView([0, 0], 2);
      instance = m;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(m);

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
        onLocationErrorRef.current?.("");
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
        onLocationRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        // The view stays on the destination — that's what the parking is for.
        // GPS heading only exists while actually moving.
        if (Number.isFinite(e.heading)) {
          gpsHeadingAt = Date.now();
          point(e.heading);
        }
      });

      m.on("locationerror", (e) => onLocationErrorRef.current?.(e.message));
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

      // The card can be laid out after the map is built (web fonts, grid
      // reflow, a phone rotating), and Leaflet only listens to the window.
      // Re-measure whenever the container itself changes size.
      observer = new ResizeObserver(() => m.invalidateSize());
      observer.observe(ref.current);
      requestAnimationFrame(() => m.invalidateSize());

      setLeaflet({ L, map: m });
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (onCompass) {
        removeEventListener("deviceorientationabsolute", onCompass);
        removeEventListener("deviceorientation", onCompass);
      }
      setLeaflet(null);
      markers.clear();
      destinationMarkerRef.current = null;
      routeLineRef.current = null;
      routeCarRef.current = null;
      if (routeAnimationRef.current !== null) cancelAnimationFrame(routeAnimationRef.current);
      routeRequestRef.current?.abort();
      instance?.stopLocate();
      instance?.remove();
    };
  }, []);

  // Destination pin. Re-centres when the event changes.
  const destinationLat = destination?.lat;
  const destinationLng = destination?.lng;
  const destinationName = destination?.name;
  useEffect(() => {
    if (!leaflet) return;
    const { L, map } = leaflet;
    destinationMarkerRef.current?.remove();
    destinationMarkerRef.current = null;
    if (destinationLat === undefined || destinationLng === undefined) return;

    destinationMarkerRef.current = L.marker([destinationLat, destinationLng], {
      icon: L.divIcon({ className: "", html: DESTINATION_ICON_HTML, iconSize: [0, 0] }),
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindPopup(`<b>${escapeHtml(destinationName ?? "Destination")}</b><br>Destination`);
    map.setView([destinationLat, destinationLng], 16);
  }, [leaflet, destinationLat, destinationLng, destinationName]);

  // Draw the current try-order and animate a car along every leg whenever the
  // selected event or parking order changes.
  useEffect(() => {
    if (!leaflet) return;
    const { L, map } = leaflet;
    routeLineRef.current?.remove();
    routeCarRef.current?.remove();
    routeLineRef.current = null;
    routeCarRef.current = null;
    if (routeAnimationRef.current !== null) cancelAnimationFrame(routeAnimationRef.current);
    routeAnimationRef.current = null;

    const points: [number, number][] = spots.map((spot) => [spot.lat, spot.lng]);
    if (destinationLat !== undefined && destinationLng !== undefined) {
      points.push([destinationLat, destinationLng]);
    }
    if (points.length < 2) return;

    const controller = new AbortController();
    routeRequestRef.current = controller;
    fetch("/api/parking/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: points.map(([lat, lng]) => ({ lat, lng })) }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as { coordinates?: [number, number][]; error?: string };
        if (!response.ok || !data.coordinates) throw new Error(data.error ?? "Could not load the road route.");
        return data.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      })
      .then((roadPoints) => {
        if (controller.signal.aborted) return;
        routeLineRef.current = L.polyline(roadPoints, {
          color: "#7a3040",
          weight: 4,
          opacity: 0.8,
          dashArray: "8 7",
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);

        const routeCar = L.marker(roadPoints[0], {
          icon: L.divIcon({ className: "", html: ROUTE_CAR_HTML, iconSize: [0, 0] }),
          interactive: false,
          zIndexOffset: 1500,
        }).addTo(map);
        routeCarRef.current = routeCar;

        const segmentLengths = roadPoints.slice(1).map((point, index) => {
          const previous = roadPoints[index];
          return Math.hypot(point[0] - previous[0], point[1] - previous[1]);
        });
        const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
        const startedAt = performance.now();
        const duration = Math.min(5200, Math.max(2200, totalLength * 90000));

        const animate = (now: number) => {
          const progress = Math.min((now - startedAt) / duration, 1);
          const distance = progress * totalLength;
          let travelled = 0;
          let segmentIndex = 0;
          while (segmentIndex < segmentLengths.length - 1 && travelled + segmentLengths[segmentIndex] < distance) {
            travelled += segmentLengths[segmentIndex];
            segmentIndex += 1;
          }
          const segmentProgress = segmentLengths[segmentIndex] === 0 ? 1 : (distance - travelled) / segmentLengths[segmentIndex];
          const start = roadPoints[segmentIndex];
          const end = roadPoints[segmentIndex + 1];
          routeCar.setLatLng([
            start[0] + (end[0] - start[0]) * segmentProgress,
            start[1] + (end[1] - start[1]) * segmentProgress,
          ]);
          if (progress < 1) routeAnimationRef.current = requestAnimationFrame(animate);
          else routeAnimationRef.current = null;
        };
        routeAnimationRef.current = requestAnimationFrame(animate);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error("Road route overlay failed:", error);
      });

    return () => {
      controller.abort();
      if (routeAnimationRef.current !== null) cancelAnimationFrame(routeAnimationRef.current);
      routeAnimationRef.current = null;
      routeLineRef.current?.remove();
      routeCarRef.current?.remove();
      routeLineRef.current = null;
      routeCarRef.current = null;
    };
  }, [leaflet, spots, destinationLat, destinationLng]);

  // Numbered spot markers. Cheap enough to rebuild whenever order or
  // selection changes; the selected one is drawn larger and in brand colour.
  useEffect(() => {
    if (!leaflet) return;
    const { L, map } = leaflet;
    const markers = markersRef.current;

    for (const marker of markers.values()) marker.remove();
    markers.clear();

    spots.forEach((spot, index) => {
      const marker = L.marker([spot.lat, spot.lng], {
        icon: L.divIcon({
          className: "",
          html: spotIconHtml(index + 1, spot.id === selectedSpotId),
          iconSize: [0, 0],
        }),
        zIndexOffset: spot.id === selectedSpotId ? 500 : 0,
      })
        .addTo(map)
        .bindPopup(spot.popupHtml)
        .on("click", () => onSelectRef.current?.(spot.id));
      markers.set(spot.id, marker);
    });

    // Fit everything in view once per distinct set of places, not on every
    // reorder or selection — that would yank the map around under the user.
    const fitKey =
      `${destinationLat ?? ""},${destinationLng ?? ""}|` +
      spots.map((spot) => spot.id).sort().join(",");
    const justFitted = spots.length > 0 && fitKey !== fittedKeyRef.current;
    if (justFitted) {
      fittedKeyRef.current = fitKey;
      const points: [number, number][] = spots.map((spot) => [spot.lat, spot.lng]);
      if (destinationLat !== undefined && destinationLng !== undefined) {
        points.push([destinationLat, destinationLng]);
      }
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17 });
    }

  }, [leaflet, spots, selectedSpotId, destinationLat, destinationLng]);

  return <div ref={ref} className={className} />;
}
