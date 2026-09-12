"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Destination, ParkingCandidate, ParkingResponse } from "@/lib/types";
import { routeParkingSpots, type LatLng } from "@/lib/parking/route";

/** Either free text to geocode (an event's location) or known coordinates. */
export type DestinationQuery =
  | { address: string; name?: string }
  | { lat: number; lng: number; name: string };

/** Result of the most recent request, tagged with the query it answered. */
type Loaded = {
  key: string;
  destination: Destination | null;
  candidates: ParkingCandidate[];
  error: string;
};

/**
 * One request per distinct destination for the life of the page — flicking
 * between events shouldn't re-run a geocode plus a Places search each time.
 */
const cache = new Map<string, Promise<ParkingResponse>>();

const EMPTY: ParkingCandidate[] = [];

async function loadParking(query: DestinationQuery, signal: AbortSignal): Promise<ParkingResponse> {
  const params = new URLSearchParams(
    "address" in query
      ? { address: query.address }
      : { lat: String(query.lat), lng: String(query.lng), name: query.name },
  );
  const key = params.toString();

  let pending = cache.get(key);
  if (!pending) {
    pending = fetch(`/api/parking?${key}`).then(async (res) => {
      const body = (await res.json()) as Partial<ParkingResponse> & { error?: string };
      if (!res.ok || !body.destination) {
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      return { destination: body.destination, candidates: body.candidates ?? [] };
    });
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }

  const result = await pending;
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  return result;
}

/**
 * Finds parking around a destination and orders it into a try-order route
 * from wherever the driver is. The origin is fixed at the first GPS fix so
 * the order doesn't shuffle under someone already driving it.
 */
export function useParkingRoute(query: DestinationQuery | null) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [origin, setOriginState] = useState<LatLng | null>(null);

  // A serialised key keeps the effect stable across re-renders that build a
  // structurally equal query object, and tags results so a stale answer for
  // a previous event is never shown against the current one.
  const key = query ? JSON.stringify(query) : null;

  useEffect(() => {
    if (!key) return;
    const parsed = JSON.parse(key) as DestinationQuery;
    const controller = new AbortController();

    loadParking(parsed, controller.signal)
      .then(({ destination, candidates }) => {
        setLoaded({
          key,
          destination: { ...destination, name: parsed.name ?? destination.name },
          candidates,
          error: "",
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setLoaded({
          key,
          destination: null,
          candidates: [],
          error: err instanceof Error ? err.message : "Failed to load parking",
        });
      });

    return () => controller.abort();
  }, [key]);

  const setOrigin = useCallback((point: LatLng) => {
    setOriginState((current) => current ?? point);
  }, []);

  const current = key !== null && loaded?.key === key ? loaded : null;
  const destination = current?.destination ?? null;
  const candidates = current?.candidates ?? EMPTY;
  const error = current?.error ?? "";
  const loading = key !== null && current === null;

  // Before the first GPS fix, score as though the driver were arriving at the
  // destination — the walk term dominates anyway, so the list is still sane.
  const routed = useMemo(
    () => (destination ? routeParkingSpots(origin ?? destination, destination, candidates) : []),
    [origin, destination, candidates],
  );

  return { destination, candidates, routed, loading, error, origin, setOrigin };
}
