export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const q     = req.nextUrl.searchParams.get('q')
  const stage = req.nextUrl.searchParams.get('stage')

  let query = db().from('leads').select('*').order('created_at', { ascending: false })
  if (stage) query = query.eq('stage', stage)
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Handle bulk import
  if (Array.isArray(body.leads)) {
    const rows = body.leads.map((l: any) => ({
      first_name: (l.first_name || '').trim(),
      last_name:  (l.last_name  || '').trim(),
      phone:      (l.phone      || '').trim(),
      email:      (l.email      || '').trim(),
      zip_code:   (l.zip_code   || '').trim(),
      loan_amount: l.loan_amount || '',
      source:     body.source || 'Manual',
      language:   body.language || l.language || 'en',
      notes:      body.notes || l.notes || '',
    })).filter((l: any) => l.first_name || l.phone || l.email)

    const { data, error } = await db().from('leads').insert(rows).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ imported: data?.length || 0 }, { status: 201 })
  }

  // Single lead
  const { data, error } = await db().from('leads').insert({
    first_name:  (body.first_name || '').trim(),
    last_name:   (body.last_name  || '').trim(),
    phone:       (body.phone      || '').trim(),
    email:       (body.email      || '').trim(),
    zip_code:    (body.zip_code   || '').trim(),
    loan_amount:  body.loan_amount || '',
    source:       body.source || 'Manual',
    language:     body.language || 'en',
    notes:        body.notes || '',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
