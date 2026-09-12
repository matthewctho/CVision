"use client";

import { useEffect, useRef, useState } from "react";
import type { Circle, Map as LeafletMap, Marker } from "leaflet";
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

    // Straight after a fit the view is still settling, so a popup's auto-pan
    // would fight it and can land half off-screen; the overview is what the
    // user wants at that moment anyway.
    if (selectedSpotId && !justFitted) markers.get(selectedSpotId)?.openPopup();
  }, [leaflet, spots, selectedSpotId, destinationLat, destinationLng]);

  return <div ref={ref} className={className} />;
}
