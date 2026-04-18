import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const STAGE: Record<string, string> = { HOT:'Appt', APPOINTMENT_SET:'Appt', WARM:'Contacted', COLD:'Contacted', PREP_CANDIDATE:'Contacted', DEAD:'Closed Lost', NO_ANSWER:'Contacted' };
const TEMP: Record<string, string> = { HOT:'hot', APPOINTMENT_SET:'hot', WARM:'warm', COLD:'cold', PREP_CANDIDATE:'warm', DEAD:'cold', NO_ANSWER:'cold' };

function extractDisp(text: string) { return text?.match(/\[DISPOSITION:([A-Z_]+)\]/)?.[1] || null; }

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message) return NextResponse.json({ received: true });

    const { type, call } = message;
    const vapiCallId = call?.id;

    if (type === 'call-started') {
      if (vapiCallId) await db().from('calls').update({ status: 'in-progress' }).eq('vapi_call_id', vapiCallId);
      return NextResponse.json({ received: true });
    }

    if (type === 'end-of-call-report') {
      const sd = message.analysis?.structuredData || {};
      const summary = message.analysis?.summary || '';
      const transcript = message.transcript || '';
      const recordingUrl = message.recordingUrl || '';
      const duration = message.durationSeconds || 0;
      const disposition = (sd.disposition || extractDisp(transcript) || extractDisp(summary) || 'UNKNOWN').toUpperCase();
      const leadId = call?.metadata?.leadId;

      if (vapiCallId) {
        await db().from('calls').update({ status: 'completed', duration_seconds: duration, transcript, recording_url: recordingUrl, disposition, ended_reason: message.endedReason || 'unknown', qualification_data: sd, summary }).eq('vapi_call_id', vapiCallId);
      }

      if (leadId) {
        const updates: Record<string, any> = { last_called_at: new Date().toISOString() };
        if (disposition !== 'UNKNOWN') { updates.stage = STAGE[disposition] || 'Contacted'; updates.temperature = TEMP[disposition] || 'cold'; }
        if (sd.has_ssn != null) updates.has_ssn = sd.has_ssn;
        if (sd.has_itin != null) updates.has_itin = sd.has_itin;
        if (sd.credit_score_range) updates.credit_score_range = sd.credit_score_range;
        if (sd.reported_income) updates.reported_income = sd.reported_income;
        if (sd.current_rent) updates.current_rent = sd.current_rent;
        if (sd.down_payment_available) updates.down_payment_available = sd.down_payment_available;
        if (sd.co_buyer != null) updates.co_buyer = sd.co_buyer;
        if (sd.employment_type) updates.employment_type = sd.employment_type;
        if (sd.target_area) updates.target_area = sd.target_area;
        if (sd.bedroom_preference) updates.bedroom_preference = sd.bedroom_preference;
        if (summary) {
          const { data: cur } = await db().from('leads').select('notes').eq('id', leadId).single();
          const note = `[Call ${new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}] ${summary}`;
          updates.notes = cur?.notes ? `${cur.notes}\n\n${note}` : note;
        }
        await db().from('leads').update(updates).eq('id', leadId);
        if (['HOT','APPOINTMENT_SET'].includes(disposition)) await db().from('sequence_enrollments').update({ status: 'paused' }).eq('lead_id', leadId).eq('status', 'active');
        if (disposition === 'DEAD') await db().from('sequence_enrollments').update({ status: 'cancelled' }).eq('lead_id', leadId).eq('status', 'active');
      }
      return NextResponse.json({ received: true, disposition, leadId });
    }

    if (type === 'hang' && vapiCallId) {
      await db().from('calls').update({ status: 'completed', ended_reason: 'customer-hung-up' }).eq('vapi_call_id', vapiCallId);
    }
    return NextResponse.json({ received: true });
  } catch (e: any) {
    return NextResponse.json({ received: true, error: e.message });
  }
}
