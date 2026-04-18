# JordanAI — AI Sales Platform for Mortgage & Real Estate

## Stack
- **Next.js 14** on **Vercel** (frontend + API)
- **Supabase** (database — leads, calls, conversations)
- **Twilio** (outbound calls)
- **ElevenLabs** (custom AI voice)
- **Anthropic Claude** (conversational AI engine)

---

## Setup (one time)

### 1. Supabase
1. Go to [supabase.com](https://supabase.com) → New project
2. Go to **SQL Editor** → paste entire contents of `schema.sql` → Run
3. Go to **Settings → API** → copy:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   - `SUPABASE_SERVICE_ROLE_KEY`

### 2. GitHub
```bash
cd jordanai-v2
git init
git add .
git commit -m "initial"
# Create repo at github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/jordanai.git
git push -u origin main
```

### 3. Vercel
1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Add all environment variables from `.env.local.example`
3. Deploy → get your permanent URL (e.g. `https://jordanai.vercel.app`)

### 4. Environment Variables (add in Vercel dashboard)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 5. After deploy
- Open your Vercel URL
- Go to **Settings** → paste all API keys → Save
- Your ElevenLabs Voice ID: go to elevenlabs.io → Voices → click your voice → copy the ID

---

## Development (local)
```bash
npm install
cp .env.local.example .env.local
# Fill in .env.local
npm run dev
# Open http://localhost:3000
```

For local calls to work with Twilio, you need a public URL:
```bash
ngrok http 3000
# Set NEXT_PUBLIC_APP_URL to ngrok URL in .env.local
```

On Vercel, ngrok is not needed — your URL is permanent.

---

## Deployment workflow
```bash
# Make a change
git add .
git commit -m "your message"
git push
# Vercel auto-deploys in ~60 seconds
```

---

## Features
- Import leads (single form or CSV upload)
- AI Caller — outbound calls via Twilio + ElevenLabs custom voice
- Fully conversational AI — handles silences, small talk, circles back naturally
- Spanish / English per lead
- Auto-fills credit score, income, down payment, area, timeline from call
- Lead quality rating 1-10 after every call
- Call recordings with audio player
- Drag-and-drop Kanban pipeline
- AI Sales Manager + AI Caller chat agents
- Training notes fed to agents on every call
- Meta Ads webhook for auto lead import
- Theme color customization
