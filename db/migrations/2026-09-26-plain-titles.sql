-- Adds Gemini-generated plain-language titles to bills and motions.
-- Written by summarize/plain-titles.mjs.

alter table federal_bills
  add column if not exists plain_title text,
  add column if not exists plain_title_confidence text check (plain_title_confidence in ('high', 'low')),
  add column if not exists plain_title_source text;

alter table provincial_bills
  add column if not exists plain_title text,
  add column if not exists plain_title_confidence text check (plain_title_confidence in ('high', 'low')),
  add column if not exists plain_title_source text;

alter table motions
  add column if not exists plain_title text,
  add column if not exists plain_title_confidence text check (plain_title_confidence in ('high', 'low')),
  add column if not exists plain_title_source text;
