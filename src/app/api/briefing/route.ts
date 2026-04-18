export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chat } from '@/lib/ai'

export async function GET() {
  const { data: leads } = await db().from('leads').select('first_name, last_name, temperature, stage, lead_rating, created_at')
  const hot = (leads || []).filter(l => l.temperature === 'hot')
  const doc = (leads || []).filter(l => l.stage === 'doc_request')
  const today = (leads || []).filter(l => new Date(l.created_at).toDateString() === new Date().toDateString())

  const ctx = `Total leads: ${leads?.length || 0}. Hot: ${hot.map(l => l.first_name + ' ' + l.last_name).join(', ') || 'none'}. Doc requests pending: ${doc.map(l => l.first_name).join(', ') || 'none'}. New today: ${today.length}.`

  const briefing = await chat(
    'You are the AI Sales Manager. Write a morning briefing in 3 short paragraphs: (1) pipeline summary, (2) who needs attention today by name, (3) single most important action right now. Direct. Name names. Max 120 words.',
    [{ role: 'user', content: `Pipeline: ${ctx}` }],
    200
  )

  return NextResponse.json({ briefing })
}
