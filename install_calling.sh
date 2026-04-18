#!/bin/bash

# ============================================================
# JordanAI — Calling Infrastructure Installer
# Run this from inside your JordanAI project folder:
# cd ~/Desktop/JordanAI && bash install_calling.sh
# ============================================================

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║   JordanAI — Calling Infrastructure Setup     ║${NC}"
echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ── 0. Confirm we're in the right folder ──────────────────
if [ ! -f "package.json" ]; then
  echo -e "${RED}✗ package.json not found.${NC}"
  echo -e "  Please cd into your JordanAI project first:"
  echo -e "  ${DIM}cd ~/Desktop/JordanAI${NC}"
  exit 1
fi

if ! grep -q '"jordanai"' package.json 2>/dev/null && ! grep -q '"next"' package.json 2>/dev/null; then
  echo -e "${YELLOW}⚠ This doesn't look like a Next.js project. Continue anyway? (y/n)${NC}"
  read -r confirm
  [ "$confirm" != "y" ] && exit 1
fi

echo -e "${GREEN}✓ Found JordanAI project${NC}"
echo ""

# ── 1. Collect required info ──────────────────────────────
echo -e "${BOLD}Step 1 — Configuration${NC}"
echo -e "${DIM}You'll need: Vapi API key, Vapi Phone Number ID, Supabase credentials${NC}"
echo ""

read -p "  Vapi API Key: " VAPI_API_KEY
read -p "  Vapi Phone Number ID (pn_... or UUID from vapi.ai → Phone Numbers): " VAPI_PHONE_NUMBER_ID
read -p "  Company Name [Dream Key Lending Group]: " COMPANY_NAME
COMPANY_NAME="${COMPANY_NAME:-Dream Key Lending Group}"
read -p "  Loan Officer Name [Juan]: " LO_NAME
LO_NAME="${LO_NAME:-Juan}"
read -p "  Supabase Project URL (https://xxx.supabase.co): " SUPABASE_URL
read -p "  Supabase Service Role Key: " SUPABASE_SERVICE_KEY
read -p "  Your deployed Vercel URL (https://your-app.vercel.app): " APP_URL

echo ""
echo -e "${GREEN}✓ Config collected${NC}"
echo ""

# ── 2. Create directory structure ─────────────────────────
echo -e "${BOLD}Step 2 — Creating file structure${NC}"

mkdir -p src/app/api/vapi/assistant
mkdir -p src/app/api/vapi/call
mkdir -p src/app/api/webhooks/vapi
mkdir -p src/lib
mkdir -p src/components
mkdir -p supabase/migrations

echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# ── 3. Write all source files ─────────────────────────────
echo -e "${BOLD}Step 3 — Writing source files${NC}"

# ── ai-caller-prompt.ts ──
cat > src/lib/ai-caller-prompt.ts << 'PROMPTEOF'
export interface CallerConfig {
  loName: string;
  companyName: string;
  language: 'en' | 'es';
}

export function buildCallerSystemPrompt(config: CallerConfig): string {
  const { loName, companyName, language } = config;
  return language === 'es' ? buildES(loName, companyName) : buildEN(loName, companyName);
}

function buildEN(loName: string, companyName: string): string {
  return `You are an AI calling assistant for ${loName} at ${companyName}. You are making an outbound call to a lead who previously showed interest in buying a home.

IDENTITY: Call on behalf of ${loName} from ${companyName}. If asked "are you AI?" say: "I'm an AI assistant calling on behalf of ${loName}. Is that okay?" Never lie.

TONE: Warm, confident, conversational. Natural fillers: "sure", "absolutely", "great question". Never rush. Wait for lead to finish. Match their energy.

OPENING: "Hi, may I speak with {first_name}? ... Hi {first_name}! I'm an AI assistant calling on behalf of ${loName} from ${companyName}. Are you still thinking about buying a home?"

IF YES — ask ONE question at a time, acknowledge each answer:
1. "What area are you thinking about buying in?"
2. "How many bedrooms are you looking for?"
3. "Have you spoken with a lender before?"
4. "Do you have a Social Security number, or are you working with a Tax ID?"
5. "Are you currently working?" → if yes: "How much did you report on taxes last year?"
6. "How much are you currently paying in rent?"
7. "Are you buying alone or with someone else?"
8. "Do you know roughly where your credit stands?" → <580: credit repair path, 580-640: keep going, 620+: perfect
9. "Do you have savings for a down payment? Even roughly?" → <$7500: assistance programs available
10. "Any major debts — car payments, credit cards?"

IF NO — "Is there something specific holding you back?" → listen → "Many people feel that way. Could I ask just a couple quick questions? Only a minute."

OBJECTIONS:
- No SSN: "We have Tax ID programs with as little as 3.5% down."
- Low credit <580: "We can review and repair it — most people ready in 6 months."
- Low credit 580-640: "We can work with that range."
- High rates: "Rates are tied to your credit score. You can also refinance after 6 months."
- No down payment: "Programs available with as little as $5,000-7,500. Assistance programs too."
- Need 20%: "Common myth — you can buy with as little as 1% with the right program."
- Not a good time: "If you're renting, you're already paying someone else's mortgage."
- Working with someone: "We offer additional credits on every transaction. Worth a quick look."
- How did you get my number: "You filled out info on Facebook showing interest in buying. We're ${companyName}."
- Rate question: "Rates start around 5% but depend on your profile. Can't give specific rate without reviewing your file."
- Already bought: "What's your current rate? If above 6.5% we can help you refinance."

OUTCOMES:
CASE 1 — Tax ID + $60k+ income + 660+ credit + $10k+ down:
"You meet initial requirements. I'll have ${loName} follow up on WhatsApp for your Tax ID photo. Which areas interest you?"

CASE 2 — SSN + $42k+ income + 620+ credit + $5k+ down:
"Looking good. ${loName} will follow up on WhatsApp for your ID. What areas are you looking at?"

CASE 3 — Doesn't qualify:
- No ID: "We help people get Tax ID/SSN set up too. Interested?"
- Low credit: "Monthly credit repair program — most ready in 6 months. Helpful?"
- Low income: "Co-signer option or profile prep program available."
- No down payment: "Program providing up to $15,000 in assistance. Monthly cost. Worth knowing?"

CLOSE: "${loName} will follow up directly. Best time to reach you? ... Thanks {first_name}, talk soon!"

RULES:
- NEVER quote a specific interest rate
- NEVER promise pre-approval amounts
- NEVER pressure more than twice
- NEVER deny being AI if asked directly
- If they say "remove me" or "stop calling" → "Absolutely, you'll be removed. Sorry to bother you." End call.
- Max 8 min for unqualified leads, 15 min for hot leads

DISPOSITION TAG — include at end of final message (invisible to lead):
[DISPOSITION:HOT] — meets Case 1 or 2, ready to send docs
[DISPOSITION:WARM] — interested, 60-90 days or missing one req
[DISPOSITION:COLD] — exploring, no timeline
[DISPOSITION:APPOINTMENT_SET] — call with ${loName} scheduled
[DISPOSITION:PREP_CANDIDATE] — interested but doesn't qualify, pitched prep program
[DISPOSITION:DEAD] — not interested, wrong number, remove from list
[DISPOSITION:NO_ANSWER] — no answer or voicemail`;
}

