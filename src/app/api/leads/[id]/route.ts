export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chat } from '@/lib/ai'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { data, error } = await db()
    .from('leads').update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await db().from('leads').delete().eq('id', params.id)
  return NextResponse.json({ ok: true })
}

// AI analyze lead
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: lead } = await db().from('leads').select('*').eq('id', params.id).single()
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = await chat(
    'Analyze this mortgage lead. Return ONLY valid JSON: { analysis: string (2 sentences), next_action: string, probability: number 0-100, temperature: "hot"|"warm"|"cold", lead_rating: number 1-10 }',
    [{ role: 'user', content: `Name: ${lead.first_name} ${lead.last_name}, Phone: ${lead.phone}, Stage: ${lead.stage}, Source: ${lead.source}, Loan: ${lead.loan_amount}, Credit: ${lead.credit_score}, Income: ${lead.income}, Down: ${lead.down_payment}, Area: ${lead.looking_to_buy}, Timeline: ${lead.timeline}, Notes: ${lead.notes}` }]
  )

  try {
    const parsed = JSON.parse(result.replace(/```json|```/g, '').trim())
    const { data: updated } = await db().from('leads')
      .update({ ...parsed, updated_at: new Date().toISOString() })
      .eq('id', params.id).select().single()
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Parse failed', raw: result }, { status: 500 })
  }
}
