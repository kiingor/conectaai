import { NextRequest, NextResponse } from 'next/server'

const EVOLUTION_BASE_URL = 'https://evolution.conectaai.net'
const EVOLUTION_GLOBAL_KEY =
  'eVo2026xK9mT4wBqL7nRjZ3cY8hF1dSgP5vA0iUoWlEbNfQrHs'

/** DELETE — Remove instância da EvolutionAPI */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ instanceName: string }> },
) {
  try {
    const { instanceName } = await params

    await fetch(`${EVOLUTION_BASE_URL}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: { apikey: EVOLUTION_GLOBAL_KEY },
    })

    // Retorna sucesso independente do resultado (pode não existir)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Evolution Instance Delete]', error)
    return NextResponse.json({ success: true })
  }
}
