export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chat } from '@/lib/ai'

export async function POST(req: NextRequest) {
  const { message, agent, history } = await req.json()

  const { data: leads } = await db().from('leads').select('first_name, last_name, temperature, lead_rating, stage')
  const hot = (leads || []).filter(l => l.temperature === 'hot')
  const pipeline = `Leads: ${leads?.length || 0}. Hot: ${hot.map(l => `${l.first_name} ${l.last_name}(${l.lead_rating || 0}/10)`).join(', ') || 'none'}. New: ${(leads || []).filter(l => l.stage === 'new_lead').length}.`

  const { data: notes } = await db().from('training_notes').select('title, content, category').limit(10)
  const training = notes?.length ? '\nTraining:\n' + notes.map(n => `[${n.category}] ${n.title}: ${n.content}`).join('\n') : ''

  const systems: Record<string, string> = {
    sales_manager: `You are the AI Sales Manager inside JordanAI for mortgage/real estate. 15yrs exp, $100M+ closed. Direct, high-energy, Grant Cardone style. Reference leads by name. Push for action. Max 120 words unless doing a review. Pipeline: ${pipeline}${training}`,
    caller: `You are the AI Caller inside JordanAI. Grinder, 100+ calls/day. Enthusiastic, detail-oriented. Report clearly: what you did, findings, what needs action. Pipeline: ${pipeline}${training}`
  }

  const reply = await chat(systems[agent] || systems.sales_manager, [...(history || []), { role: 'user', content: message }])
  return NextResponse.json({ reply })
}
