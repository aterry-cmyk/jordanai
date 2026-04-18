import { db } from './db'
import { analyzeCall } from './ai'

export async function runPostCallAnalysis(
  callId: string,
  history: { role: string; content: string }[],
  extracted: Record<string, string>
) {
  try {
    const transcript = history
      .filter(m => m.content && m.content !== '[silence]')
      .map(m => `${m.role === 'user' ? 'Lead' : 'Agent'}: ${m.content}`)
      .join('\n')

    if (!transcript.trim()) { console.log('[POST-CALL] Empty transcript, skipping'); return }

    console.log('[POST-CALL] Analyzing call:', callId)
    const analysis = await analyzeCall(transcript)
    console.log('[POST-CALL] Result:', JSON.stringify(analysis))

    // Update call record
    await db().from('calls').update({
      transcript,
      ai_summary:  analysis.summary,
      ai_rating:   analysis.rating,
      temperature: analysis.temperature,
      next_action: analysis.next_action,
      ended_at:    new Date().toISOString(),
    }).eq('id', callId)

    // Get lead_id from call
    const { data: call } = await db().from('calls').select('lead_id').eq('id', callId).single()
    if (!call?.lead_id) { console.log('[POST-CALL] No lead_id found'); return }

    // Build lead updates
    const updates: Record<string, any> = {
      temperature:    analysis.temperature,
      ai_analysis:    analysis.summary,
      next_action:    analysis.next_action,
      lead_rating:    analysis.rating,
      interest_level: analysis.interest_level,
      updated_at:     new Date().toISOString(),
    }

    if (analysis.credit_score  || extracted.credit_score)   updates.credit_score   = analysis.credit_score  || extracted.credit_score
    if (analysis.income        || extracted.income)          updates.income         = analysis.income        || extracted.income
    if (analysis.down_payment  || extracted.down_payment)    updates.down_payment   = analysis.down_payment  || extracted.down_payment
    if (analysis.looking_to_buy|| extracted.looking_to_buy)  updates.looking_to_buy = analysis.looking_to_buy|| extracted.looking_to_buy
    if (analysis.timeline      || extracted.timeline)        updates.timeline       = analysis.timeline      || extracted.timeline
    if (analysis.appointment_set) updates.stage = 'appointment_set'
    if (analysis.doc_request)  { updates.stage = 'doc_request'; updates.doc_request_date = new Date().toISOString() }

    const { error } = await db().from('leads').update(updates).eq('id', call.lead_id)
    if (error) console.log('[POST-CALL] Lead update error:', error.message)
    else console.log('[POST-CALL] Lead updated successfully:', call.lead_id)

  } catch (e: any) {
    console.error('[POST-CALL ERROR]', e.message)
  }
}
