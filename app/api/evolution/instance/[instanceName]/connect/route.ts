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

    const response = await fetch(`${EVOLUTION_BASE_URL}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: { apikey: EVOLUTION_GLOBAL_KEY },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Evolution Connect]', data)
      return NextResponse.json(
        { error: 'Erro ao obter QR Code', details: data },
        { status: response.status },
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Evolution Instance Connect]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
