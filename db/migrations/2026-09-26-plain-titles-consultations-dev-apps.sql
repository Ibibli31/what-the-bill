-- Adds plain-language titles to consultations and development applications.
-- Written by summarize/plain-titles.mjs.

alter table consultations
  add column if not exists plain_title text,
  add column if not exists plain_title_confidence text check (plain_title_confidence in ('high', 'low')),
  add column if not exists plain_title_source text;

alter table dev_apps
  add column if not exists plain_title text,
  add column if not exists plain_title_confidence text check (plain_title_confidence in ('high', 'low')),
  add column if not exists plain_title_source text;
