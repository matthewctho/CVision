export type LiveAvailability = {
  spotsTotal: number;
  spotsAvailable: number;
  status: "available" | "almost_full" | "full";
  lastUpdated: string;
};

export type ParkingCandidate = {
  id: string;
  source: "google_places" | "tfnsw_carpark";
  name: string;
  lat: number;
  lng: number;
  address: string;
  distanceMeters: number;
  isOpenNow: boolean | null;
  rating: number | null;
  estimatedPricePerHour: number | null;
  priceIsEstimated: boolean;
  liveAvailability?: LiveAvailability;
};

/** Where the driver is ultimately going — the event's venue. */
export type Destination = {
  name: string;
  lat: number;
  lng: number;
  address: string;
};

export type ParkingResponse = {
  destination: Destination;
  candidates: ParkingCandidate[];
};
