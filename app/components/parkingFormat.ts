import type { ParkingCandidate } from "@/lib/types";
import type { RoutedParkingSpot } from "@/lib/parking/route";
import { buildGoogleMapsLink } from "@/src/lib/googleMapsLink";

export type RoutedSpot = RoutedParkingSpot<ParkingCandidate>;

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? "<1 min" : `${minutes} min`;
}

export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

/** Popup body for a numbered parking marker. */
export function spotPopupHtml(spot: RoutedSpot, index: number, destinationName: string): string {
  return (
    `<b>${index + 1}. ${escapeHtml(spot.name)}</b>` +
    (spot.address ? `<br><span style="color:#666">${escapeHtml(spot.address)}</span>` : "") +
    `<br>${formatDuration(spot.walkSeconds)} walk to ${escapeHtml(destinationName)}` +
    `<br>${formatDuration(spot.cumulativeDriveSeconds)} drive to get here` +
    `<br>~$${spot.estimatedPricePerHour.toFixed(2)}/hr (estimated)` +
    (spot.isOpenNow === false ? "<br><span style=\"color:#c0392b\">Closed now</span>" : "") +
    `<br><a href="${buildGoogleMapsLink([{ lat: spot.lat, lng: spot.lng }])}" ` +
    'target="_blank" rel="noreferrer">Directions</a>'
  );
}
