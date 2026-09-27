-- Adds the official document text for every item, fetched by summarize/fetch-sources.mjs,
-- and the model-and-prompt version each plain-language title and summary was written with.

alter table federal_bills
  add column if not exists source_text text,
  add column if not exists source_text_url text,
  add column if not exists source_text_truncated boolean,
  add column if not exists source_text_fetched_at timestamptz,
  add column if not exists plain_title_version text,
  add column if not exists plain_summary_version text,
  drop column if exists plain_summary_evidence;

alter table provincial_bills
  add column if not exists source_text text,
  add column if not exists source_text_url text,
  add column if not exists source_text_truncated boolean,
  add column if not exists source_text_fetched_at timestamptz,
  add column if not exists plain_title_version text,
  add column if not exists plain_summary_version text,
  drop column if exists plain_summary_evidence;

alter table motions
  add column if not exists source_text text,
  add column if not exists source_text_url text,
  add column if not exists source_text_truncated boolean,
  add column if not exists source_text_fetched_at timestamptz,
  add column if not exists plain_title_version text,
  add column if not exists plain_summary_version text,
  drop column if exists plain_summary_evidence;

alter table dev_apps
  add column if not exists source_text text,
  add column if not exists source_text_url text,
  add column if not exists source_text_truncated boolean,
  add column if not exists source_text_fetched_at timestamptz,
  add column if not exists plain_title_version text,
  add column if not exists plain_summary_version text,
  drop column if exists plain_summary_evidence;

alter table consultations
  add column if not exists source_text text,
  add column if not exists source_text_url text,
  add column if not exists source_text_truncated boolean,
  add column if not exists source_text_fetched_at timestamptz,
  add column if not exists plain_title_version text,
  add column if not exists plain_summary_version text,
  drop column if exists plain_summary_evidence;
