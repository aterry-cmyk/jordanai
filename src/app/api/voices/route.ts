export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getAllVoices } from '@/lib/twilio'

export async function GET() {
  const voices = await getAllVoices()
  return NextResponse.json(voices)
}
