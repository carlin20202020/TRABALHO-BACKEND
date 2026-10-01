-- ============================================================
-- SGOA - Schema do banco de dados (Supabase / PostgreSQL)
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run
-- Pode ser executado várias vezes e também ATUALIZA bancos criados pela versão anterior.
-- ============================================================

create or replace function public.definir_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- ---------- usuarios ----------
create table if not exists public.usuarios (
  id            uuid primary key default gen_random_uuid(),
  nome          text        not null check (char_length(nome) between 3 and 100),
  email         text        not null unique,
  senha_hash    text        not null,          -- só o hash (bcrypt): a senha original nunca é guardada
  matricula     text        not null unique,   -- CGM/RA (validada no Node.js)
  perfil        text        not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------- equipamentos ----------
create table if not exists public.equipamentos (
  id                uuid primary key default gen_random_uuid(),
  nome              text        not null check (char_length(nome) between 2 and 100),
  tipo              text        not null check (tipo in ('Computador', 'Projetor', 'Cadeira', 'Mesa', 'Roteador', 'Impressora', 'Outro')),
  numero_patrimonio text        unique,        -- tombo estadual
  localizacao       text        not null,      -- nome da sala (copiado de salas.nome pela API)
  status            text        not null default 'Operacional'
                    check (status in ('Operacional', 'Com Defeito', 'Em Manutenção', 'Baixado')),
  criado_por        uuid,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  constraint fk_equipamentos_criador foreign key (criado_por) references public.usuarios (id) on delete set null
);

-- ---------- salas (laboratórios e demais ambientes) ----------
create table if not exists public.salas (
  id            uuid primary key default gen_random_uuid(),
  nome          text        not null unique check (char_length(nome) between 2 and 100),
  descricao     text        check (descricao is null or char_length(descricao) <= 200),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.equipamentos add column if not exists sala_id uuid;
-- Migração: transforma as "localizacao" já existentes em salas e liga os equipamentos a elas
insert into public.salas (nome)
  select distinct localizacao from public.equipamentos where localizacao is not null
  on conflict (nome) do nothing;
update public.equipamentos e set sala_id = s.id
  from public.salas s where s.nome = e.localizacao and e.sala_id is null;
do $$ begin
  alter table public.equipamentos
    add constraint fk_equipamentos_sala foreign key (sala_id) references public.salas (id);
exception when duplicate_object then null; end $$;

-- ---------- ocorrencias ----------
create table if not exists public.ocorrencias (
  id                          uuid primary key default gen_random_uuid(),
  titulo                      text        not null check (char_length(titulo) between 3 and 120),
  descricao                   text        not null check (char_length(descricao) between 5 and 1000),
  categoria                   text        not null
                              check (categoria in ('Hardware Quebrado', 'Sem Internet', 'Software', 'Projetor com Defeito', 'Mobiliário', 'Outros')),
  status                      text        not null default 'Aberto' check (status in ('Aberto', 'Em Andamento', 'Resolvido')),
  prioridade                  text        not null check (prioridade in ('Alta Prioridade', 'Média Prioridade')),
  foto_url                    text,
  foto_path                   text,
  numero_patrimonio_resolvido text,
  usuario_id                  uuid        not null,   -- quem abriu o chamado
  equipamento_id              uuid        not null,   -- equipamento com problema
  tecnico_id                  uuid,                   -- responsável pelo atendimento (o Administrador)
  criado_em                   timestamptz not null default now(),
  atualizado_em               timestamptz not null default now(),
  resolvido_em                timestamptz,
  constraint fk_ocorrencias_usuario     foreign key (usuario_id)     references public.usuarios (id),
  constraint fk_ocorrencias_equipamento foreign key (equipamento_id) references public.equipamentos (id),
  constraint fk_ocorrencias_tecnico     foreign key (tecnico_id)     references public.usuarios (id) on delete set null,
  constraint ck_hardware_exige_foto
    check (categoria <> 'Hardware Quebrado' or foto_url is not null),
  constraint ck_resolvido_exige_patrimonio
    check (status <> 'Resolvido' or numero_patrimonio_resolvido is not null)
);

-- ---------- comentarios ----------
create table if not exists public.comentarios (
  id            uuid primary key default gen_random_uuid(),
  ocorrencia_id uuid        not null,
  usuario_id    uuid        not null,
  texto         text        not null check (char_length(texto) between 1 and 500),
  criado_em     timestamptz not null default now(),
  constraint fk_comentarios_ocorrencia foreign key (ocorrencia_id) references public.ocorrencias (id) on delete cascade,
  constraint fk_comentarios_usuario    foreign key (usuario_id)    references public.usuarios (id)
);
alter table public.comentarios add column if not exists tipo text not null default 'comentario';
do $$ begin
  alter table public.comentarios add constraint ck_comentarios_tipo check (tipo in ('comentario', 'sistema'));
exception when duplicate_object then null; end $$;

-- ---------- MIGRAÇÃO DOS PERFIS: só Aluno, Professor e Administrador; e apenas UM Administrador ----------
update public.usuarios set perfil = 'Professor' where perfil = 'Tecnico';
update public.usuarios set perfil = 'Professor'
  where perfil = 'Administrador'
    and id <> (select id from public.usuarios where perfil = 'Administrador' order by criado_em, id limit 1);
alter table public.usuarios drop constraint if exists usuarios_perfil_check;
alter table public.usuarios add constraint usuarios_perfil_check check (perfil in ('Aluno', 'Professor', 'Administrador'));
create unique index if not exists ux_um_administrador on public.usuarios (perfil) where perfil = 'Administrador';

-- ---------- Índices ----------
create index if not exists idx_equipamentos_criado_por  on public.equipamentos (criado_por);
create index if not exists idx_equipamentos_sala        on public.equipamentos (sala_id);
create index if not exists idx_ocorrencias_usuario      on public.ocorrencias (usuario_id);
create index if not exists idx_ocorrencias_equipamento  on public.ocorrencias (equipamento_id);
create index if not exists idx_ocorrencias_tecnico      on public.ocorrencias (tecnico_id);
create index if not exists idx_ocorrencias_status       on public.ocorrencias (status);
create index if not exists idx_comentarios_ocorrencia   on public.comentarios (ocorrencia_id);
create index if not exists idx_comentarios_usuario      on public.comentarios (usuario_id);

-- ---------- Triggers de atualizado_em ----------
drop trigger if exists trg_usuarios_atualizado on public.usuarios;
create trigger trg_usuarios_atualizado before update on public.usuarios
  for each row execute function public.definir_atualizado_em();
drop trigger if exists trg_equipamentos_atualizado on public.equipamentos;
create trigger trg_equipamentos_atualizado before update on public.equipamentos
  for each row execute function public.definir_atualizado_em();
drop trigger if exists trg_salas_atualizado on public.salas;
create trigger trg_salas_atualizado before update on public.salas
  for each row execute function public.definir_atualizado_em();
drop trigger if exists trg_ocorrencias_atualizado on public.ocorrencias;
create trigger trg_ocorrencias_atualizado before update on public.ocorrencias
  for each row execute function public.definir_atualizado_em();

-- ---------- Segurança: RLS ligado e sem políticas (só o backend com a chave secreta acessa) ----------
alter table public.usuarios     enable row level security;
alter table public.equipamentos enable row level security;
alter table public.salas        enable row level security;
alter table public.ocorrencias  enable row level security;
alter table public.comentarios  enable row level security;

-- ---------- Storage: bucket das fotos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ocorrencias', 'ocorrencias', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
