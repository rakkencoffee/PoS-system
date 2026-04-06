import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([]); // Toppings handled via variants/groups in Olsera POS
}
