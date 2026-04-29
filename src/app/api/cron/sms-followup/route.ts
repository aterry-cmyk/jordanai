import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const FROM_NUMBER = '+12026492766';

const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

function getSmsTemplate(firstName: string, lang: 'en' | 'es'): string {
  if (lang === 'es')
    return `Hola ${firstName}, te acabo de dejar un mensaje de voz de Dream Key Lending. Te llamo porque mostraste interés en comprar casa. ¿Tienes un minuto para hablar? Responde aquí o llámame de vuelta.`;
  return `Hi ${firstName}, I just left you a voicemail from Dream Key Lending. I'm calling because you showed interest in buying a home. Do you have a minute to chat? Reply here or call me back.`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return processPendingFollowUps();
}

export async function POST() {
  return processPendingFollowUps();
}

async function processPendingFollowUps() {
  const now = new Date().toISOString();

  const { data: leads, error } = await db()
    .from('leads')
    .select('*')
    .eq('pending_followup_channel', 'sms')
    .lte('pending_followup_at', now)
    .is('dnc', null)
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!leads || leads.length === 0) return NextResponse.json({ processed: 0 });

  const results = [];

  for (const lead of leads) {
    try {
      const firstName = (lead.first_name || '').trim() || (lead.language === 'es' ? 'amigo' : 'there');
      const lang: 'en' | 'es' = lead.language || 'en';
      const message = getSmsTemplate(firstName, lang);

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
      if (!res.ok) { results.push({ lead_id: lead.id, status: 'failed' }); continue; }

      await db().from('sms_messages').insert({
        lead_id: lead.id, direction: 'outbound', body: message,
        telnyx_message_id: data?.data?.id, status: 'sent',
        from_number: FROM_NUMBER, to_number: lead.phone,
        triggered_by: 'voicemail_followup',
      });

      await db().from('leads').update({
        last_sms_at: new Date().toISOString(),
        pending_followup_channel: null,
        pending_followup_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id);

      results.push({ lead_id: lead.id, status: 'sent' });
    } catch (e: any) {
      results.push({ lead_id: lead.id, status: 'error', error: e.message });
    }
  }

  const sent = results.filter(r => r.status === 'sent').length;
  return NextResponse.json({ processed: leads.length, sent, results });
}
