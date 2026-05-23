// Constantes compartilhadas entre browser e server.
// Mantemos um cookie name fixo pra que o browser (que pode usar URL de proxy
// pra contornar CORS em dev) e o server (que fala direto com a URL remota)
// leiam/escrevam a mesma sessão.
export const SUPABASE_AUTH_COOKIE = 'sb-conectaai-auth-token'
