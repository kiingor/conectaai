/**
 * Parsers server-side para extrair texto puro de arquivos enviados pelo cliente.
 * Usado pelo endpoint de upload de base de conhecimento.
 */

export type TipoArquivo = 'txt' | 'md' | 'pdf' | 'docx'

export function parseTextOrMd(buffer: Buffer): string {
  return buffer.toString('utf-8')
}

export async function parsePdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    return result.text || ''
  } finally {
    await parser.destroy().catch(() => {})
  }
}

export async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value || ''
}

/**
 * Decide o parser baseado em nome do arquivo e/ou MIME.
 * Retorna o texto extraído + tipo detectado.
 */
export async function parseArquivo(
  buffer: Buffer,
  mime: string | undefined,
  nome: string,
): Promise<{ texto: string; tipo: TipoArquivo }> {
  const ext = (nome.split('.').pop() || '').toLowerCase()
  const m = (mime || '').toLowerCase()

  if (ext === 'pdf' || m.includes('pdf')) {
    return { texto: await parsePdf(buffer), tipo: 'pdf' }
  }
  if (
    ext === 'docx' ||
    m.includes('officedocument.wordprocessingml') ||
    m.includes('msword')
  ) {
    return { texto: await parseDocx(buffer), tipo: 'docx' }
  }
  if (ext === 'md' || m.includes('markdown')) {
    return { texto: parseTextOrMd(buffer), tipo: 'md' }
  }
  if (ext === 'txt' || m.startsWith('text/')) {
    return { texto: parseTextOrMd(buffer), tipo: 'txt' }
  }
  throw new Error(`Formato de arquivo não suportado: ${nome} (${mime || 'sem mime'})`)
}
