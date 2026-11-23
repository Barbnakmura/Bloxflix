-- BLOXFLIX: estrutura inicial do banco no Supabase
-- Execute no SQL Editor do seu próprio projeto Supabase.
create table if not exists public.titles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_url text,
  kind text not null check (kind in ('movie','series')),
  video_path text,
  video_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.titles(id) on delete cascade,
  season_number integer not null check (season_number > 0),
  episode_number integer not null check (episode_number > 0),
  title text not null,
  description text,
  video_path text not null,
  video_url text not null,
  created_at timestamptz not null default now(),
  unique(series_id, season_number, episode_number)
);

alter table public.titles enable row level security;
alter table public.episodes enable row level security;

-- Leitura pública para o catálogo do site.
create policy "Public can read titles" on public.titles for select using (true);
create policy "Public can read episodes" on public.episodes for select using (true);

-- IMPORTANTE: para começar, este exemplo permite alterações a qualquer usuário autenticado.
-- Antes de publicar para outras pessoas, substitua estas políticas por uma verificação
-- de administrador (por exemplo, tabela admin_users com user_id = auth.uid()).
create policy "Authenticated can manage titles" on public.titles
  for all to authenticated using (true) with check (true);
create policy "Authenticated can manage episodes" on public.episodes
  for all to authenticated using (true) with check (true);

-- Crie um bucket chamado bloxflix-videos no Storage.
-- Marque-o como PUBLIC para que os vídeos publicados possam ser reproduzidos pelo site.
-- Aplique políticas de Storage para permitir upload somente a administradores.