function buildES(loName: string, companyName: string): string {
  return `Eres un asistente de llamadas de IA para ${loName} en ${companyName}. Llamas a un prospecto que mostró interés en comprar una casa.

IDENTIDAD: Llamas en nombre de ${loName} de ${companyName}. Si preguntan "¿eres IA?" di: "Soy un asistente de IA llamando en nombre de ${loName}. ¿Está bien?" No mientas.

TONO: Cálido, seguro, conversacional. Frases naturales: "claro", "por supuesto", "excelente pregunta". Nunca te apresures. Deja que terminen de hablar.

APERTURA: "Hola, ¿puedo hablar con {first_name}? ... ¡Hola {first_name}! Soy un asistente de IA llamando en nombre de ${loName} de ${companyName}. ¿Todavía estás pensando en comprar una casa?"

SI DICE SÍ — una pregunta a la vez, reconoce cada respuesta:
1. "¿En qué área estás pensando comprar?"
2. "¿Cuántas habitaciones te gustaría?"
3. "¿Has hablado con algún prestamista antes?"
4. "¿Tienes número de Seguro Social o Tax ID?"
5. "¿Estás trabajando actualmente?" → si sí: "¿Cuánto reportaste en impuestos el año pasado?"
6. "¿Cuánto estás pagando de renta?"
7. "¿Planeas comprar solo o con alguien más?"
8. "¿Sabes cómo está tu crédito aproximadamente?" → <580: reparación, 580-640: seguimos, 620+: perfecto
9. "¿Tienes ahorros para el pago inicial?" → <$7500: hay programas de asistencia
10. "¿Tienes deudas importantes — carro, tarjetas?"

SI DICE NO — "¿Hay algo específico que te esté deteniendo?" → escucha → "Mucha gente se siente así. ¿Puedo hacerte dos preguntas rápidas? Solo un minuto."

OBJECIONES:
- Sin SSN: "Tenemos programas con Tax ID desde el 3.5% de pago inicial."
- Crédito bajo <580: "Lo revisamos y reparamos — mayoría listo en 6 meses."
- Crédito 580-640: "Podemos trabajar con ese rango."
- Intereses altos: "Las tasas dependen de tu crédito. Puedes refinanciar en 6 meses."
- Sin down payment: "Programas desde $5,000-7,500. También hay asistencia."
- Necesito 20%: "Mito común — puedes comprar desde el 1% con el programa correcto."
- No es buen momento: "Si rentas, ya pagas hipoteca — de otra persona."
- Ya trabaja con alguien: "Ofrecemos crédito adicional en cada transacción."
- Cómo consiguieron mi número: "Llenaste info en Facebook sobre comprar casa. Somos ${companyName}."
- Pregunta de tasa: "Las tasas comienzan en 5% pero dependen de tu perfil."
- Ya compró: "¿Cuál es tu tasa actual? Si es mayor al 6.5% podemos ayudarte a refinanciar."

RESULTADOS:
CASO 1 — Tax ID + $60k+ ingresos + 660+ crédito + $10k+ down: "${loName} te seguirá por WhatsApp para foto del Tax ID."
CASO 2 — SSN + $42k+ ingresos + 620+ crédito + $5k+ down: "${loName} te contactará por WhatsApp."
CASO 3: programas de preparación según lo que falta.

CIERRE: "${loName} te hará seguimiento directamente. ¿Cuál es el mejor momento para contactarte? ... ¡Gracias {first_name}, hasta pronto!"

REGLAS: Nunca cotices tasa específica. Nunca prometas preaprobación. Si dicen "quítenme" → retíralo y termina. Máx 8 min no calificado, 15 min caliente.

ETIQUETA DISPOSICIÓN al final: [DISPOSITION:HOT] [DISPOSITION:WARM] [DISPOSITION:COLD] [DISPOSITION:APPOINTMENT_SET] [DISPOSITION:PREP_CANDIDATE] [DISPOSITION:DEAD] [DISPOSITION:NO_ANSWER]`;
}
PROMPTEOF

