-- Publications: immutable release layer for documents, books, and PDFs.
-- Each publication is a frozen snapshot with attached export artifacts.

create table if not exists publications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  owner_id uuid not null,
  source_type text not null check (source_type in ('document', 'book', 'pdf')),
  source_id text not null,
  title text not null,
  description text default '',
  visibility text not null default 'unlisted' check (visibility in ('private', 'unlisted', 'public')),
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  snapshot jsonb not null default '{}'::jsonb,
  artifact_keys jsonb not null default '[]'::jsonb,
  artifact_links jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  parent_publication_id uuid references publications(id),
  published_at timestamptz,
  unpublished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_publications_slug on publications(slug);
create index if not exists idx_publications_owner on publications(owner_id);
create index if not exists idx_publications_source on publications(source_type, source_id);
create index if not exists idx_publications_public on publications(visibility) where visibility = 'public' and status = 'published';
