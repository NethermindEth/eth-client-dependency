import { NextResponse } from 'next/server'
import { getDepsData } from '@/lib/data'

export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await getDepsData()
  return NextResponse.json(data)
}
