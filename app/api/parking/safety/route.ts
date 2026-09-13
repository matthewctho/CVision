import { NextRequest, NextResponse } from "next/server";
import { getPlaceGroundingData, type PlacePhoto } from "@/lib/parking/places";
import { getSafetyScore } from "@/lib/parking/safety";

const TFNSW_OFFICIAL_FACT = "This is an official Transport for NSW Park&Ride facility.";

/**
 * GET /api/parking/safety?id=<candidate id>&name=<lot name>&address=<lot address>&source=<google_places|tfnsw_carpark>
 *
 * Kept separate from /api/parking so the main list stays fast - this is called
 * on demand for whichever spot the driver actually opens.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");
  const name = searchParams.get("name");
  const address = searchParams.get("address") ?? "";
  const source = searchParams.get("source");

  if (!id || !name || (source !== "google_places" && source !== "tfnsw_carpark")) {
    return NextResponse.json(
      {
        error:
          "Query params 'id', 'name' and 'source' ('google_places' or 'tfnsw_carpark') are required",
      },
      { status: 400 },
    );
  }

  let reviewSnippets: string[] | undefined;
  let photo: PlacePhoto | undefined;
  if (source === "google_places") {
    try {
      const grounding = await getPlaceGroundingData(id);
      reviewSnippets = grounding.reviewSnippets;
      photo = grounding.photo ?? undefined;
    } catch (err) {
      console.error("Fetching place grounding data failed:", err);
    }
  }

  const officialFact = source === "tfnsw_carpark" ? TFNSW_OFFICIAL_FACT : undefined;

  const safety = await getSafetyScore({ id, name, address, officialFact, reviewSnippets, photo });
  return NextResponse.json({ safety });
}
