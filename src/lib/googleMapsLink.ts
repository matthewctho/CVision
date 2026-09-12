/**
 * Builds a Google Maps driving-directions URL from an ordered list of stops.
 *
 * No origin is sent, so Google starts the route from the device's current
 * location. The last stop becomes the destination and everything before it is
 * passed as waypoints, in order — Google does not reorder stops for the URL
 * scheme, so the array order is the route order.
 */

export type LatLng = {
    lat: number;
    lng: number;
};

/** The waypoints parameter accepts at most 9 entries. */
const MAX_WAYPOINTS = 9;

/** A link carries a destination plus the waypoints, so this many stops. */
export const MAX_STOPS = MAX_WAYPOINTS + 1;

/** ~11 cm of precision. Extra digits are accepted but ignored by Google. */
const COORD_PRECISION = 6;

function formatPoint(point: LatLng, label: string): string {
    const { lat, lng } = point;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error(`${label} has a non-numeric coordinate.`);
    }
    if (lat < -90 || lat > 90) {
        throw new Error(`${label} has an out-of-range latitude: ${lat}`);
    }
    if (lng < -180 || lng > 180) {
        throw new Error(`${label} has an out-of-range longitude: ${lng}`);
    }

    // Google expects decimal degrees, latitude first.
    return `${lat.toFixed(COORD_PRECISION)},${lng.toFixed(COORD_PRECISION)}`;
}

export function buildGoogleMapsLink(
    stops: LatLng[],
    /** Launch straight into turn-by-turn navigation on mobile. */
    navigate = false,
): string {
    if (stops.length < 1) {
        throw new Error("Need at least one stop to route to.");
    }

    const destination = stops[stops.length - 1];
    const waypoints = stops.slice(0, -1);

    if (waypoints.length > MAX_WAYPOINTS) {
        throw new Error(
            `Google Maps links support at most ${MAX_WAYPOINTS} waypoints; ` +
            `received ${waypoints.length}.`,
        );
    }

    // Omitting origin tells Google to start from the current location.
    const params = new URLSearchParams({
        api: "1",
        destination: formatPoint(destination, "Destination"),
        travelmode: "driving",
    });

    if (waypoints.length > 0) {
        params.set(
            "waypoints",
            waypoints
                .map((point, i) => formatPoint(point, `Waypoint ${i + 1}`))
                .join("|"),
        );
    }

    if (navigate) {
        params.set("dir_action", "navigate");
    }

    // URLSearchParams handles the encoding: "," becomes %2C and "|" becomes %7C.
    return `https://www.google.com/maps/dir/?${params.toString()}`;
