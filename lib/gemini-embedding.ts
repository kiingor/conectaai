import { createHash } from 'crypto'

/**
 * Gera embedding via Google Generative Language API (Gemini).
 *
 * Modelo padrão: text-embedding-004 (768 dimensões).
 * Documentação: https://ai.google.dev/gemini-api/docs/embeddings
 */
export async function gerarEmbedding(
  texto: string,
  apiKey: string,
  modelo = 'text-embedding-004',
): Promise<number[]> {
  if (!apiKey) throw new Error('google_ai_api_key não configurada no setor')
  if (!texto || !texto.trim()) throw new Error('Texto vazio para embedding')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:embedContent?key=${encodeURIComponent(apiKey)}`

  const body = {
    model: `models/${modelo}`,
    content: {
      parts: [{ text: texto }],
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini embedding API ${res.status}: ${errText.slice(0, 300)}`)
  }

  const json = (await res.json()) as { embedding?: { values?: number[] } }
  const values = json.embedding?.values
  if (!values || !Array.isArray(values) || values.length === 0) {
    throw new Error('Resposta da Gemini API sem embedding.values')
  }
  return values
}

export function sha256(texto: string): string {
  return createHash('sha256').update(texto, 'utf-8').digest('hex')
}

/**
 * Divide um texto longo em chunks com overlap para preservar contexto.
 * Corta preferencialmente em quebra de parágrafo/frase dentro do limite.
 */
export function chunkText(texto: string, maxChars = 1500, overlap = 200): string[] {
  const clean = texto.replace(/\r\n/g, '\n').trim()
  if (clean.length <= maxChars) return clean ? [clean] : []

  const chunks: string[] = []
  let i = 0
  while (i < clean.length) {
    let fim = Math.min(i + maxChars, clean.length)

    if (fim < clean.length) {
      // tenta cortar em quebra de parágrafo, depois em ponto final, depois em espaço
      const slice = clean.slice(i, fim)
      const breakPara = slice.lastIndexOf('\n\n')
      const breakDot = slice.lastIndexOf('. ')
      const breakSpace = slice.lastIndexOf(' ')
      const candidato =
        breakPara > maxChars * 0.5
          ? breakPara + 2
          : breakDot > maxChars * 0.5
            ? breakDot + 2
            : breakSpace > maxChars * 0.5
              ? breakSpace + 1
              : slice.length
      fim = i + candidato
    }

    const piece = clean.slice(i, fim).trim()
    if (piece) chunks.push(piece)
    if (fim >= clean.length) break
    i = Math.max(fim - overlap, i + 1)
  }
  return chunks
}

/**
 * Formato pgvector aceito pelo Postgres: string `[0.1,0.2,...]`.
 * O Supabase client aceita array de numbers diretamente para colunas vector,
 * mas algumas chamadas RPC precisam do formato string. Use isto quando passar
 * para RPC.
 */
export function toPgVector(values: number[]): string {
  return `[${values.join(',')}]`
}
