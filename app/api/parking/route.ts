import { NextRequest, NextResponse } from "next/server";
import { haversineMeters } from "@/lib/parking/geo";
import { findNearbyParking } from "@/lib/parking/places";
import { findNearbyTfnswCarparks } from "@/lib/parking/tfnswCarpark";
import { geocodeAddress } from "@/lib/parking/geocode";
import type { Destination, ParkingCandidate, ParkingResponse } from "@/lib/types";

// Places sometimes lists the same physical Park&Ride lot TfNSW already
// covers (e.g. "Park&Ride - Hornsby" shows up from both sources at slightly
// different coordinates). Prefer the TfNSW entry - it has real availability,
// the Places one only has a mocked price - and drop the Places duplicate.
const DEDUPE_RADIUS_METERS = 150;

function dedupeAgainstTfnsw(
  placesCandidates: ParkingCandidate[],
  tfnswCandidates: ParkingCandidate[],
): ParkingCandidate[] {
  return placesCandidates.filter(
    (place) =>
      !tfnswCandidates.some(
        (t) => haversineMeters(place.lat, place.lng, t.lat, t.lng) <= DEDUPE_RADIUS_METERS,
      ),
  );
}

/**
 * GET /api/parking?address=<free text>          — geocode, then search around it
 * GET /api/parking?lat=<n>&lng=<n>[&name=<s>]   — search around known coordinates
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const address = searchParams.get("address")?.trim();

  let destination: Destination;
  try {
    if (address) {
      const found = await geocodeAddress(address);
      if (!found) {
        return NextResponse.json({ error: `Could not find "${address}" on the map` }, { status: 404 });
      }
      destination = found;
    } else {
      const latParam = searchParams.get("lat");
      const lngParam = searchParams.get("lng");
      const lat = latParam === null ? NaN : Number(latParam);
      const lng = lngParam === null ? NaN : Number(lngParam);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return NextResponse.json(
          { error: "Provide either 'address', or numeric 'lat' and 'lng' query params" },
          { status: 400 },
        );
      }
      destination = { name: searchParams.get("name")?.trim() || "Destination", lat, lng, address: "" };
    }

    const [placesResult, tfnswResult] = await Promise.allSettled([
      findNearbyParking(destination.lat, destination.lng),
      findNearbyTfnswCarparks(destination.lat, destination.lng),
    ]);

    if (placesResult.status === "rejected") {
      throw placesResult.reason;
    }

    // TfNSW is a supplementary source - if it fails, still return the Places results.
    const tfnswCandidates = tfnswResult.status === "fulfilled" ? tfnswResult.value : [];
    if (tfnswResult.status === "rejected") {
      console.error("TfNSW Car Park lookup failed:", tfnswResult.reason);
    }

    const dedupedPlaces = dedupeAgainstTfnsw(placesResult.value, tfnswCandidates);
    const candidates = [...dedupedPlaces, ...tfnswCandidates].sort(
      (a, b) => a.distanceMeters - b.distanceMeters,
    );

    const body: ParkingResponse = { destination, candidates };
    return NextResponse.json(body);
  } catch (err) {
    console.error("GET /api/parking failed:", err);
    return NextResponse.json({ error: "Failed to fetch parking candidates" }, { status: 502 });
  }
}
