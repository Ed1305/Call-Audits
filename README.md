# CallAudit AI

AI-powered call auditing and QA evaluation platform with an authentic **Ubuntu GNOME (Yaru theme)** desktop UI.

Upload call recordings, get automatic transcription with speaker diarization, AI-driven QA analysis, scoring, and downloadable PDF audit reports.

![Ubuntu Desktop UI](https://img.shields.io/badge/UI-Ubuntu%20Yaru-E95420)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)

## Features

- **Audio Upload** — Drag-and-drop mp3, wav, m4a, ogg call recordings
- **Two-pass Gemini listen** — Observe the audio first, then score against a campaign QA form
- **Campaign scorecards** — Script, mandatory phrases, prohibited claims, and per-category anchors
- **Transcription** — faster-whisper fallback when `LISTEN_MODE=transcript`
- **Speaker Diarization** — Agent vs Client from the listen pass (pyannote optional on Whisper)
- **Disposition Review** — Compares agent-selected vs AI-recommended disposition
- **Scoring Rubric** — Campaign-weighted scoring out of 100 with timestamped notes
- **PDF Reports** — Downloadable audit feedback reports
- **Ubuntu Desktop UI** — Full GNOME/Yaru themed interface with dock, top bar, window controls

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- Python 3.10+ (optional, for real transcription)

### Installation

```bash
# Clone and install
cd Call_Audit
npm install

# Configure environment
copy .env.example .env
# Edit .env and set GEMINI_API_KEY (recommended) or OPENAI_API_KEY

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Python Transcription (Optional)

For real audio transcription instead of demo transcripts:

```bash
cd processor
pip install -r requirements.txt

# Set in .env:
# WHISPER_MODEL=base
# HF_TOKEN=your-huggingface-token  (for pyannote diarization)
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_PATH` | `./data/callaudit.json` | JSON database path |
| `UPLOAD_DIR` | `./data/uploads` | Audio file storage |
| `LLM_PROVIDER` | `gemini` | `gemini`, `openai`, `ollama`, or `compatible` |
| `LISTEN_MODE` | `audio` | `audio` = Gemini hears the call; `transcript` = text-only |
| `GEMINI_API_KEY` | — | Google AI Studio key (recommended) |
| `GEMINI_MODEL` | `gemini-3.6-flash` | `gemini-3.6-flash` (recommended) or `gemini-3.5-flash` |
| `ALLOW_DEMO_FALLBACK` | `false` | If true, allows fake demo audits |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model name |
| `OPENAI_BASE_URL` | OpenAI URL | For compatible endpoints |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model |
| `WHISPER_MODEL` | `base` | Whisper model size |
| `HF_TOKEN` | — | HuggingFace token for diarization |
| `PYTHON_PATH` | `python` | Python executable |

## Processing Pipeline

**Recommended (human listen):** `LLM_PROVIDER=gemini` + `LISTEN_MODE=audio`

1. User uploads audio, optional disposition, and a campaign scorecard
2. **Listen pass** — Gemini hears the recording (temperature 0). Notes only: transcript, dead air, talk-over, tone. No scores.
3. **Score pass** — a text-only LLM scores those notes against the selected scorecard (anchors, script, compliance lists)
4. **verifyAudit** — code recomputes the total, strips invented timestamps, and stores QA integrity warnings
5. Results saved to the JSON store; user views report / PDF

Status path: `uploaded → listening → analyzing → completed`.

**Classic path:** Whisper (+ optional pyannote) builds a transcript-only listen result, then the same score pass runs. Delivery is not scored blind — the report says it could not be assessed. Set `LISTEN_MODE=transcript` to force this path.

Set `ALLOW_DEMO_FALLBACK=true` only for demos — otherwise missing keys/failures surface as real errors.

## Deploy (free on Render)

You do **not** need a paid disk. Audio is discarded after the audit. Call History is saved **in the browser** (this computer), so it survives Render going to sleep.

**Vercel still will not work** — Gemini listen takes longer than Vercel’s time limit.

### Render free (step by step)

1. This repo is on [Ed1305/Call-Audits](https://github.com/Ed1305/Call-Audits).
2. Sign up at [render.com](https://render.com) with GitHub (free).
3. **New** → **Web Service** → this repo.
4. Runtime: **Docker**. Instance: **Free**.
5. Do **not** add a disk.
6. Environment variables:

```
LLM_PROVIDER=gemini
LISTEN_MODE=audio
GEMINI_API_KEY=your-real-key
GEMINI_MODEL=gemini-3.6-flash
ALLOW_DEMO_FALLBACK=false
DATABASE_PATH=/tmp/callaudit.json
UPLOAD_DIR=/tmp/uploads
KEEP_AUDIO=false
PROCESSOR_ENABLED=false
HOSTNAME=0.0.0.0
```

Do not set `PORT`.

7. Deploy, open the `onrender.com` URL, upload a call. When it finishes, it appears under **Call History** on that browser.

The first request after idle can take a minute (free instances sleep). Stay on the processing page until it completes.

History is per-browser: another computer or a cleared cache starts empty. The PDF download still works from a saved report.

### Paid disk (only if you need shared history)

Render Starter + a disk at `/data` keeps history on the server for every user. Most people do not need this.

### Cheaper always-on alternative: a VPS

If Render’s starter price is more than you want, a small VPS is usually cheaper and has no request-timeout drama:

- [Hetzner Cloud](https://www.hetzner.com/cloud) CX22 (~€4/month), or DigitalOcean $6 droplet
- Install Docker, clone the repo, run:

```bash
docker build -t callaudit .
docker run -d --name callaudit -p 80:3000 --env-file .env -v callaudit-data:/data --restart unless-stopped callaudit
```

Put your real `GEMINI_API_KEY` in `.env` on the server (`DATABASE_PATH=/data/callaudit.json` and `UPLOAD_DIR=/data/uploads`).

### Local Docker

```bash
docker build -t callaudit .
docker run -p 3000:3000 --env-file .env -v callaudit-data:/data callaudit
```


## Tech Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Database:** JSON file store (zero native dependencies, works on all platforms)
- **Transcription:** faster-whisper (Python)
- **Diarization:** pyannote.audio (optional)
- **LLM:** Gemini (audio listen + text score) / OpenAI / Ollama
- **PDF:** jsPDF

## Project Structure

```
Call_Audit/
├── src/
│   ├── app/                  # Next.js pages & API routes
│   ├── components/           # Ubuntu-themed UI components
│   └── lib/                  # DB, AI, processing, PDF
├── processor/                # Python transcription pipeline
├── data/                     # SQLite DB + uploaded audio
└── .env.example
```

## License

MIT
