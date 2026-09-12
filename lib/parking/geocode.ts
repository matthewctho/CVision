import type { Destination } from "@/lib/types";

const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = ["places.id", "places.displayName", "places.location", "places.formattedAddress"].join(",");

type SearchTextResponse = {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    formattedAddress?: string;
  }>;
};

/**
 * Calendar locations are free text ("Figma HQ · 760 Market St"), so they go
 * through Places text search rather than strict geocoding — it copes with
 * venue names, separators and partial addresses the same way a person would.
 */
export async function geocodeAddress(query: string): Promise<Destination | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not set");
  }

  const textQuery = query.replace(/\s*[·|•]\s*/g, ", ").replace(/\s+/g, " ").trim();
  if (!textQuery) return null;

  const res = await fetch(SEARCH_TEXT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery, maxResultCount: 1 }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Places text search failed (${res.status}): ${body}`);
  }

  const data: SearchTextResponse = await res.json();
  const place = data.places?.[0];
  const lat = place?.location?.latitude;
  const lng = place?.location?.longitude;
  if (!place || lat == null || lng == null) return null;

  return {
    name: place.displayName?.text ?? textQuery,
    lat,
    lng,
    address: place.formattedAddress ?? textQuery,
  };
}