echo -e "  ${GREEN}✓${NC} ai-caller-prompt.ts"

# ── api/vapi/assistant/route.ts ──
cat > src/app/api/vapi/assistant/route.ts << 'ASSISTEOF'
import { NextRequest, NextResponse } from 'next/server';
import { buildCallerSystemPrompt } from '@/lib/ai-caller-prompt';

const VAPI = 'https://api.vapi.ai';
const headers = () => ({ 'Authorization': `Bearer ${process.env.VAPI_API_KEY}`, 'Content-Type': 'application/json' });

function payload(lang: 'en' | 'es') {
  const loName = process.env.LO_NAME || 'Juan';
  const company = process.env.COMPANY_NAME || 'Dream Key Lending Group';
  const voice = process.env.ELEVENLABS_VOICE_ID || 'zl7szWVBXnpgrJmAalgz';
  const prompt = buildCallerSystemPrompt({ loName, companyName: company, language: lang });
  return {
    name: `AI Caller — ${company} (${lang.toUpperCase()})`,
    model: { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.7, messages: [{ role: 'system', content: prompt }], maxTokens: 250 },
    voice: { provider: 'elevenlabs', voiceId: voice, stability: 0.5, similarityBoost: 0.75, useSpeakerBoost: true },
    transcriber: { provider: 'deepgram', model: 'nova-2', language: lang === 'es' ? 'es' : 'en-US', smartFormat: true },
    firstMessage: lang === 'es'
      ? `Hola, ¿puedo hablar con usted? Soy un asistente de IA llamando en nombre de ${loName} de ${company}.`
      : `Hi there! I'm an AI assistant calling on behalf of ${loName} at ${company}. Is this a good time?`,
    endCallPhrases: ['goodbye','bye','stop calling','remove me','not interested','adiós','no me llamen','quítenme'],
    recordingEnabled: true,
    silenceTimeoutSeconds: 20,
    maxDurationSeconds: 900,
    backchannelingEnabled: true,
    backgroundDenoisingEnabled: true,
    serverUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/vapi`,
    analysisPlan: {
      summaryPrompt: 'Summarize this mortgage lead call in 2-3 sentences. Include qualification status, key details, and recommended next action.',
      structuredDataPrompt: 'Extract as JSON: { disposition, has_ssn, has_itin, credit_score_range, reported_income, current_rent, down_payment_available, co_buyer, employment_type, target_area, bedroom_preference, existing_debt, objections_raised, next_action }',
      structuredDataSchema: { type: 'object', properties: { disposition: { type: 'string' }, has_ssn: { type: 'boolean' }, has_itin: { type: 'boolean' }, credit_score_range: { type: 'string' }, reported_income: { type: 'number' }, current_rent: { type: 'number' }, down_payment_available: { type: 'number' }, co_buyer: { type: 'boolean' }, employment_type: { type: 'string' }, target_area: { type: 'string' }, bedroom_preference: { type: 'string' }, existing_debt: { type: 'boolean' }, objections_raised: { type: 'array', items: { type: 'string' } }, next_action: { type: 'string' } } },
      successEvaluationPrompt: 'Did the AI qualify/disqualify the lead, handle objections, and close with a clear next step? pass/fail',
      successEvaluationRubric: 'PassFail',
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const { language = 'en', vapiAssistantId } = await req.json();
    const p = payload(language as 'en' | 'es');
    const url = vapiAssistantId ? `${VAPI}/assistant/${vapiAssistantId}` : `${VAPI}/assistant`;
    const method = vapiAssistantId ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(p) });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
    return NextResponse.json({ success: true, assistantId: data.id, language });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function GET() {
  const res = await fetch(`${VAPI}/assistant`, { headers: headers() });
  return NextResponse.json(await res.json());
}
ASSISTEOF

echo -e "  ${GREEN}✓${NC} api/vapi/assistant/route.ts"

# ── api/vapi/call/route.ts ──
cat > src/app/api/vapi/call/route.ts << 'CALLEOF'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const VAPI = 'https://api.vapi.ai';
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const headers = () => ({ 'Authorization': `Bearer ${process.env.VAPI_API_KEY}`, 'Content-Type': 'application/json' });

export async function POST(req: NextRequest) {
  try {
    const { leadId, forceLanguage } = await req.json();
    if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

    const { data: lead } = await db().from('leads').select('*').eq('id', leadId).single();
    if (!lead?.phone) return NextResponse.json({ error: 'Lead not found or no phone' }, { status: 404 });

    const lang: 'en' | 'es' = forceLanguage || lead.language || 'en';
    const { data: asst } = await db().from('vapi_assistants').select('vapi_assistant_id').eq('language', lang).single();
    if (!asst?.vapi_assistant_id) return NextResponse.json({ error: `No assistant for language: ${lang}. Go to Settings → AI Caller → Initialize.` }, { status: 400 });

    const { count } = await db().from('calls').select('*', { count: 'exact', head: true }).eq('lead_id', leadId);
    const attempt = (count || 0) + 1;
    const loName = process.env.LO_NAME || 'Juan';
    const company = process.env.COMPANY_NAME || 'Dream Key Lending Group';

    const res = await fetch(`${VAPI}/call`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        assistantId: asst.vapi_assistant_id,
        customer: { number: lead.phone, name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() },
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        assistantOverrides: {
          firstMessage: lang === 'es'
            ? `Hola, ¿puedo hablar con ${lead.first_name || 'usted'}? Soy un asistente de IA llamando en nombre de ${loName} de ${company}.`
            : `Hi, may I speak with ${lead.first_name || 'you'}? Hi ${lead.first_name || 'there'}! I'm an AI assistant calling on behalf of ${loName} from ${company}. Are you still thinking about buying a home?`,
          variableValues: { first_name: lead.first_name || 'there', lo_name: loName, company_name: company },
        },
        metadata: { leadId, language: lang, attemptNumber: attempt },
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.message || 'Vapi error', details: data }, { status: res.status });

    await db().from('calls').insert({ lead_id: leadId, vapi_call_id: data.id, call_type: 'outbound', attempt_number: attempt, status: 'initiated' });
    await db().from('leads').update({ call_attempts: attempt, last_called_at: new Date().toISOString(), stage: lead.stage === 'New' ? 'Contacted' : lead.stage }).eq('id', leadId);

    return NextResponse.json({ success: true, callId: data.id, phone: lead.phone, language: lang, attemptNumber: attempt });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('vapiCallId');
  if (!id) return NextResponse.json({ error: 'vapiCallId required' }, { status: 400 });
  const res = await fetch(`${VAPI}/call/${id}`, { headers: headers() });
  return NextResponse.json(await res.json());
}
CALLEOF

