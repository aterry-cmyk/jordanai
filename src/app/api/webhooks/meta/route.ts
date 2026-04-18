export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, getConfig } from '@/lib/db'

export async function GET(req: NextRequest) {
  const mode      = req.nextUrl.searchParams.get('hub.mode')
  const token     = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  const verify    = await getConfig('META_VERIFY_TOKEN') || 'jordanai123'
  if (mode === 'subscribe' && token === verify) return new NextResponse(challenge, { status: 200 })
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen') continue
      const lid = change.value?.leadgen_id
      if (!lid) continue
      try {
        const token = await getConfig('META_ACCESS_TOKEN')
        const res   = await fetch(`https://graph.facebook.com/v19.0/${lid}?access_token=${token}`)
        const data  = await res.json()
        const fields: Record<string, string> = {}
        for (const f of data.field_data || []) fields[f.name] = f.values?.[0] || ''
        const name = (fields.full_name || '').split(' ')
        await db().from('leads').insert({
          first_name: fields.first_name || name[0] || '',
          last_name:  fields.last_name  || name.slice(1).join(' ') || '',
          phone:      fields.phone_number || fields.phone || '',
          email:      fields.email || '',
          source:     'Meta Ads',
        })
        console.log('Meta lead received:', fields.first_name, fields.last_name)
      } catch (e: any) { console.error('Meta lead error:', e.message) }
    }
  }
  return new NextResponse('OK', { status: 200 })
}
