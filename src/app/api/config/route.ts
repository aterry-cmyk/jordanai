export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, getAllConfig, setConfig } from '@/lib/db'

const SAFE_KEYS = [
  'ANTHROPIC_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID',
  'META_ACCESS_TOKEN', 'META_VERIFY_TOKEN', 'THEME_COLOR', 'APP_NAME'
]

export async function GET() {
  const config = await getAllConfig()
  // Mask secrets, return status only
  return NextResponse.json({
    ANTHROPIC_API_KEY:   config.ANTHROPIC_API_KEY   ? '✓ Set' : '',
    TWILIO_ACCOUNT_SID:  config.TWILIO_ACCOUNT_SID  ? '✓ Set' : '',
    TWILIO_AUTH_TOKEN:   config.TWILIO_AUTH_TOKEN    ? '✓ Set' : '',
    TWILIO_PHONE_NUMBER: config.TWILIO_PHONE_NUMBER  || '',
    ELEVENLABS_API_KEY:  config.ELEVENLABS_API_KEY   ? '✓ Set' : '',
    ELEVENLABS_VOICE_ID: config.ELEVENLABS_VOICE_ID  || '',
    META_VERIFY_TOKEN:   config.META_VERIFY_TOKEN    || 'jordanai123',
    THEME_COLOR:         config.THEME_COLOR          || '#3b82f6',
    APP_NAME:            config.APP_NAME             || 'JordanAI',
    APP_URL:             process.env.NEXT_PUBLIC_APP_URL || '',
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  for (const key of SAFE_KEYS) {
    if (body[key] !== undefined && body[key] !== '') {
      await setConfig(key, body[key])
    }
  }
  return NextResponse.json({ ok: true })
}
