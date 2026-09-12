-- ============================================================================
--  Madama Group - Marketing System 2
--  Schema for Supabase / PostgreSQL. Replaces the Google Sheets workbook.
--
--  Column names are IDENTICAL to the current sheet tabs, so the 53 Code nodes
--  in Marketing Engine v9.6.0 keep working untouched - only the 31 data-access
--  nodes change from googleSheets to httpRequest.
--
--  TYPE NOTE: every date-like column (next_retry_at, approved_at, published_at,
--  audit_submitted_at, scheduled_at ...) is TEXT on purpose. The engine writes
--  an empty string '' into those fields in ten different nodes, and a timestamptz
--  column rejects '' outright with "invalid input syntax for type timestamp".
--  ISO-8601 strings sort correctly as text, so ordering and comparison still work.
--  Counters are integer and the publish flags are boolean - the engine writes
--  Number() into the former and only ever reads the latter.
-- ============================================================================

create extension if not exists "pgcrypto";


-- ---------- brands  (30 columns) ----------
create table if not exists public.brands (
  brand_id                     text         not null default '',
  company_name                 text         not null default '',
  brand_context                text         not null default '',
  target_audience              text         not null default '',
  tone_of_voice                text         not null default '',
  default_cta                  text         not null default '',
  timezone                     text         not null default '',
  active                       boolean      not null default false,
  publish_facebook             boolean      not null default false,
  publish_instagram            boolean      not null default false,
  publish_linkedin             boolean      not null default false,
  facebook_page_id             text         not null default '',
  instagram_user_id            text         not null default '',
  linkedin_organization_id     text         not null default '',
  website_url                  text         not null default '',
  contact_email                text         not null default '',
  contact_phone                text         not null default '',
  connection_status            text         not null default '',
  created_at                   text         not null default '',
  updated_at                   text         not null default '',
  facebook_url                 text         not null default '',
  instagram_url                text         not null default '',
  linkedin_url                 text         not null default '',
  messenger_url                text         not null default '',
  whatsapp_url                 text         not null default '',
  yelp_url                     text         not null default '',
  logo_url                     text         not null default '',
  brand_primary_color          text         not null default '',
  brand_secondary_color        text         not null default '',
  image_branding_instructions  text         not null default '',
  row_created_at               timestamptz  not null default now(),
  row_updated_at               timestamptz  not null default now(),
  constraint brands_pkey primary key (brand_id)
);

-- ---------- brand_content_options  (9 columns) ----------
create table if not exists public.brand_content_options (
  option_id                    text         not null default '',
  brand_id                     text         not null default '',
  content_type                 text         not null default '',
  category                     text         not null default '',
  option_label                 text         not null default '',
  option_value                 text         not null default '',
  active                       boolean      not null default false,
  sort_order                   integer      not null default 0,
  notes                        text         not null default '',
  row_created_at               timestamptz  not null default now(),
  row_updated_at               timestamptz  not null default now(),
  constraint brand_content_options_pkey primary key (option_id)
);

-- ---------- service_details  (7 columns) ----------
create table if not exists public.service_details (
  brand_id                     text         not null default '',
  service_value                text         not null default '',
  summary                      text         not null default '',
  scenarios                    text         not null default '',
  differentiators              text         not null default '',
  keywords                     text         not null default '',
  avoid                        text         not null default '',
  row_created_at               timestamptz  not null default now(),
  row_updated_at               timestamptz  not null default now(),
  constraint service_details_pkey primary key (brand_id, service_value)
);

-- ---------- content_queue  (52 columns) ----------
create table if not exists public.content_queue (
  id                           text         not null default '',
  brand_id                     text         not null default '',
  campaign                     text         not null default '',
  content_pillar               text         not null default '',
  topic_idea                   text         not null default '',
  target_audience              text         not null default '',
  tone_of_voice                text         not null default '',
  scheduled_at                 text         not null default '',
  status                       text         not null default '',
  generated_linkedin           text         not null default '',
  generated_facebook           text         not null default '',
  generated_instagram          text         not null default '',
  image_url                    text         not null default '',
  image_brief                  text         not null default '',
  link_url                     text         not null default '',
  publish_facebook             boolean      not null default false,
  publish_instagram            boolean      not null default false,
  publish_linkedin             boolean      not null default false,
  facebook_status              text         not null default '',
  facebook_post_id             text         not null default '',
  facebook_attempts            integer      not null default 0,
  instagram_status             text         not null default '',
  instagram_post_id            text         not null default '',
  instagram_attempts           integer      not null default 0,
  linkedin_status              text         not null default '',
  linkedin_post_id             text         not null default '',
  linkedin_attempts            integer      not null default 0,
  last_error                   text         not null default '',
  next_retry_at                text         not null default '',
  approved_by                  text         not null default '',
  approved_at                  text         not null default '',
  published_at                 text         not null default '',
  updated_at                   text         not null default '',
  image_status                 text         not null default '',
  image_file_id                text         not null default '',
  image_attempts               integer      not null default 0,
  media_type                   text         not null default '',
  video_brief                  text         not null default '',
  video_script                 text         not null default '',
  video_status                 text         not null default '',
  video_url                    text         not null default '',
  video_file_id                text         not null default '',
  video_attempts               integer      not null default 0,
  video_provider               text         not null default '',
  video_style                  text         not null default '',
  video_duration_seconds       integer      not null default 0,
  video_aspect_ratio           text         not null default '',
  audit_id                     text         not null default '',
  audit_status                 text         not null default '',
  audit_submitted_at           text         not null default '',
  audit_version                integer      not null default 0,
  target_platform              text         not null default '',
  row_created_at               timestamptz  not null default now(),
  row_updated_at               timestamptz  not null default now(),
  constraint content_queue_pkey primary key (id)
);

