-- ============================================================
-- Porra Mundialito — Schema inicial
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- Profiles (extiende auth.users de Supabase)
create table public.profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  username     text unique not null,
  display_name text,
  avatar_url   text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Equipos
create table public.teams (
  id         serial primary key,
  name       text not null,
  code       char(3) not null,       -- "ESP", "FRA", etc.
  flag_emoji text,                   -- "🇪🇸", "🇫🇷", etc.
  group_name char(1)                 -- "A" … "H" (null en fases eliminatorias)
);

-- Partidos
create table public.matches (
  id           serial primary key,
  home_team_id int references public.teams(id) not null,
  away_team_id int references public.teams(id) not null,
  match_date   timestamptz not null,
  stage        text not null check (stage in ('group', 'round_of_16', 'quarter', 'semi', 'third_place', 'final')),
  group_name   char(1),
  venue        text,
  home_score   int check (home_score >= 0),
  away_score   int check (away_score >= 0),
  status       text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  constraint different_teams check (home_team_id <> away_team_id)
);

-- Predicciones
create table public.predictions (
  id         serial primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  match_id   int references public.matches(id) on delete cascade not null,
  home_score int not null check (home_score >= 0),
  away_score int not null check (away_score >= 0),
  points     int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

-- Auto-actualizar updated_at en predictions
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger predictions_updated_at
  before update on public.predictions
  for each row execute function update_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles   enable row level security;
alter table public.teams      enable row level security;
alter table public.matches    enable row level security;
alter table public.predictions enable row level security;

-- Profiles
create policy "Perfiles visibles por todos"
  on public.profiles for select using (true);

create policy "Cada usuario crea su propio perfil"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Cada usuario edita su propio perfil"
  on public.profiles for update using (auth.uid() = id);

-- Teams (solo lectura para usuarios normales; admins gestionan)
create policy "Equipos visibles por todos"
  on public.teams for select using (true);

create policy "Solo admins gestionan equipos"
  on public.teams for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Matches
create policy "Partidos visibles por todos"
  on public.matches for select using (true);

create policy "Solo admins gestionan partidos"
  on public.matches for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Predictions: cada usuario solo ve y edita las suyas; admins pueden actualizar puntos
create policy "Usuarios gestionan sus predicciones"
  on public.predictions for all using (auth.uid() = user_id);

create policy "Admins actualizan puntos"
  on public.predictions for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- ============================================================
-- Trigger: crear perfil automáticamente al registrarse
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    split_part(new.email, '@', 1),
    split_part(new.email, '@', 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Datos de ejemplo — Mundial 2026 (primeros partidos)
-- Descomenta y ajusta según el calendario real
-- ============================================================

/*
insert into public.teams (name, code, flag_emoji, group_name) values
  ('España',   'ESP', '🇪🇸', 'A'),
  ('Alemania', 'GER', '🇩🇪', 'A'),
  ('Francia',  'FRA', '🇫🇷', 'B'),
  ('Brasil',   'BRA', '🇧🇷', 'B');

insert into public.matches (home_team_id, away_team_id, match_date, stage, group_name, venue) values
  (1, 2, '2026-06-11 20:00:00+00', 'group', 'A', 'Dallas'),
  (3, 4, '2026-06-12 23:00:00+00', 'group', 'B', 'São Paulo');
*/
