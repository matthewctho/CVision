import { haversineMeters } from "./geo";
import { estimatePricePerHour } from "./mockPrice";
import type { ParkingCandidate } from "@/lib/types";

const SEARCH_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const DEFAULT_RADIUS_METERS = 800;
const FETCH_TIMEOUT_MS = 5000;

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.formattedAddress",
  "places.rating",
  "places.currentOpeningHours.openNow",
].join(",");

type PlacesApiResponse = {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    formattedAddress?: string;
    rating?: number;
    currentOpeningHours?: { openNow?: boolean };
  }>;
};

export async function findNearbyParking(
  lat: number,
  lng: number,
  radiusMeters: number = DEFAULT_RADIUS_METERS,
): Promise<ParkingCandidate[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not set");
  }

  const res = await fetch(SEARCH_NEARBY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ["parking"],
      maxResultCount: 5,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Places API request failed (${res.status}): ${body}`);
  }

  const data: PlacesApiResponse = await res.json();

  return (data.places ?? [])
    .filter((place) => place.location?.latitude != null && place.location?.longitude != null)
    .map((place) => {
      const placeLat = place.location!.latitude!;
      const placeLng = place.location!.longitude!;
      return {
        id: place.id,
        source: "google_places" as const,
        name: place.displayName?.text ?? "Unnamed parking",
        lat: placeLat,
        lng: placeLng,
        address: place.formattedAddress ?? "",
        distanceMeters: Math.round(haversineMeters(lat, lng, placeLat, placeLng)),
        isOpenNow: place.currentOpeningHours?.openNow ?? null,
        rating: place.rating ?? null,
        estimatedPricePerHour: estimatePricePerHour(place.id),
        priceIsEstimated: true,
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
