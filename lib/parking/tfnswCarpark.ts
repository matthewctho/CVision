import { haversineMeters } from "./geo";
import type { ParkingCandidate } from "@/lib/types";

const CARPARK_FULL_LIST_URL = "https://api.transport.nsw.gov.au/v1/carpark/full-list";
const DEFAULT_RADIUS_METERS = 3000; // facilities are sparse (outer-suburban stations)
const ALMOST_FULL_THRESHOLD = 0.1; // TfNSW's own recommended cutoff
const FETCH_TIMEOUT_MS = 5000;

type CarparkOccupancyResponse = {
  spots: string;
  location: {
    suburb: string;
    address: string;
    latitude: string;
    longitude: string;
  };
  occupancy: {
    total: string;
  };
  MessageDate: string;
  facility_id: string;
  facility_name: string;
};

// The full-list endpoint's exact response shape (array vs an object keyed by
// facility_id) isn't documented anywhere we could confirm - handle both so a
// wrong guess doesn't hard-fail the whole request once tested against a real key.
function parseFullListResponse(raw: unknown): CarparkOccupancyResponse[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return Object.values(raw) as CarparkOccupancyResponse[];
  throw new Error("Unexpected shape from TfNSW carpark/full-list response");
}

// TfNSW's documented formula: Availability = spots - occupancy.total
function toCandidate(
  data: CarparkOccupancyResponse,
  originLat: number,
  originLng: number,
): ParkingCandidate {
  const spotsTotal = Number(data.spots);
  const spotsAvailable = Math.max(0, spotsTotal - Number(data.occupancy.total));
  const status =
    spotsAvailable < 1
      ? "full"
      : spotsAvailable < spotsTotal * ALMOST_FULL_THRESHOLD
        ? "almost_full"
        : "available";

  const lat = Number(data.location.latitude);
  const lng = Number(data.location.longitude);

  return {
    id: `tfnsw-${data.facility_id}`,
    source: "tfnsw_carpark",
    name: data.facility_name,
    lat,
    lng,
    address: `${data.location.address}, ${data.location.suburb}`,
    distanceMeters: Math.round(haversineMeters(originLat, originLng, lat, lng)),
    isOpenNow: null,
    rating: null,
    estimatedPricePerHour: null,
    priceIsEstimated: false,
    liveAvailability: {
      spotsTotal,
      spotsAvailable,
      status,
      lastUpdated: data.MessageDate,
    },
  };
}

export async function findNearbyTfnswCarparks(
  lat: number,
  lng: number,
  radiusMeters: number = DEFAULT_RADIUS_METERS,
): Promise<ParkingCandidate[]> {
  const apiKey = process.env.TRANSPORT_NSW_KEY;
  if (!apiKey) {
    console.warn("TRANSPORT_NSW_KEY is not set - skipping TfNSW Car Park data source");
    return [];
  }

  const res = await fetch(CARPARK_FULL_LIST_URL, {
    headers: { Authorization: `apikey ${apiKey}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`TfNSW Car Park full-list request failed (${res.status})`);
  }

  const facilities = parseFullListResponse(await res.json());

  return facilities
    .filter((f) => f.location?.latitude != null && f.location?.longitude != null)
    .map((f) => toCandidate(f, lat, lng))
    .filter((c) => c.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
