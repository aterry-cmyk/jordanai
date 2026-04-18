export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, getConfig } from '@/lib/db'

export async function POST(req: NextRequest) {
  const form   = await req.formData()
  const status = form.get('RecordingStatus') as string
  const sid    = form.get('RecordingSid')    as string
  const callSid= form.get('CallSid')         as string

  if (status !== 'completed') return new NextResponse('OK', { status: 200 })

  // Build authenticated URL so audio plays without login popup
  const accountSid = await getConfig('TWILIO_ACCOUNT_SID')
  const authToken  = await getConfig('TWILIO_AUTH_TOKEN')
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL

  // Store recording SID — we'll proxy it through our server
  await db().from('calls').update({
    recording_sid: sid,
    recording_url: `${appUrl}/api/recording?sid=${sid}`,
  }).eq('twilio_sid', callSid)

  return new NextResponse('OK', { status: 200 })
}