-- ---------- content_audit  (34 columns) ----------
create table if not exists public.content_audit (
  audit_id                     text         not null default '',
  content_id                   text         not null default '',
  brand_id                     text         not null default '',
  company_name                 text         not null default '',
  campaign                     text         not null default '',
  content_pillar               text         not null default '',
  scheduled_at                 text         not null default '',
  platforms                    text         not null default '',
  media_type                   text         not null default '',
  generated_linkedin           text         not null default '',
  generated_facebook           text         not null default '',
  generated_instagram          text         not null default '',
  image_url                    text         not null default '',
  image_brief                  text         not null default '',
  video_url                    text         not null default '',
  video_brief                  text         not null default '',
  video_script                 text         not null default '',
  marketing_status             text         not null default '',
  marketing_comment            text         not null default '',
  marketing_reviewed_by        text         not null default '',
  marketing_reviewed_at        text         not null default '',
  owner_status                 text         not null default '',
  owner_comment                text         not null default '',
  owner_reviewed_by            text         not null default '',
  owner_reviewed_at            text         not null default '',
  final_status                 text         not null default '',
  revision_request             text         not null default '',
  revision_count               integer      not null default 0,
  submitted_at                 text         not null default '',
  finalized_at                 text         not null default '',
  created_at                   text         not null default '',
  updated_at                   text         not null default '',
  last_error                   text         not null default '',
  audit_version                integer      not null default 0,
  row_created_at               timestamptz  not null default now(),
  row_updated_at               timestamptz  not null default now(),
  constraint content_audit_pkey primary key (audit_id)
);

-- ---------- weekly_content_briefs  (32 columns) ----------
create table if not exists public.weekly_content_briefs (
  brief_id                     text         not null default '',
  week_start                   text         not null default '',
  week_end                     text         not null default '',
  brand_id                     text         not null default '',
  company_name                 text         not null default '',
  objective                    text         not null default '',
  campaign                     text         not null default '',
  posts_count                  integer      not null default 0,
  platforms                    text         not null default '',
  required_topics              text         not null default '',
  excluded_topics              text         not null default '',
  target_audience_override     text         not null default '',
  tone_override                text         not null default '',
  special_offer                text         not null default '',
  cta_override                 text         not null default '',
  image_style                  text         not null default '',
  extra_instructions           text         not null default '',
  approval_status              text         not null default '',
  approved_by                  text         not null default '',
  approved_at                  text         not null default '',
  chat_session_id              text         not null default '',
  processing_status            text         not null default '',
  processed_at                 text         not null default '',
  created_at                   text         not null default '',
  updated_at                   text         not null default '',
  last_error                   text         not null default '',
  generate_at                  text         not null default '',
  posting_schedule             text         not null default '',
  media_type                   text         not null default '',
  video_style                  text         not null default '',
  video_duration_seconds       integer      not null default 0,
  video_aspect_ratio           text         not null default '',
  row_created_at               timestamptz  not null default now(),
  row_updated_at               timestamptz  not null default now(),
  constraint weekly_content_briefs_pkey primary key (brief_id)
);

-- ---------- job_postings  (35 columns) ----------
create table if not exists public.job_postings (
  job_id                       text         not null default '',
  brand_id                     text         not null default '',
  company_name                 text         not null default '',
  job_title                    text         not null default '',
  department                   text         not null default '',
  employment_type              text         not null default '',
  workplace_type               text         not null default '',
  location                     text         not null default '',
  job_summary                  text         not null default '',
  responsibilities             text         not null default '',
  requirements                 text         not null default '',
  preferred_qualifications     text         not null default '',
  compensation                 text         not null default '',
  application_url              text         not null default '',
  application_email            text         not null default '',
  application_phone            text         not null default '',
  platforms                    text         not null default '',
  scheduled_at                 text         not null default '',
  image_style                  text         not null default '',
  extra_instructions           text         not null default '',
  approval_status              text         not null default '',
  approved_by                  text         not null default '',
  approved_at                  text         not null default '',
  chat_session_id              text         not null default '',
  processing_status            text         not null default '',
  processed_at                 text         not null default '',
  created_at                   text         not null default '',
  updated_at                   text         not null default '',
  last_error                   text         not null default '',
  generate_at                  text         not null default '',
  media_type                   text         not null default '',
  video_style                  text         not null default '',
  video_duration_seconds       integer      not null default 0,
  video_aspect_ratio           text         not null default '',
  video_brief                  text         not null default '',
  row_created_at               timestamptz  not null default now(),
  row_updated_at               timestamptz  not null default now(),
  constraint job_postings_pkey primary key (job_id)
);

