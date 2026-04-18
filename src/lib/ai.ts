import Anthropic from '@anthropic-ai/sdk'
import { getConfig } from './db'

async function getClient() {
  const apiKey = await getConfig('ANTHROPIC_API_KEY')
  return new Anthropic({ apiKey })
}

export async function chat(
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens = 80
): Promise<string> {
  const client = await getClient()
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001', // Fastest model — much lower latency
    max_tokens: maxTokens,
    system,
    messages
  })
  return res.content[0].type === 'text' ? res.content[0].text : ''
}

export function buildCallSystemPrompt(params: {
  leadName: string
  isSpanish: boolean
  scriptTheme: string
  extracted: Record<string, string>
  trainingNotes: string
}): string {
  const { leadName, isSpanish, scriptTheme, extracted, trainingNotes } = params

  const alreadyKnow = Object.entries(extracted)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')

  return [
    isSpanish
      ? `Eres Alex, asesor de hipotecas hablando con ${leadName} por telefono. SOLO habla en espanol natural y conversacional.`
      : `You are Alex, a friendly mortgage advisor on a phone call with ${leadName}.`,
    '',
    'RULES — READ CAREFULLY:',
    '- MAX 1-2 SHORT sentences. Never more.',
    '- Sound like a real human, not a robot. Casual and warm.',
    '- Ask ONE qualifying question at a time, in natural order:',
    '  1. Renting or own?',
    '  2. Credit score range?',
    '  3. Monthly income?',
    '  4. Down payment saved?',
    '  5. Where looking to buy?',
    '  6. Timeline?',
    alreadyKnow ? `- Already know: ${alreadyKnow}. Skip those, move to next.` : '- Start with question 1.',
    '- If awkward silence: say something light then circle back.',
    '- When qualified and interested: suggest setting up a call with a specialist.',
    '- If not interested: close warmly.',
    '- NEVER guarantee rates. TCPA compliant.',
    '- Output ONLY what you say out loud. Nothing else.',
    trainingNotes ? `\nContext: ${trainingNotes}` : '',
  ].filter(Boolean).join('\n')
}

export async function analyzeCall(transcript: string): Promise<{
  summary: string; rating: number; temperature: string
  appointment_set: boolean; doc_request: boolean; next_action: string
  credit_score: string; income: string; down_payment: string
  looking_to_buy: string; timeline: string; interest_level: string
}> {
  const client = await getClient()
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: 'Analyze this mortgage phone call. Return ONLY valid JSON with these exact keys: summary (2 sentences), rating (1-10), temperature (hot/warm/cold/not_interested), appointment_set (boolean), doc_request (boolean), next_action (1 sentence), credit_score (string or ""), income (string or ""), down_payment (string or ""), looking_to_buy (string or ""), timeline (string or ""), interest_level (string or "")',
    messages: [{ role: 'user', content: `Transcript:\n${transcript}` }]
  })
  const text = res.content[0].type === 'text' ? res.content[0].text : '{}'
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return {
      summary: 'Call completed', rating: 0, temperature: 'cold',
      appointment_set: false, doc_request: false, next_action: 'Follow up',
      credit_score: '', income: '', down_payment: '',
      looking_to_buy: '', timeline: '', interest_level: ''
    }
  }
}

export function extractFromSpeech(speech: string, existing: Record<string, string>): Record<string, string> {
  const text = speech.toLowerCase()
  const out = { ...existing }
  if (!out.credit_score) {
    const m = text.match(/\b(\d{3})\b/)
    if (m && parseInt(m[1]) >= 300 && parseInt(m[1]) <= 850) out.credit_score = m[1]
    if (/excellent|excelente/.test(text)) out.credit_score = '750+'
    if (/good credit|buen cr/.test(text)) out.credit_score = '680-750'
    if (/fair|regular/.test(text)) out.credit_score = '620-680'
    if (/poor|bad|malo/.test(text)) out.credit_score = 'below 620'
  }
  if (!out.income) {
    const m = text.match(/\$?([\d,]+)k?\s*(a month|per month|monthly|al mes)/i)
    if (m) out.income = '$' + m[1] + '/mo'
  }
  if (!out.down_payment) {
    const m = text.match(/\$?([\d,]+k?)\s*(down|enganche)/i)
    if (m) out.down_payment = '$' + m[1]
  }
  if (!out.timeline) {
    if (/asap|right away|ahora|ya/.test(text)) out.timeline = 'ASAP'
    const m = text.match(/(\d+)\s*months?/)
    if (m) out.timeline = m[1] + ' months'
    if (/this year|este ano/.test(text)) out.timeline = 'this year'
  }
  return out
}
