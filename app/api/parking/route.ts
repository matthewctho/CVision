import { NextRequest, NextResponse } from "next/server";
import { haversineMeters } from "@/lib/parking/geo";
import { findNearbyParking } from "@/lib/parking/places";
import { findNearbyTfnswCarparks } from "@/lib/parking/tfnswCarpark";
import type { ParkingCandidate } from "@/lib/types";

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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const lat = latParam === null ? NaN : Number(latParam);
  const lng = lngParam === null ? NaN : Number(lngParam);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "Query params 'lat' and 'lng' are required and must be numbers" },
      { status: 400 },
    );
  }

  const [placesResult, tfnswResult] = await Promise.allSettled([
    findNearbyParking(lat, lng),
    findNearbyTfnswCarparks(lat, lng),
  ]);

  if (placesResult.status === "rejected") {
    console.error("GET /api/parking failed:", placesResult.reason);
    return NextResponse.json({ error: "Failed to fetch parking candidates" }, { status: 502 });
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

  return NextResponse.json({ candidates });
}
