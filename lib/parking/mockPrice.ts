const MIN_PRICE_PER_HOUR = 2;
const MAX_PRICE_PER_HOUR = 8;

// Google Places doesn't expose real parking rates, so we derive a stable
// per-lot estimate from its place_id — same lot always gets the same
// "price" across requests instead of jumping around randomly.
export function estimatePricePerHour(placeId: string): number {
  let hash = 0;
  for (let i = 0; i < placeId.length; i++) {
    hash = (hash * 31 + placeId.charCodeAt(i)) | 0;
  }
  const unit = (hash >>> 0) / 0xffffffff;
  const price = MIN_PRICE_PER_HOUR + unit * (MAX_PRICE_PER_HOUR - MIN_PRICE_PER_HOUR);
  return Math.round(price * 100) / 100;
}
