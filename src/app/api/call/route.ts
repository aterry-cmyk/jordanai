export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { placeCall } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  try {
    const { leadId, voiceId, scriptId } = await req.json()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`
    console.log(`[CALL] leadId=${leadId} appUrl=${appUrl}`)

    const { data: lead, error: leadErr } = await db().from('leads').select('*').eq('id', leadId).single()
    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.phone) return NextResponse.json({ error: 'Lead has no phone number' }, { status: 400 })

    let scriptText = ''
    let scriptTheme = 'general home financing inquiry'
    if (scriptId) {
      const { data: script } = await db().from('scripts').select('*').eq('id', scriptId).single()
      if (script) { scriptText = script.script; scriptTheme = script.lead_type || 'general' }
    }

    const opening = (scriptText || `Hi, is this ${lead.first_name || 'there'}? Great! My name is Alex and I'm calling because you expressed interest in home financing options. Do you have a couple minutes?`)
      .replace(/\[LEAD_NAME\]/gi, lead.first_name || 'there')
      .replace(/\[AGENT_NAME\]/gi, 'Alex')

    const { data: callRecord, error: callErr } = await db().from('calls').insert({
      lead_id:   leadId,
      voice_id:  voiceId || 'Polly.Joanna-Neural',
      script_id: scriptId || null,
      status:    'initiating',
    }).select().single()

    if (callErr || !callRecord) {
      console.log('[CALL] Failed to create call record:', callErr?.message)
      return NextResponse.json({ error: 'Failed to create call record: ' + callErr?.message }, { status: 500 })
    }

    await db().from('call_conversations').insert({
      call_id:      callRecord.id,
      history:      [{ role: 'assistant', content: opening }],
      extracted:    {},
      voice:        voiceId || 'Polly.Joanna-Neural',
      language:     lead.language || 'en',
      script_theme: scriptTheme,
    })

    // Check for relay server (ConversationRelay) or fall back to basic TwiML
    const { data: relayConfig } = await db().from('app_config').select('value').eq('key', 'RELAY_URL').single()
    const relayUrl = relayConfig?.value || ''

    const twimlUrl = relayUrl
      ? `${relayUrl}/twiml`
      : `${appUrl}/api/twiml/start?callId=${callRecord.id}`

    const twilioCall = await placeCall({
      to:  lead.phone,
      twimlUrl,
      statusCallbackUrl:   `${appUrl}/api/webhooks/twilio`,
      recordingCallbackUrl:`${appUrl}/api/webhooks/recording`,
    })

    await db().from('calls').update({ twilio_sid: twilioCall.sid, status: 'ringing' }).eq('id', callRecord.id)
    await db().from('leads').update({
      called_count: (lead.called_count || 0) + 1,
      last_called:  new Date().toISOString(),
      stage: lead.stage === 'new_lead' ? 'contacted' : lead.stage,
    }).eq('id', leadId)

    return NextResponse.json({ ok: true, callId: callRecord.id, twilioSid: twilioCall.sid })
  } catch (e: any) {
    console.log('[CALL ERROR]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get('leadId')
  let query = db().from('calls').select('*').order('created_at', { ascending: false }).limit(50)
  if (leadId) query = query.eq('lead_id', leadId)
  const { data } = await query
  return NextResponse.json(data || [])
}
