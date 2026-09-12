import { NextRequest, NextResponse } from "next/server";

type Point = { lat: number; lng: number };

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { points?: Point[] };
  const points = body.points;
  if (!Array.isArray(points) || points.length < 2 || points.some((point) => !Number.isFinite(point.lat) || !Number.isFinite(point.lng))) {
    return NextResponse.json({ error: "At least two valid route points are required." }, { status: 400 });
  }

  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(";");
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) {
    console.error("Road route request failed:", response.status, await response.text());
    return NextResponse.json({ error: "Could not find a road route for these locations." }, { status: 502 });
  }

  const data = (await response.json()) as {
    routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
  };
  const coordinatesForRoute = data.routes?.[0]?.geometry?.coordinates;
  if (!coordinatesForRoute || coordinatesForRoute.length < 2) {
    return NextResponse.json({ error: "No road route was found for these locations." }, { status: 502 });
  }

  return NextResponse.json({ coordinates: coordinatesForRoute });
}
