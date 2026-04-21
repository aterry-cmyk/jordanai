import { NextRequest, NextResponse } from 'next/server';

const VAPI = 'https://api.vapi.ai';
const h = () => ({ 'Authorization': `Bearer ${process.env.VAPI_API_KEY}`, 'Content-Type': 'application/json' });

export async function GET() {
  const res = await fetch(`${VAPI}/assistant`, { headers: h() });
  return NextResponse.json(await res.json());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.readOnly) {
      const res = await fetch(`${VAPI}/assistant/${body.vapiAssistantId}`, { headers: h() });
      return NextResponse.json(await res.json());
    }
    return NextResponse.json({ message: 'Assistants are configured directly in Vapi dashboard.' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