-- ---------- publication_log  (11 columns) ----------
create table if not exists public.publication_log (
  log_id                       text         not null default '',
  post_id                      text         not null default '',
  brand_id                     text         not null default '',
  company_name                 text         not null default '',
  platform                     text         not null default '',
  status                       text         not null default '',
  platform_post_id             text         not null default '',
  attempt                      integer      not null default 0,
  error_message                text         not null default '',
  published_at                 text         not null default '',
  logged_at                    text         not null default '',
  row_created_at               timestamptz  not null default now(),
  row_updated_at               timestamptz  not null default now(),
  constraint publication_log_pkey primary key (log_id)
);


-- ---------- indexes the classifier actually filters on ----------
create index if not exists content_queue_status_idx        on public.content_queue (status);
create index if not exists content_queue_brand_idx         on public.content_queue (brand_id);
create index if not exists content_queue_video_status_idx  on public.content_queue (video_status);
create index if not exists content_queue_image_status_idx  on public.content_queue (image_status);
create index if not exists content_queue_scheduled_idx     on public.content_queue (scheduled_at);
create index if not exists content_audit_content_idx       on public.content_audit (content_id);
create index if not exists content_audit_final_idx         on public.content_audit (final_status);
create index if not exists options_brand_type_idx          on public.brand_content_options (brand_id, content_type);
create index if not exists publication_log_post_idx        on public.publication_log (post_id);

-- ---------- keep row_updated_at honest, whoever writes ----------
create or replace function public.touch_row_updated_at()
returns trigger language plpgsql as $$
begin
  new.row_updated_at = now();
  return new;
end $$;

drop trigger if exists brands_touch on public.brands;
create trigger brands_touch before update on public.brands
  for each row execute function public.touch_row_updated_at();
drop trigger if exists brand_content_options_touch on public.brand_content_options;
create trigger brand_content_options_touch before update on public.brand_content_options
  for each row execute function public.touch_row_updated_at();
drop trigger if exists service_details_touch on public.service_details;
create trigger service_details_touch before update on public.service_details
  for each row execute function public.touch_row_updated_at();
drop trigger if exists content_queue_touch on public.content_queue;
create trigger content_queue_touch before update on public.content_queue
  for each row execute function public.touch_row_updated_at();
drop trigger if exists content_audit_touch on public.content_audit;
create trigger content_audit_touch before update on public.content_audit
  for each row execute function public.touch_row_updated_at();
drop trigger if exists weekly_content_briefs_touch on public.weekly_content_briefs;
create trigger weekly_content_briefs_touch before update on public.weekly_content_briefs
  for each row execute function public.touch_row_updated_at();
drop trigger if exists job_postings_touch on public.job_postings;
create trigger job_postings_touch before update on public.job_postings
  for each row execute function public.touch_row_updated_at();
drop trigger if exists publication_log_touch on public.publication_log;
create trigger publication_log_touch before update on public.publication_log
  for each row execute function public.touch_row_updated_at();


-- ---------- row level security ----------
-- n8n connects with the service_role key, which bypasses RLS entirely.
-- The browser front end connects with the anon key and is governed by the
-- policies below. Start locked down: the front end may read reference data and
-- create orders, but may not touch generated content or the audit trail.
alter table public.brands enable row level security;
alter table public.brand_content_options enable row level security;
alter table public.service_details enable row level security;
alter table public.content_queue enable row level security;
alter table public.content_audit enable row level security;
alter table public.weekly_content_briefs enable row level security;
alter table public.job_postings enable row level security;
alter table public.publication_log enable row level security;

-- reference data the order builder needs to render its menus
create policy anon_read_brands   on public.brands
  for select to anon using (true);
create policy anon_read_options  on public.brand_content_options
  for select to anon using (true);
create policy anon_read_services on public.service_details
  for select to anon using (true);

-- the order builder creates queue rows and reads back their progress
create policy anon_read_queue   on public.content_queue
  for select to anon using (true);
create policy anon_insert_queue on public.content_queue
  for insert to anon with check (true);

-- deliberately NOT granted to anon: update/delete on content_queue, and every
-- operation on content_audit, publication_log, job_postings and
-- weekly_content_briefs. Those belong to the engine (service_role) alone.
-- Tighten anon_read_queue with a per-user filter once the front end has auth.

