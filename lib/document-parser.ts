import { createHash } from 'crypto'

export async function parseArquivo(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(buffer)
    return result.text
  }
  return buffer.toString('utf-8') // TXT, MD
}

export function chunkTexto(texto: string, tamanho = 1000, overlap = 200): string[] {
  const chunks: string[] = []
  let i = 0
  while (i < texto.length) {
    chunks.push(texto.slice(i, i + tamanho))
    i += tamanho - overlap
  }
  return chunks.filter(c => c.trim().length > 50)
}

export function hashConteudo(texto: string): string {
  return createHash('sha256').update(texto).digest('hex')
}
