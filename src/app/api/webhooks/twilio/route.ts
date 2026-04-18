export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const callSid    = form.get('CallSid')    as string
  const callStatus = form.get('CallStatus') as string
  const duration   = form.get('CallDuration') as string

  const statusMap: Record<string, string> = {
    'in-progress': 'in_progress', 'completed': 'completed',
    'busy': 'no_answer', 'no-answer': 'no_answer', 'failed': 'failed'
  }

  const updates: Record<string, any> = {
    status: statusMap[callStatus] || callStatus
  }
  if (duration) updates.duration = parseInt(duration)
  if (callStatus === 'completed') updates.ended_at = new Date().toISOString()

  await db().from('calls').update(updates).eq('twilio_sid', callSid)

  return new NextResponse('OK', { status: 200 })
}
