create extension if not exists pgcrypto;

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  image_url text not null,
  description text,
  accent_color text,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  avatar_url text,
  character_id uuid references public.characters(id),
  starting_balance integer not null default 1000 check (starting_balance >= 0),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  closes_at timestamptz not null,
  created_by uuid references public.users(id),
  base_multiplier numeric(8,2) not null default 1.50,
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'settled', 'cancelled')),
  winning_option_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.bet_options (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  label text not null,
  odds_multiplier numeric(8,2) not null default 1.50,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  bet_id uuid not null references public.bets(id) on delete cascade,
  bet_option_id uuid not null references public.bet_options(id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  stake integer not null check (stake > 0),
  bonus_multiplier numeric(8,2) not null default 1.00,
  final_odds numeric(10,2) not null default 1.00,
  potential_payout integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.combo_legs (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.combos(id) on delete cascade,
  bet_id uuid not null references public.bets(id) on delete cascade,
  bet_option_id uuid not null references public.bet_options(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.characters enable row level security;
alter table public.users enable row level security;
alter table public.bets enable row level security;
alter table public.bet_options enable row level security;
alter table public.predictions enable row level security;
alter table public.combos enable row level security;
alter table public.combo_legs enable row level security;

drop policy if exists "characters_public" on public.characters;
drop policy if exists "users_public" on public.users;
drop policy if exists "bets_public" on public.bets;
drop policy if exists "bet_options_public" on public.bet_options;
drop policy if exists "predictions_public" on public.predictions;
drop policy if exists "combos_public" on public.combos;
drop policy if exists "combo_legs_public" on public.combo_legs;

create policy "characters_public" on public.characters for all using (true) with check (true);
create policy "users_public" on public.users for all using (true) with check (true);
create policy "bets_public" on public.bets for all using (true) with check (true);
create policy "bet_options_public" on public.bet_options for all using (true) with check (true);
create policy "predictions_public" on public.predictions for all using (true) with check (true);
create policy "combos_public" on public.combos for all using (true) with check (true);
create policy "combo_legs_public" on public.combo_legs for all using (true) with check (true);

insert into public.characters (slug, name, image_url, description, accent_color, sort_order)
values
  ('aurora-pulse', 'Aurora Pulse', '/public/characters/aurora-pulse.svg', 'Analista de tendencias com leitura rapida de cenario.', '#14b8a6', 1),
  ('byte-baron', 'Byte Baron', '/public/characters/byte-baron.svg', 'Especialista em estatistica para apostas mais calculadas.', '#0f766e', 2),
  ('nova-lynx', 'Nova Lynx', '/public/characters/nova-lynx.svg', 'Instinto forte para viradas improvaveis.', '#f97316', 3),
  ('captain-loop', 'Captain Loop', '/public/characters/captain-loop.svg', 'Disciplina para manter streaks consistentes.', '#2563eb', 4),
  ('echo-matrix', 'Echo Matrix', '/public/characters/echo-matrix.svg', 'Leitura de padroes escondidos no jogo.', '#7c3aed', 5),
  ('solar-drift', 'Solar Drift', '/public/characters/solar-drift.svg', 'Assume riscos altos buscando grandes retornos.', '#eab308', 6)
on conflict (slug) do update
set
  name = excluded.name,
  image_url = excluded.image_url,
  description = excluded.description,
  accent_color = excluded.accent_color,
  sort_order = excluded.sort_order;
