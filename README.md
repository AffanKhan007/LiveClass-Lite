# LiveClass Lite

LiveClass Lite is a browser-based realtime virtual study room built around LiveKit. The stack is intentionally small and local-demo friendly:

- `frontend`: React + Vite + TypeScript
- `api`: FastAPI + SQLAlchemy
- `db`: PostgreSQL
- `livekit`: self-hosted LiveKit for local development
- `docker-compose.yml`: one command to run the full stack

## What it supports

- Create or join a room by room name
- Join with a display name
- Microphone and camera controls
- Participant video tiles
- Participant sidebar with speaking state
- Screen sharing
- Realtime chat using LiveKit data packets
- Quick emoji reactions using LiveKit data packets
- Host role assignment to the first active joiner
- MVP host moderation for mute and remove
- PostgreSQL storage for rooms, sessions, chat history, and moderation events

## Project structure

```text
.
|-- api
|-- frontend
|-- infra
|   `-- livekit
|-- docker-compose.yml
|-- .env.example
`-- README.md
```

## Setup

1. Copy `.env.example` to `.env`.
2. Start the stack:

```bash
docker compose up --build
```

3. Wait until all services are healthy, then open:

- Frontend: [http://localhost:5173](http://localhost:5173)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- LiveKit websocket: `ws://localhost:7880`

4. Stop the stack when finished:

```bash
docker compose down
```

## Demo flow

1. Open the frontend in two browser windows.
2. In window one, enter a room name and display name, then create or join.
3. The first active joiner becomes the host automatically.
4. In window two, use the same room name with a different display name.
5. Turn on microphone and camera in each window.
6. Allow browser permissions for microphone, camera, and screen sharing when prompted.
7. Verify local and remote video tiles, participant list, and speaking indicators.
8. Start screen sharing from one participant.
9. Send chat messages and quick reactions.
10. From the host window, use mute or remove on another participant.

## Verified locally

- `docker compose up -d` starts the full stack successfully
- API health, room join, chat persistence, and moderation event recording work
- Frontend production build passes with `docker compose run --rm frontend npm run build`

## Notes for media on local machines

- LiveKit uses TCP ports `7880` and `7881`, plus UDP ports `52000-52050`.
- For same-machine local demos, `LIVEKIT_NODE_IP=127.0.0.1` makes LiveKit advertise localhost ICE candidates so the browser can reach media through Docker's mapped ports.
- If you want participants to join from a second device on your LAN, replace `LIVEKIT_NODE_IP` with your machine's LAN IP and restart the stack.
- If camera, microphone, or screen share do not connect on a locked-down machine, check browser permissions and local firewall rules for the mapped UDP range.

## Architecture notes

- LiveKit is the center of the product. Media, room presence, screen share, reactions, and chat transport all flow through LiveKit.
- The backend is kept intentionally small. It issues access tokens, stores lightweight metadata, records chat history, and persists moderation events.
- Host moderation is MVP-level for local demos. The host sends moderation commands through LiveKit realtime data, and the frontend enforces mute/remove behavior cooperatively. This keeps the demo simple without introducing more server-side complexity.

## Environment variables

The root `.env` file configures both containers and frontend runtime values:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `API_HOST`
- `API_PORT`
- `API_CORS_ORIGINS`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_WS_URL`
- `LIVEKIT_NODE_IP`
- `VITE_API_BASE_URL`
- `VITE_LIVEKIT_WS_URL`

## Tradeoffs

- Moderation is intentionally simple for the MVP and designed for a reliable local demo rather than hardened production enforcement.
- Database schema is minimal and readable, not heavily abstracted.
- The frontend favors straightforward room-state wiring over a larger state-management setup.
