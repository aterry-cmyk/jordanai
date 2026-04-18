export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { chat, buildCallSystemPrompt, extractFromSpeech } from '@/lib/ai'
import { runPostCallAnalysis } from '@/lib/postCall'

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

export async function POST(req: NextRequest) {
  const callId = req.nextUrl.searchParams.get('callId')
  const step   = parseInt(req.nextUrl.searchParams.get('step') || '1')
  const host   = req.headers.get('host') || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ('https://' + host)

  if (!callId) return twiml('<Hangup/>')

  const form   = await req.formData()
  const speech = ((form.get('SpeechResult') as string) || '').trim()

  console.log('[GATHER] step=' + step + ' speech="' + speech + '"')

  const { data: conv } = await db().from('call_conversations').select('*').eq('call_id', callId).single()
  if (!conv) {
    return twiml('<Say voice="Polly.Joanna-Neural" language="en-US">Thank you for your time. Have a great day.</Say><Hangup/>')
  }

  const history   = ((conv.history as any[]) || [])
  const extracted = ((conv.extracted as Record<string, string>) || {})
  const isSpanish = conv.language === 'es'
  const voice     = isSpanish ? 'Polly.Lupe-Neural' : 'Polly.Joanna-Neural'
  const lang      = isSpanish ? 'es-US' : 'en-US'

  history.push({ role: 'user', content: speech || '[silence]' })

  const stopPhrases = ['not interested', 'remove me', 'do not call', 'no gracias', 'no me interesa']
  const wantsStop   = stopPhrases.some(p => speech.toLowerCase().includes(p))

  if (step >= 10 || wantsStop) {
    const closing = wantsStop
      ? (isSpanish ? 'Por supuesto, le entiendo. Le quitare de nuestra lista. Que tenga un excelente dia.' : 'Absolutely, I understand. I will take you off our list. You have a wonderful day.')
      : (isSpanish ? 'Ha sido un placer hablar con usted. Alguien le contactara pronto. Cuidese mucho.' : 'It has been great talking with you. Someone will be in touch soon. You take care.')
    history.push({ role: 'assistant', content: closing })
    await db().from('call_conversations').update({ history, extracted }).eq('call_id', callId)
    runPostCallAnalysis(callId, history, extracted).catch(console.error)
    return twiml('<Say voice="' + voice + '" language="' + lang + '">' + esc(closing) + '</Say><Hangup/>')
  }

  const updatedExtracted = extractFromSpeech(speech, extracted)
  const { data: callRecord } = await db().from('calls').select('lead_id').eq('id', callId).single()
  const { data: lead } = callRecord
    ? await db().from('leads').select('first_name').eq('id', callRecord.lead_id).single()
    : { data: null }
  const { data: notes } = await db().from('training_notes').select('title, content, category').limit(10)
  const trainingNotes = (notes || []).map((n: any) => '[' + n.category + '] ' + n.title + ': ' + n.content).join(' | ')

  const system = buildCallSystemPrompt({
    leadName: lead?.first_name || 'there',
    isSpanish,
    scriptTheme: conv.script_theme || 'home financing',
    extracted: updatedExtracted,
    trainingNotes,
  })

  try {
    const reply      = await chat(system, history, 160)
    history.push({ role: 'assistant', content: reply })
    await db().from('call_conversations').update({ history, extracted: updatedExtracted }).eq('call_id', callId)

    const nextGather = appUrl + '/api/twiml/gather?callId=' + callId + '&amp;step=' + (step + 1)
    const fallback   = isSpanish ? 'No le escuche. Que tenga un excelente dia.' : 'I did not catch that. Have a great day.'

    return twiml(
      '<Gather input="speech" timeout="7" speechTimeout="auto" action="' + nextGather + '" method="POST">' +
      '<Say voice="' + voice + '" language="' + lang + '">' + esc(reply) + '</Say>' +
      '</Gather>' +
      '<Say voice="' + voice + '" language="' + lang + '">' + esc(fallback) + '</Say>' +
      '<Hangup/>'
    )
  } catch (e: any) {
    console.error('[GATHER ERROR]', e.message)
    const retry = appUrl + '/api/twiml/gather?callId=' + callId + '&amp;step=' + step
    const sorry = isSpanish ? 'Disculpe, tuve un problema tecnico. Puede repetir?' : 'Sorry, quick technical issue. Could you say that again?'
    return twiml(
      '<Gather input="speech" timeout="7" speechTimeout="auto" action="' + retry + '" method="POST">' +
      '<Say voice="' + voice + '" language="' + lang + '">' + esc(sorry) + '</Say>' +
      '</Gather>' +
      '<Hangup/>'
    )
  }
}
