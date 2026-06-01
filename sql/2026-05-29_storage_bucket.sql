-- =====================================================================
-- ConectaAI / MultiHub  —  Bucket de Storage para uploads do workdesk
-- Data: 2026-05-29
--
-- O endpoint /api/upload passou a usar o Supabase Storage (self-hosted)
-- no lugar do Vercel Blob. Este script cria o bucket necessário.
--
-- COMO APLICAR:
--   Supabase Studio -> SQL Editor -> cole -> Run.
--   (ou crie o bucket pela UI: Storage -> New bucket -> nome "uploads" -> Public)
--
-- DECISÃO: bucket PÚBLICO.
--   Mantém o comportamento atual (as URLs de mídia eram públicas no Vercel
--   Blob) e é o que o WhatsApp/Evolution precisa: a API do WhatsApp baixa o
--   arquivo pela URL (`media: <link>`), então o link precisa ser acessível
--   sem autenticação. Se quiser restringir depois, troque para signed URLs.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', true, 104857600)   -- 100 MB
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- O upload é feito server-side com a service_role (bypassa RLS), então NÃO
-- são necessárias policies de INSERT para o anon/authenticated.
-- Como o bucket é público, a leitura via /object/public/... já é liberada.

-- (Opcional) Se você aplicou o RLS do outro script e quiser permitir que o
-- browser autenticado faça leitura/baixa direto de storage.objects:
-- drop policy if exists uploads_public_read on storage.objects;
-- create policy uploads_public_read on storage.objects
--   for select to public
--   using (bucket_id = 'uploads');
