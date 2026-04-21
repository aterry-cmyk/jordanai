import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function extractDisp(text: string) { return text?.match(/\[DISPOSITION:([A-Z_]+)\]/)?.[1] || null; }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message || body;
    const type = message?.type;
    const call = message?.call || {};
    const vapiCallId = call?.id;

    console.log('[WH]', type, 'call:', vapiCallId);

    if (type === 'end-of-call-report' && vapiCallId) {
      const transcript = message.transcript || message.artifact?.transcript || '';
      const recordingUrl = message.recordingUrl || message.artifact?.recordingUrl || '';
      const duration = message.durationSeconds || message.duration || 0;
      const sd = message.analysis?.structuredData || {};
      const summary = message.analysis?.summary || '';
      const disposition = (sd.disposition || extractDisp(transcript) || extractDisp(summary) || 'UNKNOWN').toUpperCase();

      console.log('[WH] EOCR data: dur=', duration, 'rec=', !!recordingUrl, 'tr=', transcript.length, 'disp=', disposition);

      const { error } = await db().from('calls').update({
        duration_seconds: Math.round(duration),
        transcript,
        recording_url: recordingUrl,
        disposition,
        ai_summary: summary,
        ended_reason: message.endedReason || 'unknown',
        qualification_data: sd,
      }).eq('vapi_call_id', vapiCallId);

      if (error) console.error('[WH] UPDATE ERROR:', JSON.stringify(error));
      else console.log('[WH] UPDATE OK');

      return NextResponse.json({ received: true, vapiCallId, disposition, duration, updated: !error });
    }

    if (type === 'status-update' && vapiCallId) {
      const status = message.status || 'in-progress';
      await db().from('calls').update({ status }).eq('vapi_call_id', vapiCallId);
      return NextResponse.json({ received: true, status });
    }

    return NextResponse.json({ received: true, type });
  } catch (e: any) {
    console.error('[WH] CRASH:', e.message);
    return NextResponse.json({ received: true, error: e.message });
  }
}
