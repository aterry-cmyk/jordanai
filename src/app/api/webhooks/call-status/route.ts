import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = body.data?.event_type;
    const callId = body.data?.payload?.call_control_id;
    const status = event === 'call.answered' ? 'answered'
      : event === 'call.hangup' ? 'completed'
      : event === 'call.initiated' ? 'initiated' : event;

    if (callId && status) {
      await db().from('calls').update({ status, updated_at: new Date().toISOString() })
        .eq('vapi_call_id', callId);
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
