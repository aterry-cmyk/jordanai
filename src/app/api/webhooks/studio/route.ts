export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chat } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    
    const callSid  = form.get('CallSid')  as string
    const toNumber = form.get('To')       as string
    const answer1  = form.get('answer_1') as string || '' // renting/owning
    const answer2  = form.get('answer_2') as string || '' // credit score
    const answer3  = form.get('answer_3') as string || '' // income
    const answer4  = form.get('answer_4') as string || '' // down payment
    const answer5  = form.get('answer_5') as string || '' // location
    const answer6  = form.get('answer_6') as string || '' // timeline

    console.log('[STUDIO] CallSid:', callSid, 'To:', toNumber)

    // Build transcript from answers
    const transcript = [
      answer1 ? `Lead (housing): ${answer1}` : '',
      answer2 ? `Lead (credit): ${answer2}` : '',
      answer3 ? `Lead (income): ${answer3}` : '',
      answer4 ? `Lead (down payment): ${answer4}` : '',
      answer5 ? `Lead (location): ${answer5}` : '',
      answer6 ? `Lead (timeline): ${answer6}` : '',
    ].filter(Boolean).join('\n')

    // Find lead by phone number
    const phone = toNumber?.replace(/\D/g, '')
    const { data: leads } = await db()
      .from('leads')
      .select('*')
      .or(`phone.eq.${toNumber},phone.eq.+${phone},phone.eq.${phone}`)
      .limit(1)

    const lead = leads?.[0]
    console.log('[STUDIO] Lead found:', lead?.id, lead?.first_name)

    // Run AI analysis on the answers
    const analysis = await chat(
      `You are analyzing qualifying answers from a mortgage phone call. 
Extract data and return ONLY valid JSON with these keys:
summary (2 sentences about what was learned),
rating (1-10 lead quality score),
temperature (hot/warm/cold/not_interested),
next_action (1 sentence what to do next),
credit_score (extracted from answer or ""),
income (extracted from answer or ""),
down_payment (extracted from answer or ""),
looking_to_buy (location from answer or ""),
timeline (timeline from answer or ""),
housing_situation (renting/owning from answer or "")`,
      [{
        role: 'user',
        content: `Call answers:\n${transcript}\n\nLead name: ${lead?.first_name || 'Unknown'}`
      }],
      300
    )

    let parsed: any = {}
    try {
      parsed = JSON.parse(analysis.replace(/```json|```/g, '').trim())
    } catch {
      console.log('[STUDIO] Parse failed, raw:', analysis)
    }

    // Update lead if found
    if (lead) {
      const updates: Record<string, any> = {
        temperature:     parsed.temperature    || 'cold',
        ai_analysis:     parsed.summary        || transcript,
        next_action:     parsed.next_action    || 'Follow up with lead',
        lead_rating:     parsed.rating         || 0,
        called_count:    (lead.called_count || 0) + 1,
        last_called:     new Date().toISOString(),
        stage:           lead.stage === 'new_lead' ? 'contacted' : lead.stage,
        updated_at:      new Date().toISOString(),
      }
      if (parsed.credit_score)   updates.credit_score   = parsed.credit_score
      if (parsed.income)         updates.income         = parsed.income
      if (parsed.down_payment)   updates.down_payment   = parsed.down_payment
      if (parsed.looking_to_buy) updates.looking_to_buy = parsed.looking_to_buy
      if (parsed.timeline)       updates.timeline       = parsed.timeline

      await db().from('leads').update(updates).eq('id', lead.id)
      console.log('[STUDIO] Lead updated:', lead.id, 'rating:', parsed.rating, 'temp:', parsed.temperature)
    }

    // Save call record
    await db().from('calls').insert({
      lead_id:     lead?.id || null,
      twilio_sid:  callSid,
      status:      'completed',
      transcript,
      ai_summary:  parsed.summary    || '',
      ai_rating:   parsed.rating     || 0,
      temperature: parsed.temperature|| 'cold',
      next_action: parsed.next_action|| '',
      ended_at:    new Date().toISOString(),
    })

    return new NextResponse('OK', { status: 200 })
  } catch (e: any) {
    console.error('[STUDIO ERROR]', e.message)
    return new NextResponse('OK', { status: 200 }) // Always return 200 to Twilio
  }
}
