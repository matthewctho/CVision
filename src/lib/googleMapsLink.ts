type Point = {
  lat: number;
  lng: number;
};

type Destination = Point & {
  name?: string;
};

function pointValue(point: Point) {
  return `${point.lat},${point.lng}`;
}

export function buildGoogleMapsLink(points: Point[]) {
  const destination = points.at(-1);
  if (!destination) return "https://www.google.com/maps";

  const origin = points[0] ?? destination;
  const waypoints = points.slice(1, -1).map(pointValue).join("|");
  const params = new URLSearchParams({
    api: "1",
    origin: pointValue(origin),
    destination: pointValue(destination),
    travelmode: "driving",
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildParkingTourLink(destination: Destination, candidates: Point[]) {
  return buildGoogleMapsLink([...candidates, destination]);
}
