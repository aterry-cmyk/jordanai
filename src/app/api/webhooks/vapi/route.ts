import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// Extract disposition from transcript or summary tags
function extractDisposition(text: string): string | null {
  if (!text) return null;
  const m = text.match(/\[DISPOSITION:([A-Z_]+)\]/);
  return m?.[1] || null;
}

// Clean transcript of disposition tags before saving
function cleanTranscript(t: string): string {
  if (!t) return '';
  return t.replace(/\[DISPOSITION:[A-Z_]+\]/g, '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message || body;
    const type = message?.type;
    const call = message?.call || {};
    const vapiCallId = call?.id;

    console.log('[VAPI WEBHOOK]', type, 'call:', vapiCallId);

    if (!vapiCallId) {
      return NextResponse.json({ received: true, note: 'no call id' });
    }

    // ===== STATUS UPDATE =====
    if (type === 'status-update') {
      const status = message.status || call.status;
      if (status) {
        await db()
          .from('calls')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('vapi_call_id', vapiCallId);
      }
      return NextResponse.json({ received: true, type: 'status-update', status });
    }

    // ===== END OF CALL REPORT (the main event) =====
    if (type === 'end-of-call-report') {
      const transcriptRaw = message.transcript || message.artifact?.transcript || '';
      const transcript = cleanTranscript(transcriptRaw);
      
      // Recording URLs — Vapi provides these
      const recordingUrl =
        message.recordingUrl ||
        message.artifact?.recordingUrl ||
        message.artifact?.recording?.combinedUrl ||
        '';
      const recordingUrlStereo =
        message.stereoRecordingUrl ||
        message.artifact?.stereoRecordingUrl ||
        message.artifact?.recording?.stereoUrl ||
        '';

      const duration = Math.round(
        message.durationSeconds || message.duration || 0
      );
      const endedReason = message.endedReason || call.endedReason || '';
      const summary = message.analysis?.summary || '';
      const sd = message.analysis?.structuredData || {};

      // Disposition: prefer structured data, fall back to transcript tag
      const disposition = (
        sd.disposition ||
        extractDisposition(transcriptRaw) ||
        extractDisposition(summary) ||
        'UNKNOWN'
      ).toUpperCase();

      console.log('[VAPI WEBHOOK] EOCR:', {
        duration,
        hasRecording: !!recordingUrl,
        hasStereo: !!recordingUrlStereo,
        disposition,
        endedReason,
      });

      // Get the lead_id from the existing call record
      const { data: callRecord } = await db()
        .from('calls')
        .select('lead_id')
        .eq('vapi_call_id', vapiCallId)
        .single();

      const leadId = callRecord?.lead_id || call.metadata?.leadId || null;

      // Update the calls row
      const callUpdate: any = {
        status: 'completed',
        transcript: transcript || null,
        recording_url: recordingUrl || null,
        recording_url_stereo: recordingUrlStereo || null,
        duration_seconds: duration,
        disposition,
        summary: summary || null,
        ended_reason: endedReason || null,
        qualification_data: sd && Object.keys(sd).length > 0 ? sd : null,
        updated_at: new Date().toISOString(),
      };

      const { error: callErr } = await db()
        .from('calls')
        .update(callUpdate)
        .eq('vapi_call_id', vapiCallId);

      if (callErr) {
        console.error('[VAPI WEBHOOK] calls update error:', callErr);
      }

      // Update the lead with qualification data + disposition
      if (leadId) {
        const leadUpdate: any = {
          last_called_at: new Date().toISOString(),
          last_disposition: disposition,
          updated_at: new Date().toISOString(),
        };

        // Map structured data to lead columns
        if (sd.area_interest) leadUpdate.target_area = sd.area_interest;
        if (sd.bedrooms_needed != null) leadUpdate.bedroom_preference = sd.bedrooms_needed;
        if (sd.currently_employed != null) leadUpdate.is_employed = sd.currently_employed;
        if (sd.self_employed != null) leadUpdate.self_employed = sd.self_employed;
        if (sd.annual_income_reported != null) leadUpdate.reported_income = sd.annual_income_reported;
        if (sd.current_rent != null) leadUpdate.current_rent = sd.current_rent;
        if (sd.down_payment_saved != null) leadUpdate.down_payment_available = sd.down_payment_saved;
        if (sd.credit_range) leadUpdate.credit_score_range = sd.credit_range;
        if (sd.co_buyer != null) leadUpdate.co_buyer = sd.co_buyer;
        if (sd.major_debts) leadUpdate.major_debts = sd.major_debts;
        if (sd.id_type) leadUpdate.id_type = sd.id_type;
        if (sd.case_type) leadUpdate.case_type = sd.case_type;

        // Auto-advance lead stage based on disposition
        if (disposition === 'HOT') {
          leadUpdate.stage = 'Qualified';
          leadUpdate.temperature = 'HOT';
          leadUpdate.sequence_paused = true;
        } else if (disposition === 'WARM') {
          leadUpdate.temperature = 'WARM';
        } else if (disposition === 'COLD') {
          leadUpdate.temperature = 'COLD';
        } else if (disposition === 'DEAD' || disposition === 'DNC') {
          leadUpdate.stage = 'Dead';
          leadUpdate.temperature = 'COLD';
          leadUpdate.sequence_paused = true;
          leadUpdate.dnc = disposition === 'DNC';
        } else if (disposition === 'CALLBACK') {
          leadUpdate.temperature = 'WARM';
        }

        const { error: leadErr } = await db()
          .from('leads')
          .update(leadUpdate)
          .eq('id', leadId);

        if (leadErr) {
          console.warn('[VAPI WEBHOOK] leads update partial:', leadErr.message);
          // Retry with only core fields if column missing
          await db()
            .from('leads')
            .update({
              last_called_at: leadUpdate.last_called_at,
              last_disposition: leadUpdate.last_disposition,
              temperature: leadUpdate.temperature || null,
              updated_at: leadUpdate.updated_at,
            })
            .eq('id', leadId);
        }
      }

      return NextResponse.json({
        received: true,
        type: 'end-of-call-report',
        disposition,
        duration,
        leadId,
        hasRecording: !!recordingUrl,
      });
    }

    // ===== TRANSCRIPT (live updates during call — optional logging) =====
    if (type === 'transcript') {
      return NextResponse.json({ received: true, type: 'transcript' });
    }

    // ===== HANG (call ended) =====
    if (type === 'hang') {
      await db()
        .from('calls')
        .update({ status: 'ended', updated_at: new Date().toISOString() })
        .eq('vapi_call_id', vapiCallId);
      return NextResponse.json({ received: true, type: 'hang' });
    }

    return NextResponse.json({ received: true, type, note: 'unhandled' });
  } catch (e: any) {
    console.error('[VAPI WEBHOOK] error:', e);
    return NextResponse.json(
      { received: true, error: e.message },
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'vapi webhook' });
}
