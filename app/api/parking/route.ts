import { NextRequest, NextResponse } from "next/server";
import { findNearbyParking } from "@/lib/parking/places";

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

  try {
    const candidates = await findNearbyParking(lat, lng);
    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("GET /api/parking failed:", err);
    return NextResponse.json({ error: "Failed to fetch parking candidates" }, { status: 502 });
  }
}
