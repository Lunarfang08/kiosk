# AI Digital Human Kiosk

Self-hosted kiosk that pairs a **Dograh** voice agent with a talking digital human.

- **Mac short demo (default):** browser **audio-driven talking portrait** lip-sync driven by Dograh’s real WebRTC TTS track.
- **GPU production (optional):** [LiveTalking](https://github.com/lipku/LiveTalking) CUDA avatar via `docker compose --profile gpu-avatar`.

Dograh remains the only conversation engine (STT → LLM → tools → TTS). This app does not invent a second chat pipeline.

## Architecture

```
Mic → Dograh SmallWebRTC → remote TTS MediaStream + RTF events
                         → PortraitLipSync (Mac) or LiveTalking /humanaudio (GPU)
                         → Kiosk display
```

API keys stay on the backend. Browser signaling uses a WebSocket proxy so `DOGRAH_API_KEY` never ships to the client.

## Prerequisites (Mac demo)

- Node 20+
- Python 3.11+
- Dograh account / agent (default agent id **14591**)
- HTTPS or `http://localhost` for microphone access

LiveTalking **requires NVIDIA CUDA** and will not run as a realtime engine on Apple Silicon.

## Quick start (Mac)

```bash
cp .env.example .env
# Edit .env: set DOGRAH_API_KEY, confirm DOGRAH_AGENT_ID=14591
# Rotate any key that was pasted into chat.

# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
uvicorn app.main:app --app-dir backend --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

1. Go to **Settings** → paste `ADMIN_TOKEN` from `.env` → save Dograh URL / agent id / API key → **Test connection**.
2. Go to **Avatar Studio** → create a portrait avatar → upload a front-facing photo → **Use in kiosk**.
3. On the kiosk → **Start conversation** (must be a real click for mic permission).
4. Speak; watch listening / speaking indicators and mouth motion stop when audio stops.

### Docker (app services)

```bash
cp .env.example .env   # fill secrets
docker compose up --build
```

- Frontend: http://localhost:3000  
- Backend: http://localhost:8000/api/health  

### GPU LiveTalking (later)

On a Linux host with NVIDIA drivers + Container Toolkit:

```bash
# Set in .env
LIVETALKING_ENABLED=true
AVATAR_ENGINE=livetalking
LIVETALKING_BASE_URL=http://localhost:8010

docker compose --profile gpu-avatar up
```

Clone/configure LiveTalking per upstream docs, place `wav2lip.pth` and an avatar pack under `data/avatars/`, then:

```bash
python app.py --transport webrtc --model wav2lip --avatar_id wav2lip256_avatar1 --max_session 1
```

Use host networking for WebRTC ICE. Prefer RTX 3060+ for wav2lip.

## Dograh Web Call setup (agent 14591)

1. Open the agent **Kiosk screening - inbound** (`14591`) in https://app.dograh.com
2. Create an API key at `/api-keys` and put it in `.env` as `DOGRAH_API_KEY` (or Settings UI).
3. Optional: Configure Widget → Headless Voice → allow `localhost` → copy embed token into `DOGRAH_EMBED_TOKEN`.
4. Ensure the agent’s Start Call greeting matches your kiosk welcome copy if desired.

This app creates runs with `mode: smallwebrtc` and proxies signaling so the browser never sees the API key.

## Avatar types (do not conflate)

| Type | Engine | Notes |
|------|--------|-------|
| Static portrait | — | Image only |
| Audio-driven talking portrait | `portrait` | Mac demo default |
| LiveTalking / MuseTalk video | `livetalking` / `musetalk` | GPU |
| Full 3D | `three_d` | Needs facial morph targets |

## API surface

- `GET /api/health`
- `GET /api/dograh/status`
- `POST /api/dograh/test-connection` (admin)
- `GET/POST/PUT/DELETE /api/avatars…`
- `POST /api/sessions/start|stop`
- `GET /api/sessions/{id}/status`
- `WS /api/sessions/{id}/dograh-signaling` (API-key proxy)
- `WS /api/sessions/{id}/events`
- `GET /api/diagnostics`
- `GET/PUT /api/settings` (PUT requires `X-Admin-Token`)

## Security

- Never commit `.env`
- Rotate keys exposed in chat
- Admin mutations require `X-Admin-Token`
- Upload type/size validation
- No Dograh API key in frontend bundles or `localStorage`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Mic denied | Use localhost/HTTPS; start call from a click |
| Dograh auth failed | Rotate/re-set `DOGRAH_API_KEY`; Test connection |
| Signaling fails | Check backend logs; confirm agent id `14591` |
| Mouth keeps moving | Ensure interrupt / `rtf-bot-stopped-speaking`; energy fallback should decay |
| LiveTalking black video | Host network + UDP; not supported on Mac CUDA-less hosts |
| CORS errors | Add origin to `CORS_ORIGINS` |

## Project layout

```
frontend/   React + Vite + Tailwind + R3F + Zustand
backend/    FastAPI + SQLite + Dograh + avatar engines
avatar_data/
docker/
```

## License

Application code in this repository is provided for your deployment. Upstream Dograh and LiveTalking keep their own licenses.
