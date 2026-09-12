"use client";

import { useEffect, useRef, useState } from "react";
import type { Circle, Map, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

export default function MapPage() {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let map: Map | undefined;
    let cancelled = false;
    let onCompass: ((e: DeviceOrientationEvent) => void) | undefined;

    import("leaflet").then((L) => {
      if (cancelled) return;

      const m = L.map(ref.current!).setView([37.7749, -122.4194], 13);
      map = m;
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
      let centered = false;
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
        if (!centered) {
          m.setView(e.latlng, 17);
          centered = true;
        }
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
    });

    return () => {
      cancelled = true;
      if (onCompass) {
        removeEventListener("deviceorientationabsolute", onCompass);
        removeEventListener("deviceorientation", onCompass);
      }
      map?.stopLocate();
      map?.remove();
    };
  }, []);

  return (
    <>
      <div ref={ref} className="h-dvh" />
      {error && (
        <p className="absolute inset-x-0 top-0 z-1000 bg-red-600 p-2 text-center text-sm text-white">
          {error}
        </p>
      )}
    </>
  );
}
