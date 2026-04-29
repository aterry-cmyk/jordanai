import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = body?.data;
    const eventType = event?.event_type;

    if (eventType !== 'message.received')
      return NextResponse.json({ received: true });

    const payload = event?.payload;
    const fromNumber = payload?.from?.phone_number;
    const toNumber = payload?.to?.[0]?.phone_number;
    const bodyText = payload?.text;
    const telnyxMessageId = payload?.id;

    if (!fromNumber || !bodyText)
      return NextResponse.json({ received: true, note: 'missing fields' });

    const { data: lead } = await db()
      .from('leads').select('id, first_name, language')
      .eq('phone', fromNumber).single();

    const leadId = lead?.id || null;

    await db().from('sms_messages').insert({
      lead_id: leadId,
      direction: 'inbound',
      body: bodyText,
      telnyx_message_id: telnyxMessageId,
      status: 'received',
      from_number: fromNumber,
      to_number: toNumber,
    });

    if (leadId) {
      await db().from('leads').update({
        last_sms_reply_at: new Date().toISOString(),
        last_sms_reply: bodyText,
        temperature: 'WARM',
        updated_at: new Date().toISOString(),
      }).eq('id', leadId);
    }

    return NextResponse.json({ received: true, lead_id: leadId });
  } catch (e: any) {
    return NextResponse.json({ received: true, error: e.message });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'telnyx sms webhook' });
}
