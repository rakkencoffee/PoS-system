import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'GET /api/menu/[id] is deprecated.' }, { status: 501 });
}

export async function PUT() {
  return NextResponse.json({ error: 'PUT /api/menu/[id] is deprecated.' }, { status: 501 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'DELETE /api/menu/[id] is deprecated.' }, { status: 501 });
}
