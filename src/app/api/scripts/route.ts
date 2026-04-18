export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const { data } = await db().from('scripts').select('*').order('created_at', { ascending: false })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (body.is_default) await db().from('scripts').update({ is_default: false }).eq('is_default', true)
  const { data } = await db().from('scripts').insert(body).select().single()
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db().from('scripts').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
