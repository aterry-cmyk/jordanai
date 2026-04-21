import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const VAPI = 'https://api.vapi.ai';
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const headers = () => ({ 'Authorization': `Bearer ${process.env.VAPI_API_KEY}`, 'Content-Type': 'application/json' });

export async function POST(req: NextRequest) {
  try {
    const { leadId, forceLanguage } = await req.json();
    if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

    const { data: lead } = await db().from('leads').select('*').eq('id', leadId).single();
    if (!lead?.phone) return NextResponse.json({ error: 'Lead not found or no phone' }, { status: 404 });

    const lang: 'en' | 'es' = forceLanguage || lead.language || 'en';
    const { data: asst } = await db().from('vapi_assistants').select('vapi_assistant_id').eq('language', lang).single();
    if (!asst?.vapi_assistant_id) return NextResponse.json({ error: `No assistant for language: ${lang}` }, { status: 400 });

    const { count } = await db().from('calls').select('*', { count: 'exact', head: true }).eq('lead_id', leadId);
    const attempt = (count || 0) + 1;

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
        metadata: { leadId, language: lang, attemptNumber: attempt },
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.message || 'Vapi error', details: data }, { status: res.status });

    await db().from('calls').insert({ lead_id: leadId, vapi_call_id: data.id, call_type: 'outbound', attempt_number: attempt, status: 'initiated' });
    await db().from('leads').update({ call_attempts: attempt, last_called_at: new Date().toISOString() }).eq('id', leadId);

    return NextResponse.json({ success: true, call_id: data.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
