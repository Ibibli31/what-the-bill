# summarize

Generates plain-language titles with Gemini and writes them to Supabase.

1. Run `db/migrations/2026-09-26-plain-titles.sql` in the Supabase SQL editor.
2. Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) in the repo-root `.env`.
3. `cd summarize && npm install && npm run titles -- --dry --limit 10` to preview, then `npm run titles` to write.

Only rows with no title, or whose source text changed, are sent to Gemini.

Consultations are titled by Gemini. Development applications are titled from a template in `plain-titles.mjs` (application type plus address), with no API call.
Also run `db/migrations/2026-09-26-plain-titles-consultations-dev-apps.sql`.
