export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from '@/lib/db'

export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('sid')
  if (!sid) return new NextResponse('Missing sid', { status: 400 })

  const accountSid = await getConfig('TWILIO_ACCOUNT_SID')
  const authToken  = await getConfig('TWILIO_AUTH_TOKEN')

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${sid}.mp3`,
    { headers: { 'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64') } }
  )

  if (!res.ok) return new NextResponse('Recording not found', { status: 404 })

  const audio = await res.arrayBuffer()
  return new NextResponse(audio, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=3600' }
  })
}
