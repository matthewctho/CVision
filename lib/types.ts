export type ParkingCandidate = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  distanceMeters: number;
  isOpenNow: boolean | null;
  rating: number | null;
  estimatedPricePerHour: number;
  priceIsEstimated: true;
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