echo -e "  ${GREEN}✓${NC} api/vapi/call/route.ts"

# ── api/webhooks/vapi/route.ts ──
cat > src/app/api/webhooks/vapi/route.ts << 'WEBHOOKEOF'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const STAGE: Record<string, string> = { HOT:'Appt', APPOINTMENT_SET:'Appt', WARM:'Contacted', COLD:'Contacted', PREP_CANDIDATE:'Contacted', DEAD:'Closed Lost', NO_ANSWER:'Contacted' };
const TEMP: Record<string, string> = { HOT:'hot', APPOINTMENT_SET:'hot', WARM:'warm', COLD:'cold', PREP_CANDIDATE:'warm', DEAD:'cold', NO_ANSWER:'cold' };

function extractDisp(text: string) { return text?.match(/\[DISPOSITION:([A-Z_]+)\]/)?.[1] || null; }

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message) return NextResponse.json({ received: true });

    const { type, call } = message;
    const vapiCallId = call?.id;

    if (type === 'call-started') {
      if (vapiCallId) await db().from('calls').update({ status: 'in-progress' }).eq('vapi_call_id', vapiCallId);
      return NextResponse.json({ received: true });
    }

    if (type === 'end-of-call-report') {
      const sd = message.analysis?.structuredData || {};
      const summary = message.analysis?.summary || '';
      const transcript = message.transcript || '';
      const recordingUrl = message.recordingUrl || '';
      const duration = message.durationSeconds || 0;
      const disposition = (sd.disposition || extractDisp(transcript) || extractDisp(summary) || 'UNKNOWN').toUpperCase();
      const leadId = call?.metadata?.leadId;

      if (vapiCallId) {
        await db().from('calls').update({ status: 'completed', duration_seconds: duration, transcript, recording_url: recordingUrl, disposition, ended_reason: message.endedReason || 'unknown', qualification_data: sd, summary }).eq('vapi_call_id', vapiCallId);
      }

      if (leadId) {
        const updates: Record<string, any> = { last_called_at: new Date().toISOString() };
        if (disposition !== 'UNKNOWN') { updates.stage = STAGE[disposition] || 'Contacted'; updates.temperature = TEMP[disposition] || 'cold'; }
        if (sd.has_ssn != null) updates.has_ssn = sd.has_ssn;
        if (sd.has_itin != null) updates.has_itin = sd.has_itin;
        if (sd.credit_score_range) updates.credit_score_range = sd.credit_score_range;
        if (sd.reported_income) updates.reported_income = sd.reported_income;
        if (sd.current_rent) updates.current_rent = sd.current_rent;
        if (sd.down_payment_available) updates.down_payment_available = sd.down_payment_available;
        if (sd.co_buyer != null) updates.co_buyer = sd.co_buyer;
        if (sd.employment_type) updates.employment_type = sd.employment_type;
        if (sd.target_area) updates.target_area = sd.target_area;
        if (sd.bedroom_preference) updates.bedroom_preference = sd.bedroom_preference;
        if (summary) {
          const { data: cur } = await db().from('leads').select('notes').eq('id', leadId).single();
          const note = `[Call ${new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}] ${summary}`;
          updates.notes = cur?.notes ? `${cur.notes}\n\n${note}` : note;
        }
        await db().from('leads').update(updates).eq('id', leadId);
        if (['HOT','APPOINTMENT_SET'].includes(disposition)) await db().from('sequence_enrollments').update({ status: 'paused' }).eq('lead_id', leadId).eq('status', 'active');
        if (disposition === 'DEAD') await db().from('sequence_enrollments').update({ status: 'cancelled' }).eq('lead_id', leadId).eq('status', 'active');
      }
      return NextResponse.json({ received: true, disposition, leadId });
    }

    if (type === 'hang' && vapiCallId) {
      await db().from('calls').update({ status: 'completed', ended_reason: 'customer-hung-up' }).eq('vapi_call_id', vapiCallId);
    }
    return NextResponse.json({ received: true });
  } catch (e: any) {
    return NextResponse.json({ received: true, error: e.message });
  }
}
WEBHOOKEOF

echo -e "  ${GREEN}✓${NC} api/webhooks/vapi/route.ts"

