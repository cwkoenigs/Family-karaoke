# 🎤 Family Karaoke

A late-night KTV-booth setlist app. Tap a singer, log the songs they crush, and
get fresh AI-powered picks for the queue — bilingual (English / 日本語).

Built with **Next.js (App Router)** and deployable to **Vercel** in one click.
Song suggestions come from **Claude** via a secure serverless API route, so your
API key never touches the browser. Setlists are saved in `localStorage`.

## Getting started (local)

```bash
npm install
cp .env.example .env.local   # then paste your Anthropic API key
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Name                | Required | Description                                              |
| ------------------- | -------- | -------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | yes      | Your Anthropic API key (https://console.anthropic.com/). |

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project at https://vercel.com/new.
3. Add the `ANTHROPIC_API_KEY` environment variable in
   **Project Settings → Environment Variables**.
4. Deploy. Vercel auto-detects Next.js — no extra config needed.

Or with the Vercel CLI:

```bash
npm i -g vercel
vercel            # follow prompts
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

## How the AI call works

- The client sends the active singer, a seed song, and their current setlist to
  `POST /api/suggest`.
- The serverless route (`app/api/suggest/route.js`) calls the Anthropic Messages
  API using the server-side `ANTHROPIC_API_KEY`, parses the JSON suggestions, and
  returns them.
- The model is `claude-sonnet-4-6` — adjust it in `app/api/suggest/route.js`.
