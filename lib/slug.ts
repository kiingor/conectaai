import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Converte um nome de organizacao em um slug URL-friendly.
 * "Softcom Tecnologia" -> "softcom-tecnologia"
 * "Açai & Cia 2026"    -> "acai-cia-2026"
 */
export function slugify(nome: string): string {
  return (nome || '')
    .normalize('NFD')
    // remove acentos
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // troca qualquer nao-alfanumerico por hifen
    .replace(/[^a-z0-9]+/g, '-')
    // colapsa hifens duplicados
    .replace(/-+/g, '-')
    // apara hifens nas bordas
    .replace(/^-+|-+$/g, '')
    // limita a 40 caracteres
    .slice(0, 40)
    .replace(/-+$/g, '')
}

/**
 * Gera um slug unico para organizacao consultando o banco.
 * Se o slug base ja existir, sufixa com -2, -3, etc. ate encontrar disponivel.
 * Fallback: se o nome resultar em slug vazio, usa "empresa" como base.
 */
export async function gerarSlugUnico(
  nome: string,
  service: SupabaseClient,
): Promise<string> {
  const base = slugify(nome) || 'empresa'

  // tenta o base primeiro
  let tentativa = base
  let contador = 1

  while (true) {
    const { data } = await service
      .from('organizacoes')
      .select('id')
      .eq('slug', tentativa)
      .maybeSingle()

    if (!data) return tentativa

    contador += 1
    // preserva o limite de 40 chars mesmo com sufixo
    const sufixo = `-${contador}`
    tentativa = `${base.slice(0, 40 - sufixo.length)}${sufixo}`

    // failsafe para nao rodar em loop infinito
    if (contador > 999) {
      throw new Error('Nao foi possivel gerar slug unico apos 999 tentativas')
    }
  }
}
