-- ============================================================================
--  Madama System 2 - permissions the order/approval front end needs.
--  Run AFTER madama_system2_schema.sql.
--
--  The front end talks to Supabase from the browser with the PUBLISHABLE key
--  (sb_publishable_...), which is governed by RLS. The engine keeps using the
--  SECRET key from n8n, which bypasses RLS entirely - nothing here affects it.
--
--  Single-operator setup for now. When the team joins, replace `to anon` with
--  `to authenticated` and add a per-user filter in the USING clause.
-- ============================================================================

-- ---------- 1. let the front end approve or reject a row ----------
-- RLS decides WHICH rows may be updated; a column GRANT decides WHICH COLUMNS.
-- Together they mean the operator can move a row through approval and nothing
-- else - they cannot rewrite generated copy, media URLs, attempt counters or
-- the audit trail from the browser.

drop policy if exists anon_update_queue on public.content_queue;
create policy anon_update_queue on public.content_queue
  for update to anon
  using (status in ('Awaiting Approval', 'Under Audit', 'Needs Review', 'Approved'))
  with check (status in ('Approved', 'Cancelled', 'Needs Review', 'Awaiting Approval'));

revoke update on public.content_queue from anon;
-- The console also edits the copy before approving and can bring a scheduled post
-- forward to "publish now", so those columns are granted too. Everything else on the
-- row - media URLs, attempt counters, audit fields, brand_id - stays out of reach.
grant  update (status, approved_by, approved_at, last_error, updated_at,
               generated_facebook, generated_instagram, generated_linkedin,
               scheduled_at)
  on public.content_queue to anon;

-- ---------- 2. let the front end show what was produced ----------
-- content_audit is read-only to the browser: the review screen displays the
-- two-stage audit state, but only the engine writes it.
drop policy if exists anon_read_audit on public.content_audit;
create policy anon_read_audit on public.content_audit
  for select to anon using (true);

-- ---------- 3. deleting rows from the console ----------
-- The operator asked for real deletion, not a status change, and for a Clear that
-- empties a whole list on EVERY tab, Published included.
--
-- An earlier version of this file held Published rows back, on the reasoning that
-- they are the record of what went out. That reasoning was wrong here: the record
-- of what went out lives in `publication_log`, which is a separate table with its
-- own rows, and there is no foreign key from it to content_queue - so deleting a
-- queue row destroys the draft and the media links, and touches the publication
-- record not at all. Holding the row back protected nothing and left a Clear button
-- that silently did nothing on that tab.
--
-- If you ever want the old behaviour back, put `using (status <> 'Published')` here.
drop policy if exists anon_delete_fresh_queue on public.content_queue;
drop policy if exists anon_delete_queue on public.content_queue;
create policy anon_delete_queue on public.content_queue
  for delete to anon
  using (true);

grant delete on public.content_queue to anon;

-- publication_log is NOT granted to anon at all: no policy, no grant. The console
-- can empty its own lists; it cannot rewrite the history of what was posted.

-- ---------- check ----------
-- select tablename, policyname, cmd, roles
--   from pg_policies where schemaname = 'public' order by tablename, cmd;
