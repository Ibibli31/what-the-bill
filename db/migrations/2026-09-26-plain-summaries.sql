-- Adds Gemini-generated plain-language summaries to every item table.
-- Written on demand by web/app/api/summary/route.ts.

alter table federal_bills
  add column if not exists plain_summary text,
  add column if not exists plain_summary_confidence text check (plain_summary_confidence in ('high', 'low')),
  add column if not exists plain_summary_source text,
  add column if not exists plain_summary_generated_at timestamptz;

alter table provincial_bills
  add column if not exists plain_summary text,
  add column if not exists plain_summary_confidence text check (plain_summary_confidence in ('high', 'low')),
  add column if not exists plain_summary_source text,
  add column if not exists plain_summary_generated_at timestamptz;

alter table motions
  add column if not exists plain_summary text,
  add column if not exists plain_summary_confidence text check (plain_summary_confidence in ('high', 'low')),
  add column if not exists plain_summary_source text,
  add column if not exists plain_summary_generated_at timestamptz;

alter table dev_apps
  add column if not exists plain_summary text,
  add column if not exists plain_summary_confidence text check (plain_summary_confidence in ('high', 'low')),
  add column if not exists plain_summary_source text,
  add column if not exists plain_summary_generated_at timestamptz;

alter table consultations
  add column if not exists plain_summary text,
  add column if not exists plain_summary_confidence text check (plain_summary_confidence in ('high', 'low')),
  add column if not exists plain_summary_source text,
  add column if not exists plain_summary_generated_at timestamptz;
