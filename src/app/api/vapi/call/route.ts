import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { leadId } = await req.json();
    if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

    const { data: lead } = await db().from('leads').select('*').eq('id', leadId).single();
    if (!lead?.phone) return NextResponse.json({ error: 'Lead not found or no phone' }, { status: 404 });

    const { count } = await db().from('calls').select('*', { count: 'exact', head: true }).eq('lead_id', leadId);
    const attempt = (count || 0) + 1;

    const res = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: process.env.TELNYX_CONNECTION_ID,
        to: lead.phone,
        from: process.env.TELNYX_PHONE_NUMBER,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/call-status`,
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.errors?.[0]?.detail || 'Telnyx error', details: data }, { status: res.status });

    await db().from('calls').insert({
      lead_id: leadId,
      vapi_call_id: data.data?.call_control_id,
      call_type: 'outbound',
      attempt_number: attempt,
      status: 'initiated',
    });

    await db().from('leads').update({
      call_attempts: attempt,
      last_called_at: new Date().toISOString(),
    }).eq('id', leadId);

    return NextResponse.json({ success: true, call_id: data.data?.call_control_id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
