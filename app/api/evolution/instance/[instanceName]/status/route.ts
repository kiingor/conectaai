import { NextRequest, NextResponse } from 'next/server'

const EVOLUTION_BASE_URL = 'https://evolution.conectaai.net'
const EVOLUTION_GLOBAL_KEY =
  'eVo2026xK9mT4wBqL7nRjZ3cY8hF1dSgP5vA0iUoWlEbNfQrHs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ instanceName: string }> },
) {
  try {
    const { instanceName } = await params

    const response = await fetch(
      `${EVOLUTION_BASE_URL}/instance/connectionState/${instanceName}`,
      {
        method: 'GET',
        headers: { apikey: EVOLUTION_GLOBAL_KEY },
      },
    )

    if (response.status === 404) {
      return NextResponse.json({ instance: { state: 'not_found' } })
    }

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ instance: { state: 'unknown' } })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Evolution Instance Status]', error)
    return NextResponse.json({ instance: { state: 'unknown' } })
  }
}
