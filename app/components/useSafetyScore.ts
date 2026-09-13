"use client";

import { useEffect, useState } from "react";
import type { SafetyScore } from "@/lib/types";

type SafetySubject = {
  id: string;
  name: string;
  address: string;
  source: "google_places" | "tfnsw_carpark";
};

type State = {
  id: string | null;
  status: "idle" | "loading" | "done";
  safety: SafetyScore | null;
};

// Module-level so it survives re-renders and is shared across components -
// same reasoning as the server-side cache in lib/parking/safety.ts.
const cache = new Map<string, SafetyScore>();

/** Fetches an AI safety score for one spot, on demand, only when it's selected. */
export function useSafetyScore(subject: SafetySubject | null) {
  const currentId = subject?.id ?? null;
  const [state, setState] = useState<State>({ id: null, status: "idle", safety: null });

  // Reset synchronously during render when the selected subject changes -
  // this is a pure derivation from the cache, not an async operation, so it
  // belongs here rather than in the effect below.
  if (state.id !== currentId) {
    const cached = currentId ? cache.get(currentId) : undefined;
    setState({
      id: currentId,
      status: currentId ? (cached ? "done" : "loading") : "idle",
      safety: cached ?? null,
    });
  }

  useEffect(() => {
    // Nothing to fetch: no subject, or already resolved synchronously above.
    if (!subject || cache.has(subject.id)) return;

    const controller = new AbortController();

    const params = new URLSearchParams({
      id: subject.id,
      name: subject.name,
      address: subject.address,
      source: subject.source,
    });

    fetch(`/api/parking/safety?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((body: { safety?: SafetyScore }) => {
        if (controller.signal.aborted) return;
        const safety = body.safety ?? null;
        if (safety) cache.set(subject.id, safety);
        setState({ id: subject.id, status: "done", safety });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ id: subject.id, status: "done", safety: null });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- primitives from subject, not subject itself
  }, [subject?.id, subject?.name, subject?.address, subject?.source]);

  return {
    safety: state.id === currentId ? state.safety : null,
    loading: state.id === currentId && state.status === "loading",
  };
}
