-- Enforce one persisted voice_calls row per Vapi call.
-- Apply this migration before deploying the matching vapi-webhook change.

begin;

create temporary table voice_call_duplicate_map on commit drop as
select duplicate_id, keep_id
from (
  select
    id as duplicate_id,
    first_value(id) over (
      partition by vapi_call_id
      order by ended_at desc nulls last, started_at desc nulls last, id desc
    ) as keep_id,
    row_number() over (
      partition by vapi_call_id
      order by ended_at desc nulls last, started_at desc nulls last, id desc
    ) as duplicate_rank
  from public.voice_calls
  where vapi_call_id is not null
) ranked
where duplicate_rank > 1;

-- Preserve tool-call history that points at a duplicate call row.
do $$
begin
  if to_regclass('public.voice_call_tools') is not null then
    update public.voice_call_tools as tools
    set call_id = duplicates.keep_id
    from voice_call_duplicate_map as duplicates
    where tools.call_id = duplicates.duplicate_id;
  end if;
end
$$;

delete from public.voice_calls as calls
using voice_call_duplicate_map as duplicates
where calls.id = duplicates.duplicate_id;

create unique index if not exists voice_calls_vapi_call_id_uidx
  on public.voice_calls (vapi_call_id);

commit;
