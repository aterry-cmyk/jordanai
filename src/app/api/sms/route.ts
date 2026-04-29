import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const FROM_NUMBER = '+12026492766';

const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function POST(req: NextRequest) {
  try {
    const { leadId, message } = await req.json();
    if (!leadId || !message)
      return NextResponse.json({ error: 'leadId and message required' }, { status: 400 });

    const { data: lead } = await db().from('leads').select('*').eq('id', leadId).single();
    if (!lead?.phone)
      return NextResponse.json({ error: 'Lead not found or no phone' }, { status: 404 });

    const res = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_NUMBER,
        to: lead.phone,
        text: message,
        messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
      }),
    });

    const data = await res.json();
    if (!res.ok)
      return NextResponse.json({ error: data?.errors?.[0]?.detail || 'Telnyx error', details: data }, { status: res.status });

    const telnyxMessageId = data?.data?.id;

    await db().from('sms_messages').insert({
      lead_id: leadId,
      direction: 'outbound',
      body: message,
      telnyx_message_id: telnyxMessageId,
      status: 'sent',
      from_number: FROM_NUMBER,
      to_number: lead.phone,
    });

    await db().from('leads').update({
      last_sms_at: new Date().toISOString(),
      pending_followup_channel: null,
      pending_followup_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', leadId);

    return NextResponse.json({ success: true, message_id: telnyxMessageId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