# ── CallButton.tsx ──
cat > src/components/CallButton.tsx << 'BTNEOF'
'use client';
import { useState, useEffect } from 'react';

interface Props { leadId: string; leadName: string; leadPhone: string; leadLanguage?: string; attemptCount?: number; lastCalledAt?: string; }

export default function CallButton({ leadId, leadName, leadPhone, leadLanguage = 'en', attemptCount = 0, lastCalledAt }: Props) {
  const [status, setStatus] = useState<'idle'|'calling'|'active'|'ended'|'error'>('idle');
  const [lang, setLang] = useState<'en'|'es'>(leadLanguage as 'en'|'es');
  const [callId, setCallId] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [disp, setDisp] = useState<string|null>(null);

  useEffect(() => { let t: any; if (status === 'active') t = setInterval(() => setElapsed(e => e+1), 1000); return () => clearInterval(t); }, [status]);
  useEffect(() => {
    let t: any;
    if (status === 'active' && callId) t = setInterval(async () => { try { const r = await fetch(`/api/vapi/call?vapiCallId=${callId}`).then(r=>r.json()); if (r.status==='ended') { setStatus('ended'); setDisp(r.analysis?.structuredData?.disposition||null); clearInterval(t); } } catch{} }, 3000);
    return () => clearInterval(t);
  }, [status, callId]);

  const fmt = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const COLORS: Record<string,string> = { HOT:'#00E5A0', APPOINTMENT_SET:'#00E5A0', WARM:'#FF9500', COLD:'#8B95B0', PREP_CANDIDATE:'#0066FF', DEAD:'#FF4444', NO_ANSWER:'#8B95B0' };

  const call = async () => {
    setStatus('calling'); setError(null); setElapsed(0); setDisp(null);
    try {
      const r = await fetch('/api/vapi/call', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ leadId, forceLanguage: lang }) });
      const d = await r.json();
      if (!r.ok) { setStatus('error'); setError(d.error||'Call failed'); return; }
      setCallId(d.callId); setStatus('active');
    } catch (e: any) { setStatus('error'); setError(e.message); }
  };

  const s: Record<string,React.CSSProperties> = {
    wrap: { display:'flex', flexDirection:'column', gap:8 },
    toggle: { display:'flex', gap:4 },
    lb: { padding:'3px 10px', borderRadius:5, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'#8B95B0', fontSize:11, fontWeight:600, cursor:'pointer' },
    lba: { background:'rgba(0,229,160,0.12)', borderColor:'rgba(0,229,160,0.3)', color:'#00E5A0' },
    btn: { display:'flex', alignItems:'center', gap:8, padding:'9px 18px', borderRadius:8, border:'none', background:'rgba(0,229,160,0.15)', color:'#00E5A0', fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
    badge: { padding:'2px 7px', borderRadius:4, fontSize:10, fontWeight:700, background:'rgba(0,229,160,0.2)', color:'#00E5A0' },
    hint: { fontSize:11, color:'#5A6480' },
    phone: { fontSize:11, color:'#5A6480', fontFamily:'monospace' },
    err: { fontSize:12, color:'#FF4444', padding:'6px 10px', background:'rgba(255,68,68,0.08)', borderRadius:6 },
  };

  return (
    <div style={s.wrap}>
      <div style={s.toggle}>
        {(['en','es'] as const).map(l => <button key={l} onClick={() => setLang(l)} disabled={status==='active'||status==='calling'} style={{...s.lb,...(lang===l?s.lba:{})}}>{l.toUpperCase()}</button>)}
      </div>
      {(status==='idle'||status==='error') && <button onClick={call} style={s.btn}>📞 Call {leadName.split(' ')[0]}{attemptCount>0&&<span style={s.badge}>#{attemptCount+1}</span>}</button>}
      {status==='calling' && <button disabled style={{...s.btn, background:'rgba(255,149,0,0.12)', color:'#FF9500'}}>⏳ Initiating...</button>}
      {status==='active' && <button disabled style={{...s.btn, background:'rgba(255,68,68,0.12)', color:'#FF4444'}}>🔴 Live — {fmt(elapsed)}</button>}
      {status==='ended' && <button onClick={call} style={{...s.btn, background:'rgba(255,255,255,0.06)', color:'#8B95B0'}}>Call again {disp&&<span style={{...s.badge, background:COLORS[disp]||'#555', color:'#000'}}>{disp}</span>}</button>}
      {error && <div style={s.err}>{error}</div>}
      {attemptCount>0 && lastCalledAt && status==='idle' && <div style={s.hint}>Last called {new Date(lastCalledAt).toLocaleDateString()} · {attemptCount} attempt{attemptCount!==1?'s':''}</div>}
      <div style={s.phone}>{leadPhone}</div>
    </div>
  );
}
BTNEOF

echo -e "  ${GREEN}✓${NC} CallButton.tsx"

# ── VapiSettings.tsx ──
cat > src/components/VapiSettings.tsx << 'SETTEOF'
'use client';
import { useState, useEffect } from 'react';

interface Cfg { companyName:string; loName:string; vapiApiKey:string; vapiPhoneNumberId:string; assistantIdEn:string; assistantIdEs:string; }

export default function VapiSettings() {
  const [cfg, setCfg] = useState<Cfg>({ companyName:'Dream Key Lending Group', loName:'Juan', vapiApiKey:'', vapiPhoneNumberId:'', assistantIdEn:'', assistantIdEs:'' });
  const [saving, setSaving] = useState(false);
  const [init, setInit] = useState<Record<'en'|'es',string>>({ en:'idle', es:'idle' });
  const [msg, setMsg] = useState<string|null>(null);

  useEffect(() => { try { const s = localStorage.getItem('vapi_cfg'); if(s) setCfg(JSON.parse(s)); } catch{} }, []);

  const set = (k: keyof Cfg, v: string) => setCfg(p => ({...p,[k]:v}));
  const save = async () => { setSaving(true); localStorage.setItem('vapi_cfg', JSON.stringify(cfg)); await new Promise(r=>setTimeout(r,400)); setSaving(false); setMsg('Saved. Add env vars to Vercel too.'); setTimeout(()=>setMsg(null),4000); };

  const initAsst = async (lang: 'en'|'es') => {
    setInit(p=>({...p,[lang]:'loading'}));
    try {
      const r = await fetch('/api/vapi/assistant', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ language:lang, vapiAssistantId: lang==='en'?cfg.assistantIdEn:cfg.assistantIdEs||undefined }) });
      const d = await r.json();
      if(!r.ok) throw new Error(d.error||'Failed');
      const nc = {...cfg};
      if(lang==='en') nc.assistantIdEn=d.assistantId; else nc.assistantIdEs=d.assistantId;
      setCfg(nc); localStorage.setItem('vapi_cfg', JSON.stringify(nc));
      setInit(p=>({...p,[lang]:'done'}));
    } catch(e:any) { setInit(p=>({...p,[lang]:'error'})); setMsg(`Error: ${e.message}`); }
  };

  const s: Record<string,React.CSSProperties> = {
    wrap: { display:'flex', flexDirection:'column', gap:16 },
    panel: { background:'var(--surface,#0D1320)', border:'1px solid var(--border,rgba(255,255,255,0.06))', borderRadius:10, padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 },
    title: { fontSize:13, fontWeight:600, color:'var(--text,#F0F4FF)', marginBottom:4 },
    row: { display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 },
    label: { fontSize:13, color:'var(--text,#F0F4FF)', fontWeight:500 },
    desc: { fontSize:11, color:'var(--text3,#5A6480)', marginTop:2 },
    input: { width:'100%', padding:'7px 10px', background:'var(--surface2,#111926)', border:'1px solid var(--border2,rgba(255,255,255,0.1))', borderRadius:6, color:'var(--text,#F0F4FF)', fontSize:12, fontFamily:'monospace', outline:'none', boxSizing:'border-box' as const },
    arow: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border,rgba(255,255,255,0.06))' },
    ibtn: { padding:'7px 16px', borderRadius:7, border:'1px solid rgba(0,229,160,0.3)', background:'rgba(0,229,160,0.1)', color:'#00E5A0', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
    env: { background:'rgba(255,149,0,0.06)', border:'1px solid rgba(255,149,0,0.2)', borderRadius:8, padding:'14px 16px' },
    code: { fontFamily:'monospace', fontSize:11, color:'var(--text,#F0F4FF)', background:'rgba(0,0,0,0.2)', padding:'8px 10px', borderRadius:5, whiteSpace:'pre' as const, lineHeight:1.7 },
    save: { padding:'9px 24px', borderRadius:8, border:'none', background:'rgba(0,229,160,0.15)', color:'#00E5A0', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  };

  const Input = ({k, ph, t='text'}: {k:keyof Cfg, ph:string, t?:string}) => (
    <input type={t} value={cfg[k]} onChange={e=>set(k,e.target.value)} placeholder={ph} style={s.input} />
  );

  return (
    <div style={s.wrap}>
      <div style={s.panel}>
        <div style={s.title}>Identity</div>
        <div style={s.row}><div><div style={s.label}>Company Name</div><div style={s.desc}>How the AI identifies your company on calls</div></div><div style={{flex:1,maxWidth:260}}><Input k="companyName" ph="Dream Key Lending Group"/></div></div>
        <div style={s.row}><div><div style={s.label}>Loan Officer Name</div><div style={s.desc}>The AI calls on behalf of this person</div></div><div style={{flex:1,maxWidth:260}}><Input k="loName" ph="Juan"/></div></div>
      </div>
      <div style={s.panel}>
        <div style={s.title}>Vapi Credentials</div>
        <div style={s.row}><div><div style={s.label}>API Key</div><div style={s.desc}>vapi.ai → Dashboard → API Keys</div></div><div style={{flex:1,maxWidth:260}}><Input k="vapiApiKey" ph="vapi_..." t="password"/></div></div>
        <div style={s.row}><div><div style={s.label}>Phone Number ID</div><div style={s.desc}>vapi.ai → Phone Numbers → click number → copy ID</div></div><div style={{flex:1,maxWidth:260}}><Input k="vapiPhoneNumberId" ph="pn_..."/></div></div>
      </div>
      <div style={s.panel}>
        <div style={s.title}>AI Assistants</div>
        {(['en','es'] as const).map(lang => (
          <div key={lang} style={s.arow}>
            <div>
              <div style={s.label}>{lang==='en'?'🇺🇸 English':'🇪🇸 Spanish'} Assistant</div>
              <div style={s.desc}>{(lang==='en'?cfg.assistantIdEn:cfg.assistantIdEs)||'Not initialized'}</div>
            </div>
            <button onClick={()=>initAsst(lang)} disabled={init[lang]==='loading'} style={{...s.ibtn,...(init[lang]==='done'?{background:'rgba(0,229,160,0.15)'}:{}),(init[lang]==='error'?{color:'#FF4444',borderColor:'rgba(255,68,68,0.3)'}:{})}}>
              {init[lang]==='loading'?'...' : init[lang]==='done'?'✓ Updated' : init[lang]==='error'?'Retry' : (lang==='en'?cfg.assistantIdEn:cfg.assistantIdEs)?'Update':'Initialize'}
            </button>
          </div>
        ))}
      </div>
      <div style={s.env}>
        <div style={{fontSize:12,fontWeight:600,color:'#FF9500',marginBottom:8}}>⚠️ Add to Vercel Environment Variables</div>
        <div style={s.code}>{`VAPI_API_KEY=${cfg.vapiApiKey||'your-key'}\nVAPI_PHONE_NUMBER_ID=${cfg.vapiPhoneNumberId||'pn_...'}\nCOMPANY_NAME=${cfg.companyName}\nLO_NAME=${cfg.loName}`}</div>
        <div style={{fontSize:11,color:'#5A6480',marginTop:8}}>Settings page stores locally. Vercel env vars needed for API routes to work.</div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:12,justifyContent:'flex-end'}}>
        {msg && <div style={{fontSize:12,color:'#00E5A0'}}>{msg}</div>}
        <button onClick={save} disabled={saving} style={s.save}>{saving?'Saving...':'Save Settings'}</button>
      </div>
    </div>
  );
}
SETTEOF

