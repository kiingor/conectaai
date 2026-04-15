import { createHash } from 'crypto'

/**
 * Gera embedding via OpenAI Embeddings API.
 *
 * Modelo padrão: text-embedding-3-small (1536 dimensões).
 * Documentação: https://platform.openai.com/docs/api-reference/embeddings
 */
export async function gerarEmbedding(
  texto: string,
  apiKey: string,
  modelo = 'text-embedding-3-small',
): Promise<number[]> {
  if (!apiKey) throw new Error('openai_api_key não configurada na organização')
  if (!texto || !texto.trim()) throw new Error('Texto vazio para embedding')

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelo,
      input: texto,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI embedding API ${res.status}: ${errText.slice(0, 300)}`)
  }

  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> }
  const values = json.data?.[0]?.embedding
  if (!values || !Array.isArray(values) || values.length === 0) {
    throw new Error('Resposta da OpenAI sem data[0].embedding')
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
 */
export function toPgVector(values: number[]): string {
  return `[${values.join(',')}]`
}
