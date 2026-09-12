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
