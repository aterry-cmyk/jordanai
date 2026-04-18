export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }

function esc(s: string) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function twiml(body: string): Response {
  const raw = '<?xml version="1.0" encoding="UTF-8"?><Response>' + body + '</Response>'
  return new Response(raw, {
    status: 200,
    headers: {
      'Content-Type': 'text/xml',
      'Content-Length': String(Buffer.byteLength(raw, 'utf8')),
    },
  })
}

async function handle(req: NextRequest) {
  const callId = req.nextUrl.searchParams.get('callId')
  const host   = req.headers.get('host') || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ('https://' + host)

  console.log('[START] callId=' + callId)

  if (!callId) {
    return twiml('<Say voice="Polly.Joanna-Neural" language="en-US">Hi there, thanks for picking up. We will call you back shortly.</Say><Hangup/>')
  }

  const { data: conv } = await db()
    .from('call_conversations')
    .select('*')
    .eq('call_id', callId)
    .single()

  let opening   = 'Hi there, is now a good time to chat about home financing?'
  let isSpanish = false

  if (conv) {
    const h = (conv.history as any[]) || []
    opening   = h[0]?.content || opening
    isSpanish = conv.language === 'es'
  } else {
    const { data: call } = await db().from('calls').select('lead_id, voice_id').eq('id', callId).single()
    if (call) {
      const { data: lead } = await db().from('leads').select('first_name, language').eq('id', call.lead_id).single()
      if (lead) {
        isSpanish = lead.language === 'es'
        const name = lead.first_name || 'there'
        opening = isSpanish
          ? 'Hola, hablo con ' + name + '? Mi nombre es Alex y le llamo porque mostro interes en financiamiento para vivienda. Tiene un par de minutos?'
          : 'Hi, is this ' + name + '? My name is Alex and I am calling because you expressed interest in home financing. Do you have a couple of minutes?'
        await db().from('call_conversations').insert({
          call_id: callId,
          history: [{ role: 'assistant', content: opening }],
          extracted: {},
          voice: 'Polly.Joanna-Neural',
          language: lead.language || 'en',
          script_theme: 'home financing',
        })
      }
    }
  }

  await db().from('calls').update({ status: 'in_progress' }).eq('id', callId)

  const voice    = isSpanish ? 'Polly.Lupe-Neural' : 'Polly.Joanna-Neural'
  const lang     = isSpanish ? 'es-US' : 'en-US'
  const fallback = isSpanish
    ? 'No le escuche. Le llamare luego. Que tenga un excelente dia.'
    : 'I did not catch that. I will try you again soon. Have a great day.'
  const gather   = appUrl + '/api/twiml/gather?callId=' + callId + '&amp;step=1'

  return twiml(
    '<Gather input="speech" timeout="7" speechTimeout="auto" action="' + gather + '" method="POST">' +
    '<Say voice="' + voice + '" language="' + lang + '">' + esc(opening) + '</Say>' +
    '</Gather>' +
    '<Say voice="' + voice + '" language="' + lang + '">' + esc(fallback) + '</Say>' +
    '<Hangup/>'
  )
}
