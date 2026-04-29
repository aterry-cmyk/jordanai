import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const VAPI = 'https://api.vapi.ai';
const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
const headers = () => ({
  Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
  'Content-Type': 'application/json',
});

export async function POST(req: NextRequest) {
  try {
    const { leadId, forceLanguage } = await req.json();
    if (!leadId)
      return NextResponse.json({ error: 'leadId required' }, { status: 400 });

    const { data: lead } = await db()
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();
    if (!lead?.phone)
      return NextResponse.json(
        { error: 'Lead not found or no phone' },
        { status: 404 }
      );

    const lang: 'en' | 'es' = forceLanguage || lead.language || 'en';

    const { data: asst } = await db()
      .from('vapi_assistants')
      .select('vapi_assistant_id')
      .eq('language', lang)
      .single();
    if (!asst?.vapi_assistant_id)
      return NextResponse.json(
        { error: `No assistant for language: ${lang}` },
        { status: 400 }
      );

    const { count } = await db()
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId);
    const attempt = (count || 0) + 1;

    const firstName =
      (lead.first_name || '').trim() || (lang === 'es' ? 'amigo' : 'there');

    // CRITICAL FIX: SHORT first message, NOT a full sentence.
    // Vapi has a known bug where the assistant speaks during ringing.
    // A single word ends quickly; long messages get cut off.
    // Source: Vapi community thread "The assistant speaks before the call is answered on outbound calls"
    const firstMessage = lang === 'es' ? '¿Hola?' : 'Hello?';

    // Voicemail message — short, personalized, primes SMS follow-up
    const voicemailMessage =
      lang === 'es'
        ? `Hola ${firstName}, soy Vero de Dream Key Lending. Vi que mostraste interés en comprar casa por Facebook. Te llamo para ayudarte con un plan rápido. Te voy a mandar un texto ahorita con más info. ¡Hablamos!`
        : `Hi ${firstName}, this is Vero from Dream Key Lending. I saw you showed interest in buying a home through Facebook. I'm calling to help you with a quick plan. I'll send you a text right now with more info. Talk soon!`;

    // Idle messages — what Vero says if there's silence after greeting
    // These also keep the audio loop alive during ringing → answer transition
    const idleMessages =
      lang === 'es'
        ? ['¿Hola, me escucha?', '¿Sigue ahí?', 'Disculpe, ¿me puede escuchar?']
        : ['Hello, can you hear me?', 'Are you still there?', "Sorry, can you hear me?"];

    const silenceTimeoutMessage =
      lang === 'es'
        ? '¿Hola, me escucha?'
        : 'Hello, can you hear me?';

    const res = await fetch(`${VAPI}/call`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        assistantId: asst.vapi_assistant_id,
        customer: {
          number: lead.phone,
          name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
        },
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        assistantOverrides: {
          // SHORT first message — single word
          firstMessage,

          // Voicemail message
          voicemailMessage,

          // Override microphoneTimeout — give it 60 seconds to handle ring + voicemail pickup
          silenceTimeoutSeconds: 60,
          maxDurationSeconds: 600,

          // CRITICAL: messagePlan with idleMessages
          // This keeps the audio loop alive during ring → answer transition
          // and prevents the 15-second microphoneTimeout from firing
          messagePlan: {
            idleMessages,
            idleMessageMaxSpokenCount: 3,
            idleTimeoutSeconds: 8,
            silenceTimeoutMessage,
          },

          // Voicemail detection
          voicemailDetection: {
            provider: 'vapi',
            backoffPlan: {
              startAtSeconds: 5,
              frequencySeconds: 5,
              maxRetries: 6,
            },
            beepMaxAwaitSeconds: 10,
          },

          // Don't auto-end on first response
          endCallMessage: '',
          endCallPhrases: [],

          variableValues: {
            first_name: firstName,
          },
        },
        metadata: {
          leadId,
          language: lang,
          attemptNumber: attempt,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok)
      return NextResponse.json(
        { error: data?.message || 'Vapi error', details: data },
        { status: res.status }
      );

    await db().from('calls').insert({
      lead_id: leadId,
      vapi_call_id: data.id,
      call_type: 'outbound',
      attempt_number: attempt,
      status: 'initiated',
    });
    await db()
      .from('leads')
      .update({
        call_attempts: attempt,
        last_called_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    return NextResponse.json({ success: true, call_id: data.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