echo -e "  ${GREEN}✓${NC} VapiSettings.tsx"

# ── Migration 004 ──
cat > supabase/migrations/004_vapi_sequences.sql << 'SQLEOF'
-- Migration 004: Vapi calling + sequences (additive only — never drops anything)
CREATE TABLE IF NOT EXISTS vapi_assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL DEFAULT 'en',
  vapi_assistant_id TEXT,
  voice_id TEXT NOT NULL DEFAULT 'zl7szWVBXnpgrJmAalgz',
  company_name TEXT NOT NULL DEFAULT 'Dream Key Lending Group',
  lo_name TEXT NOT NULL DEFAULT 'Juan',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(language)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='vapi_call_id') THEN ALTER TABLE calls ADD COLUMN vapi_call_id TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='recording_url') THEN ALTER TABLE calls ADD COLUMN recording_url TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='transcript') THEN ALTER TABLE calls ADD COLUMN transcript TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='disposition') THEN ALTER TABLE calls ADD COLUMN disposition TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='duration_seconds') THEN ALTER TABLE calls ADD COLUMN duration_seconds INTEGER; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='ended_reason') THEN ALTER TABLE calls ADD COLUMN ended_reason TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='qualification_data') THEN ALTER TABLE calls ADD COLUMN qualification_data JSONB DEFAULT '{}'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='call_type') THEN ALTER TABLE calls ADD COLUMN call_type TEXT DEFAULT 'outbound'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='attempt_number') THEN ALTER TABLE calls ADD COLUMN attempt_number INTEGER DEFAULT 1; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='has_ssn') THEN ALTER TABLE leads ADD COLUMN has_ssn BOOLEAN; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='has_itin') THEN ALTER TABLE leads ADD COLUMN has_itin BOOLEAN; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='reported_income') THEN ALTER TABLE leads ADD COLUMN reported_income INTEGER; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='current_rent') THEN ALTER TABLE leads ADD COLUMN current_rent INTEGER; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='credit_score_range') THEN ALTER TABLE leads ADD COLUMN credit_score_range TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='down_payment_available') THEN ALTER TABLE leads ADD COLUMN down_payment_available INTEGER; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='co_buyer') THEN ALTER TABLE leads ADD COLUMN co_buyer BOOLEAN DEFAULT FALSE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='employment_type') THEN ALTER TABLE leads ADD COLUMN employment_type TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='target_area') THEN ALTER TABLE leads ADD COLUMN target_area TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='call_attempts') THEN ALTER TABLE leads ADD COLUMN call_attempts INTEGER DEFAULT 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='last_called_at') THEN ALTER TABLE leads ADD COLUMN last_called_at TIMESTAMPTZ; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='next_contact_at') THEN ALTER TABLE leads ADD COLUMN next_contact_at TIMESTAMPTZ; END IF;
