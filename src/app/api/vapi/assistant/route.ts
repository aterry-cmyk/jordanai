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
