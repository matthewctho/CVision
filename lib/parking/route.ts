import { haversineMeters } from "./geo";

/** Pace of an adult walking with somewhere to be. */
const WALK_SPEED_MPS = 1.35;

/**
 * Footpaths bend around buildings, fences and signalised crossings, so the
 * ground actually covered on foot runs longer than the straight line.
 */
const WALK_DETOUR = 1.3;

/**
 * Average city driving speed with lights, give-ways and traffic folded in —
 * far below the posted limit, which is what makes short urban hops so slow.
 */
const DRIVE_SPEED_MPS = 7.5;

/**
 * Roads detour harder than footpaths: one-way systems, banned right turns and
 * blocks you have to go around rather than through.
 */
const DRIVE_DETOUR = 1.5;

/**
 * How many seconds of driving the driver would trade to save one second of
 * walking.
 *
 * Deliberately well above 1. Driving is done sitting down and under cover, and
 * every leg of it is speculative — a lot that turns out to be full costs only
 * the hop to the next one. The walk is the part that actually gets paid: on
 * foot, in whatever the weather is doing, carrying whatever came out of the
 * boot, and again in reverse on the way back to the car.
 *
 * At 8, one metre closer to the destination on foot is worth about forty
 * metres of extra driving, so a spot on the doorstep beats a spot half a
 * suburb closer to the driver. That bias is the point: park close, drive as
 * far as it takes to manage it. Tune towards 1 to favour the shortest drive.
 */
const WALK_WEIGHT = 8;

/**
 * Spots beyond this many are far enough from the destination that the walk
 * dwarfs anything the ordering could win back.
 */
const MAX_CANDIDATES = 20;

export type LatLng = {
    lat: number;
    lng: number;
};

export type ParkingSpot = LatLng & {
    id: string;
};

export type RoutedParkingSpot<T extends ParkingSpot> = T & {
    /** Driving time on the leg into this spot, from the previous one. */
    driveSeconds: number;
    /** Driving time from the origin through to this spot. */
    cumulativeDriveSeconds: number;
    /** Walk to the destination, paid only if this is where they park. */
    walkSeconds: number;
};

function walkSecondsBetween(from: LatLng, to: LatLng): number {
    const metres = haversineMeters(from.lat, from.lng, to.lat, to.lng);
    return (metres * WALK_DETOUR) / WALK_SPEED_MPS;
}

function driveSecondsBetween(from: LatLng, to: LatLng): number {
    const metres = haversineMeters(from.lat, from.lng, to.lat, to.lng);
    return (metres * DRIVE_DETOUR) / DRIVE_SPEED_MPS;
}

/**
 * Cost of trying `candidate` next, from wherever the car currently is.
 *
 * The drive is counted once because it is spent getting there whether or not
 * a bay is free. The walk is counted at `WALK_WEIGHT` because it is only owed
 * if the driver stops here, and it is the half of the trip they feel.
 */
export function scoreSpot(
    currentPosition: LatLng,
    candidate: LatLng,
    destination: LatLng,
): number {
    return (
        driveSecondsBetween(currentPosition, candidate) +
        WALK_WEIGHT * walkSecondsBetween(candidate, destination)
    );
}

/**
 * Orders parking spots into the sequence to try them in: drive to the first,
 * and on finding it full carry on to the next, until something has a free bay.
 *
 * Each choice is scored from where the car would actually be by then rather
 * than from the origin, so a cluster of nearby lots gets swept together
 * instead of criss-crossing back and forth. That greedy step is what makes it
 * a route rather than a sorted list — it is not the globally cheapest tour,
 * but the driver only ever follows it until the first free bay, so effort
 * spent optimising the tail is wasted anyway.
 */
export function routeParkingSpots<T extends ParkingSpot>(
    origin: LatLng,
    destination: LatLng,
    candidates: readonly T[],
): RoutedParkingSpot<T>[] {
    const remaining = [...candidates]
        .map((spot) => ({
            spot,
            toDestination: haversineMeters(
                destination.lat,
                destination.lng,
                spot.lat,
                spot.lng,
            ),
        }))
        .sort((a, b) => a.toDestination - b.toDestination)
        .slice(0, MAX_CANDIDATES)
        .map((entry) => entry.spot);

    const order: T[] = [];
    let position: LatLng = origin;

    while (remaining.length > 0) {
        let bestIndex = 0;
        let bestScore = Infinity;

        for (let i = 0; i < remaining.length; i++) {
            const score = scoreSpot(position, remaining[i], destination);
            if (score < bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        const [spot] = remaining.splice(bestIndex, 1);
        order.push(spot);
        position = spot;
    }

    return annotateRoute(origin, destination, order);
}

/**
 * Attaches drive and walk figures to spots in exactly the order given — for
 * when the driver has re-sorted or dragged the list into their own order and
 * the leg times need to follow.
 */
export function annotateRoute<T extends ParkingSpot>(
    origin: LatLng,
    destination: LatLng,
    spots: readonly T[],
): RoutedParkingSpot<T>[] {
    const route: RoutedParkingSpot<T>[] = [];
    let position: LatLng = origin;
    let cumulativeDriveSeconds = 0;

    for (const spot of spots) {
        const driveSeconds = driveSecondsBetween(position, spot);
        cumulativeDriveSeconds += driveSeconds;

        route.push({
            ...spot,
            driveSeconds,
            cumulativeDriveSeconds,
            walkSeconds: walkSecondsBetween(spot, destination),
        });

        position = spot;
    }

    return route;
}
