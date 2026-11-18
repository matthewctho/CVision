# CVision

Find parking for the places you're already going. CVision reads the events in your Google Calendar, finds car parks near each one, scores them on price, distance and safety, and chains several stops into a single Google Maps driving route.

🥈 **2nd place out of 30+ teams at the n8n University Hackathon.** Built by a team of four University of Sydney students.

## Demo
https://youtu.be/Y8LPpfTpveY

## Features

- **Google sign-in and Calendar sync.** OAuth 2.0 login pulls your upcoming events that have a location.
- **Nearby parking search.** Combines Google Places results with live occupancy from the **Transport for NSW car park API**, including "almost full" warnings.
- **AI safety score.** Gemini rates each car park from 1 to 5 using its place details and photos. It's prompted to score only from concrete evidence (lighting, cameras, staffing, fencing), never from the suburb's reputation, and returns validated structured JSON.
- **Multi-stop routing.** Ranks candidate spots and builds a Google Maps directions link across several stops.
- **Interactive map.** Leaflet with CARTO basemap tiles.

## Tech stack

Next.js 16 (App Router, Route Handlers) · React 19 · TypeScript · Tailwind CSS v4 · Leaflet · Google Gemini (`@google/genai`) · Zod · Google Maps Platform · TfNSW Open Data

## Project structure

```
app/
  api/auth/        Google OAuth login, callback, logout
  api/calendar/    Calendar event endpoints
  api/parking/     Parking search, routing, AI safety scoring
  components/      UI: main app shell, map, hooks
  events/ map/     Pages
lib/
  parking/         Places, TfNSW occupancy, geocoding, routing, safety (Gemini)
  calendar/        Calendar helpers
  google/          OAuth/session helpers
```

## Getting started

Requires Node 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
cp .env.example .env.local   # then fill in your own keys
pnpm dev
```

Open http://localhost:3000.

### API keys

| Variable | Source |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth 2.0 Web client (enable the Google Calendar API) |
| `GOOGLE_MAPS_API_KEY` | Google Maps Platform: enable Places API (New) |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `TRANSPORT_NSW_KEY` | [TfNSW Open Data Hub](https://opendata.transport.nsw.gov.au) |
| `NEXT_PUBLIC_CARTO_API_KEY` | Optional: [CARTO basemaps](https://carto.com/basemaps) |
| `AUTH_SECRET` | Any long random string (`openssl rand -base64 32`) |

Add this authorised redirect URI to your OAuth client (change the port if needed):

```
http://localhost:3000/api/auth/google/callback
```

## Notes

- Google Places doesn't expose parking rates, so prices are a stable per-lot **estimate** derived from the place ID ([lib/parking/mockPrice.ts](lib/parking/mockPrice.ts)), not real pricing.

## Team

Matthew Ho · Elisei Kambalin · Sanjeev Ragothaman · Kristian Kocic