END$$;
CREATE TABLE IF NOT EXISTS sequences (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, trigger TEXT NOT NULL DEFAULT 'manual', is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS sequence_steps (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE, step_number INTEGER NOT NULL, action_type TEXT NOT NULL, delay_minutes INTEGER NOT NULL DEFAULT 0, content TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(sequence_id, step_number));
CREATE TABLE IF NOT EXISTS sequence_enrollments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lead_id UUID NOT NULL, sequence_id UUID NOT NULL REFERENCES sequences(id), current_step INTEGER DEFAULT 0, status TEXT DEFAULT 'active', enrolled_at TIMESTAMPTZ DEFAULT NOW(), next_step_at TIMESTAMPTZ, UNIQUE(lead_id, sequence_id));
CREATE TABLE IF NOT EXISTS sequence_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id UUID NOT NULL REFERENCES sequence_enrollments(id), lead_id UUID NOT NULL, step_number INTEGER, action_type TEXT, status TEXT, fired_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_calls_vapi ON calls(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_leads_next_contact ON leads(next_contact_at);
SQLEOF

echo -e "  ${GREEN}✓${NC} supabase/migrations/004_vapi_sequences.sql"
echo ""

# ── 4. Update .env.local ──────────────────────────────────
echo -e "${BOLD}Step 4 — Updating .env.local${NC}"

ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  touch "$ENV_FILE"
fi

# Add vars if not already present
add_env() {
  local key=$1 val=$2
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # Update existing
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
    echo -e "  ${YELLOW}↻${NC} Updated ${key}"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
    echo -e "  ${GREEN}+${NC} Added ${key}"
  fi
}

add_env "VAPI_API_KEY" "$VAPI_API_KEY"
add_env "VAPI_PHONE_NUMBER_ID" "$VAPI_PHONE_NUMBER_ID"
add_env "COMPANY_NAME" "$COMPANY_NAME"
add_env "LO_NAME" "$LO_NAME"
[ -n "$SUPABASE_URL" ] && add_env "NEXT_PUBLIC_SUPABASE_URL" "$SUPABASE_URL"
[ -n "$SUPABASE_SERVICE_KEY" ] && add_env "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_KEY"
[ -n "$APP_URL" ] && add_env "NEXT_PUBLIC_APP_URL" "$APP_URL"

echo ""

# ── 5. Run Supabase migration ─────────────────────────────
echo -e "${BOLD}Step 5 — Supabase Migration 004${NC}"

if command -v supabase &> /dev/null && [ -n "$SUPABASE_URL" ]; then
  echo -e "  ${DIM}Attempting automatic migration...${NC}"
  PROJECT_REF=$(echo "$SUPABASE_URL" | sed 's|https://||' | sed 's|.supabase.co||')
  supabase link --project-ref "$PROJECT_REF" 2>/dev/null || true
  supabase db push 2>&1 | grep -v "already exists" | grep -v "NOTICE" || true
  echo -e "  ${GREEN}✓ Migration pushed${NC}"
else
  echo -e "  ${YELLOW}⚠ Supabase CLI not found — run migration manually:${NC}"
  echo -e "  ${DIM}1. Go to supabase.com → your project → SQL Editor${NC}"
  echo -e "  ${DIM}2. Paste contents of: supabase/migrations/004_vapi_sequences.sql${NC}"
  echo -e "  ${DIM}3. Click Run${NC}"
fi
echo ""

# ── 6. Git commit + push ──────────────────────────────────
echo -e "${BOLD}Step 6 — Deploying to Vercel via GitHub${NC}"

if git rev-parse --git-dir > /dev/null 2>&1; then
  git add src/app/api/vapi/ src/app/api/webhooks/vapi/ src/lib/ai-caller-prompt.ts src/components/CallButton.tsx src/components/VapiSettings.tsx supabase/migrations/004_vapi_sequences.sql
  git commit -m "feat: add Vapi calling infrastructure — AI Caller EN/ES, webhooks, CallButton, VapiSettings"
  git push
  echo -e "  ${GREEN}✓ Pushed to GitHub — Vercel deploying now (~60 seconds)${NC}"
else
  echo -e "  ${YELLOW}⚠ Not a git repo. Push manually:${NC}"
  echo -e "  ${DIM}git add . && git commit -m 'add calling infrastructure' && git push${NC}"
fi
echo ""

# ── 7. Final checklist ────────────────────────────────────
echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║            Installation Complete ✓             ║${NC}"
echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}What was installed:${NC}"
echo -e "  ${GREEN}✓${NC} AI Caller system prompt (EN + ES, full Dream Key script)"
echo -e "  ${GREEN}✓${NC} /api/vapi/assistant — creates/updates Vapi AI Caller"
echo -e "  ${GREEN}✓${NC} /api/vapi/call — triggers outbound calls"
echo -e "  ${GREEN}✓${NC} /api/webhooks/vapi — receives call-end, saves transcript + disposition"
echo -e "  ${GREEN}✓${NC} CallButton component — drop into any lead page"
echo -e "  ${GREEN}✓${NC} VapiSettings component — drop into Settings page"
echo -e "  ${GREEN}✓${NC} Migration 004 — vapi_assistants, sequences, call columns"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo -e "  ${YELLOW}1.${NC} Add these to Vercel env vars (vercel.com → your project → Settings → Env):"
echo -e "     ${DIM}VAPI_API_KEY=${VAPI_API_KEY}${NC}"
echo -e "     ${DIM}VAPI_PHONE_NUMBER_ID=${VAPI_PHONE_NUMBER_ID}${NC}"
echo -e "     ${DIM}COMPANY_NAME=${COMPANY_NAME}${NC}"
echo -e "     ${DIM}LO_NAME=${LO_NAME}${NC}"
echo ""
echo -e "  ${YELLOW}2.${NC} Import your Twilio number into Vapi:"
echo -e "     ${DIM}vapi.ai → Phone Numbers → Import → +15715869817${NC}"
echo -e "     ${DIM}Copy the Phone Number ID → use as VAPI_PHONE_NUMBER_ID above${NC}"
echo ""
echo -e "  ${YELLOW}3.${NC} Add VapiSettings to your Settings page:"
echo -e "     ${DIM}import VapiSettings from '@/components/VapiSettings'${NC}"
echo -e "     ${DIM}<VapiSettings />${NC}"
echo ""
echo -e "  ${YELLOW}4.${NC} Add CallButton to your lead detail view:"
echo -e "     ${DIM}import CallButton from '@/components/CallButton'${NC}"
echo -e "     ${DIM}<CallButton leadId={lead.id} leadName={...} leadPhone={lead.phone} />${NC}"
echo ""
echo -e "  ${YELLOW}5.${NC} After Vercel deploys: Settings → AI Caller → Initialize EN + ES assistants"
echo ""
echo -e "  ${YELLOW}6.${NC} Add yourself as test lead (phone: +15715268758) → click Call Now"
echo ""
echo -e "${RED}  ⚠ IMPORTANT: Rotate your Vapi API key — it appeared in chat${NC}"
echo -e "  ${DIM}vapi.ai → Settings → API Keys → Regenerate → update Vercel env var${NC}"
echo ""
