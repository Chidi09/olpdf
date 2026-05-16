-- Add source tracking and character hash to fidelity_font_registry.
-- source: 'embedded' when extracted from the original PDF, 'proxy' when using Liberation fallback.
-- character_hash: SHA256 hex digest of the sorted character set for dedup lookups.

alter table if exists fidelity_font_registry
  add column if not exists source text default 'proxy',
  add column if not exists character_hash text;

-- Idempotent CHECK constraint for the source column
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fidelity_font_registry_source_check'
  ) then
    alter table fidelity_font_registry
      add constraint fidelity_font_registry_source_check
      check (source in ('embedded', 'proxy'));
  end if;
end $$;
