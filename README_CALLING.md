# JordanAI — Calling Infrastructure (Addition Package)
## Version: additions-v1 — Vapi + Sequences foundation

This package adds AI calling to your existing JordanAI codebase.
Drop the files in, run the migration, add 2 env vars, and you're calling.

---

## What's In This Package

```
src/
  app/api/
    vapi/
      assistant/route.ts    ← Create/update AI Caller in Vapi
      call/route.ts         ← Trigger outbound calls
    webhooks/
      vapi/route.ts         ← Receive call-end events → save to Supabase
  lib/
    ai-caller-prompt.ts     ← Full bilingual system prompt (EN + ES)
  components/
    CallButton.tsx          ← Drop-in "Call Now" button for lead pages
    VapiSettings.tsx        ← Settings UI for AI Caller config

supabase/migrations/
  004_vapi_sequences.sql    ← New tables (safe, additive only)
```

---

## Step 1 — Copy files into your JordanAI folder

```bash
# From the unzipped folder, copy everything into your project:
cp -r src/ ~/Desktop/JordanAI/src/
cp supabase/migrations/004_vapi_sequences.sql ~/Desktop/JordanAI/supabase/migrations/
```

---

## Step 2 — Run Migration 004 in Supabase

1. Go to supabase.com → your project → SQL Editor
2. Open the file: `supabase/migrations/004_vapi_sequences.sql`
3. Paste the entire contents → Run
4. You should see: "Success. No rows returned."

This adds: `vapi_assistants`, `sequence_steps`, `sequence_enrollments`, `sequence_events`, `sales_framework` tables.
It also adds new columns to your existing `leads` and `calls` tables.
**Safe to run on top of existing data — additive only, never drops anything.**

---

## Step 3 — Add Environment Variables to Vercel

Go to Vercel → your project → Settings → Environment Variables.
Add these (keep all your existing ones):

```
VAPI_API_KEY=cbd4c407-0f7e-4238-b635-98107dd46975
VAPI_PHONE_NUMBER_ID=<get this from vapi.ai — see below>
COMPANY_NAME=Dream Key Lending Group
LO_NAME=Juan
```

### Getting your VAPI_PHONE_NUMBER_ID:
1. Go to vapi.ai → Phone Numbers
2. Click "Import" → add your Twilio number: +15715869817
3. Vapi will ask for your Twilio Account SID and Auth Token
4. Once imported, click the phone number → copy the "Phone Number ID" (starts with `pn_` or is a UUID)
5. That's your VAPI_PHONE_NUMBER_ID

---

## Step 4 — Add VapiSettings to your Settings page

Find your existing Settings page (usually `src/app/settings/page.tsx` or inside your Settings screen component).

Add this import at the top:
```tsx
import VapiSettings from '@/components/VapiSettings';
```

Add this somewhere in your Settings UI (near the Integrations section):
```tsx
<VapiSettings />
```

---

## Step 5 — Add CallButton to your Lead detail page

Find where you display individual lead details (Conversion module, lead cards, or Deal detail).

Add this import:
```tsx
import CallButton from '@/components/CallButton';
```

Add the button where you want it:
```tsx
<CallButton
  leadId={lead.id}
  leadName={`${lead.first_name} ${lead.last_name}`}
  leadPhone={lead.phone}
  leadLanguage={lead.language || 'en'}
  attemptCount={lead.call_attempts || 0}
  lastCalledAt={lead.last_called_at}
  onCallStarted={(callId) => console.log('Call started:', callId)}
/>
```

---

## Step 6 — Initialize AI Assistants (one-time setup)

1. Deploy to Vercel: `git add . && git commit -m "add calling infrastructure" && git push`
2. Wait for deploy (~60 seconds)
3. Go to your live app → Settings → AI Caller
4. Fill in your Vapi API Key and Phone Number ID
5. Click "Initialize" for English → wait for confirmation
6. Click "Initialize" for Spanish → wait for confirmation
7. Both show "Active" with an assistant ID

This creates the AI Caller in Vapi with:
- Your ElevenLabs voice (zl7szWVBXnpgrJmAalgz)
- The full EN/ES qualification script
- All 30 objection handlers
- Auto-disposition tagging
- Call analysis and structured data extraction

---

## Step 7 — Test Call

1. Add yourself as a test lead:
   - Name: Test Lead
   - Phone: +15715268758 (your number)
   - Language: en

2. Find that lead → click "Call Now"
3. Answer your phone
4. You'll hear the AI introduce itself as calling on behalf of Juan from Dream Key Lending Group
5. Have a full conversation — it will qualify you
6. After you hang up, check the lead record — disposition, transcript, and qualification data should appear within ~30 seconds

---

## How the Webhook Works

When a call ends, Vapi sends a webhook to:
`https://your-app.vercel.app/api/webhooks/vapi`

The webhook:
- Saves the full transcript to `calls` table
- Saves the recording URL
- Extracts structured qualification data (credit, income, ID type, etc.)
- Sets the lead's disposition (HOT / WARM / COLD / etc.)
- Updates the lead's stage in the pipeline
- Updates the lead's qualification fields
- Auto-pauses sequences for HOT leads (human takes over)
- Auto-cancels sequences for DEAD leads

---

## Troubleshooting

**"No Vapi assistant configured for language: en"**
→ You haven't initialized the assistants yet. Go to Settings → AI Caller → Initialize.

**Call fires but phone doesn't ring**
→ Check VAPI_PHONE_NUMBER_ID is set in Vercel env vars and matches what's in vapi.ai.
→ Check that your Twilio number (+15715869817) is imported in vapi.ai → Phone Numbers.

**Call rings but AI is silent**
→ ElevenLabs voice ID might be wrong. Verify `zl7szWVBXnpgrJmAalgz` in your ElevenLabs account.

**Webhook not saving data**
→ Confirm `NEXT_PUBLIC_APP_URL` in Vercel is set to your actual deployed URL (not localhost).
→ Check Vercel function logs for errors: Vercel Dashboard → Functions → /api/webhooks/vapi

**AI sounds robotic / weird pauses**
→ In vapi.ai dashboard, find your assistant → Voice settings → try reducing stability to 0.4
→ You can also adjust `backchannelingEnabled` in the assistant API route

---

## ⚠️ Security Reminder

Your Vapi API key (cbd4c407-0f7e-4238-b635-98107dd46975) appeared in chat.
**Rotate it after testing:**
1. vapi.ai → Settings → API Keys → Regenerate
2. Update VAPI_API_KEY in Vercel env vars
3. Re-initialize your assistants (Step 6)
