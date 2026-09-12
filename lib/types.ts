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
