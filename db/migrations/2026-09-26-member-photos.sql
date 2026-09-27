-- Adds a photo URL to councillors, MPPs and MPs.
-- Written by web/scripts/upload-member-photos.mjs; run db/functions/riding_lookup.sql and ward_lookup.sql afterwards.

alter table councillors add column if not exists photo_url text;
alter table mpps add column if not exists photo_url text;
alter table mps add column if not exists photo_url text;
