export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const { data: leads } = await db().from('leads').select('*').order('created_at', { ascending: false })
  const headers = ['first_name','last_name','phone','email','zip_code','loan_amount','credit_score','income','down_payment','looking_to_buy','timeline','lead_rating','source','language','stage','temperature','notes','created_at']
  const csv = [
    headers.join(','),
    ...(leads || []).map(l => headers.map(h => `"${((l as any)[h] || '').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().split('T')[0]}.csv"`
    }
  })
}
