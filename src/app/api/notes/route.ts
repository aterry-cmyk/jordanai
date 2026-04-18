export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const { data } = await db().from('training_notes').select('*').order('created_at', { ascending: false })
  return NextResponse.json(data || [])
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data } = await db().from('training_notes').insert(body).select().single()
  return NextResponse.json(data, { status: 201 })
}
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  await db().from('training_notes').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
