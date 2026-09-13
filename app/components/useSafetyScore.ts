"use client";

import { useEffect, useState } from "react";
import type { SafetyScore } from "@/lib/types";

type SafetySubject = {
  id: string;
  name: string;
  address: string;
  source: "google_places" | "tfnsw_carpark";
};

// Module-level so it survives re-renders and is shared across components -
// same reasoning as the server-side cache in lib/parking/safety.ts.
const cache = new Map<string, SafetyScore>();

/**
 * Fetches AI safety scores for a whole list of spots at once, keyed by id.
 * Needed at the list level (not per-row) so "rank by safety" can sort on a
 * score before any single row has been selected or rendered individually.
 */
export function useSafetyScores(subjects: SafetySubject[]): Record<string, SafetyScore> {
  const [, setVersion] = useState(0);
  const key = subjects.map((s) => s.id).join(",");

  useEffect(() => {
    const toFetch = subjects.filter((s) => !cache.has(s.id));
    if (toFetch.length === 0) return;

    const controller = new AbortController();

    Promise.all(
      toFetch.map(async (subject) => {
        const params = new URLSearchParams({
          id: subject.id,
          name: subject.name,
          address: subject.address,
          source: subject.source,
        });
        try {
          const res = await fetch(`/api/parking/safety?${params}`, { signal: controller.signal });
          const body = (await res.json()) as { safety?: SafetyScore };
          if (body.safety) cache.set(subject.id, body.safety);
        } catch {
          // Leave uncached - shows as unknown rather than blocking the rest.
        }
      }),
    ).then(() => {
      if (!controller.signal.aborted) setVersion((v) => v + 1);
    });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the id list, not the subjects array identity
  }, [key]);

  const result: Record<string, SafetyScore> = {};
  for (const subject of subjects) {
    const cached = cache.get(subject.id);
    if (cached) result[subject.id] = cached;
  }
  return result;
}
