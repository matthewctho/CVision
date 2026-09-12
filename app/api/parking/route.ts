import { NextRequest, NextResponse } from "next/server";
import { findNearbyParking } from "@/lib/parking/places";
import { geocodeAddress } from "@/lib/parking/geocode";
import type { Destination, ParkingResponse } from "@/lib/types";

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

    const candidates = await findNearbyParking(destination.lat, destination.lng);
    const body: ParkingResponse = { destination, candidates };
    return NextResponse.json(body);
  } catch (err) {
    console.error("GET /api/parking failed:", err);
    return NextResponse.json({ error: "Failed to fetch parking candidates" }, { status: 502 });
  }
}
