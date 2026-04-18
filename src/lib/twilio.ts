import twilio from 'twilio'
import { getConfig } from './db'

export async function getTwilioClient() {
  const sid   = await getConfig('TWILIO_ACCOUNT_SID')
  const token = await getConfig('TWILIO_AUTH_TOKEN')
  return twilio(sid, token)
}

export async function placeCall(params: {
  to: string
  twimlUrl: string
  statusCallbackUrl: string
  recordingCallbackUrl: string
}) {
  const client = await getTwilioClient()
  const from   = await getConfig('TWILIO_PHONE_NUMBER')

  return client.calls.create({
    to:   params.to,
    from,
    url:  params.twimlUrl,
    statusCallback:       params.statusCallbackUrl,
    statusCallbackMethod: 'POST',
    statusCallbackEvent:  ['initiated', 'ringing', 'answered', 'completed'],
    record: true,
    recordingStatusCallback:       params.recordingCallbackUrl,
    recordingStatusCallbackMethod: 'POST',
  })
}

export function escXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Available voices
export const VOICES = [
  // Spanish
  { id: 'Polly.Lupe-Neural',    name: 'Lupe (Español Female, US)',    lang: 'es-US' },
  { id: 'Polly.Pedro-Neural',   name: 'Pedro (Español Male, US)',     lang: 'es-US' },
  { id: 'Polly.Mia-Neural',     name: 'Mia (Español Female, Mexico)', lang: 'es-MX' },
  // English
  { id: 'Polly.Joanna-Neural',  name: 'Joanna (English Female)',      lang: 'en-US' },
  { id: 'Polly.Matthew-Neural', name: 'Matthew (English Male)',       lang: 'en-US' },
  { id: 'Polly.Stephen-Neural', name: 'Stephen (English Male)',       lang: 'en-US' },
]

export function getVoiceLang(voiceId: string): string {
  // ElevenLabs voices use their own lang detection
  if (voiceId?.startsWith('elevenlabs_')) {
    return voiceId === 'elevenlabs_es' ? 'es-US' : 'en-US'
  }
  return VOICES.find(v => v.id === voiceId)?.lang || 'en-US'
}

// Get all voices including ElevenLabs custom if configured
export async function getAllVoices() {
  const elVoiceId = await getConfig('ELEVENLABS_VOICE_ID')
  const custom = elVoiceId ? [
    { id: 'elevenlabs_es', name: 'Mi Voz Custom (Español)',  lang: 'es-US', custom: true },
    { id: 'elevenlabs_en', name: 'Mi Voz Custom (English)',  lang: 'en-US', custom: true },
  ] : []
  return [...custom, ...VOICES]
}

// Build TwiML that speaks text and gathers response
export function buildGatherTwiML(params: {
  text: string
  voiceId: string
  gatherUrl: string
  fallbackText: string
}): string {
  const { text, voiceId, gatherUrl, fallbackText } = params
  const voice = voiceId.startsWith('elevenlabs_') || voiceId.startsWith('Polly.')
    ? (voiceId.startsWith('elevenlabs_') ? 'Polly.Joanna-Neural' : voiceId)
    : 'Polly.Joanna-Neural'
  const lang  = getVoiceLang(voice)

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="7" speechTimeout="auto" action="${gatherUrl.replace(/&/g,'&amp;')}" method="POST">
    <Say voice="${voice}" language="${lang}">${escXml(text)}</Say>
  </Gather>
  <Say voice="${voice}" language="${lang}">${escXml(fallbackText)}</Say>
  <Hangup/>
</Response>`
}

export function buildSayHangupTwiML(text: string, voiceId: string): string {
  const voice = voiceId.startsWith('elevenlabs_') ? 'Polly.Joanna-Neural' : (voiceId || 'Polly.Joanna-Neural')
  const lang  = getVoiceLang(voice)
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${lang}">${escXml(text)}</Say>
  <Hangup/>
</Response>`
}
