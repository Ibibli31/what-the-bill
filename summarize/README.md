# summarize

Generates plain-language titles with Gemini and writes them to Supabase.

1. Run `db/migrations/2026-09-26-plain-titles.sql` in the Supabase SQL editor.
2. Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) in the repo-root `.env`.
3. `cd summarize && npm install && npm run titles -- --dry --limit 10` to preview, then `npm run titles` to write. `--limit` applies per table; `--only <table>` runs one table.

`npm run titles:sample` previews titles for a fixed set of 12 varied items (the `SAMPLE` list in `plain-titles.mjs`) without saving, showing the current title and the quoted evidence. Rerun it after changing the prompt to compare.

Bills, motions and consultations are titled by Gemini from their `source_text` (run `npm run sources` first); rows with no `source_text` are skipped. Only rows with no title, or whose input, prompt or model changed, are sent to Gemini.

Each title must come with 1-3 passages quoted from the document; a title is rejected and retried if any passage isn't found word for word in the document, or if all passages come from the official title.

Each title is saved with `plain_title_version`, a short hash of the model and prompt (`template` for development applications). A run also stamps the current version on titles that are already up to date but have none.

Consultations are titled by Gemini. Development applications are titled from a template in `plain-titles.mjs` (application type plus address), with no API call.
Also run `db/migrations/2026-09-26-plain-titles-consultations-dev-apps.sql`.

## Official document text

`fetch-sources.mjs` fetches each item's official document and saves it to `source_text`. Run `db/migrations/2026-09-27-source-text.sql` first.

| Table | Source |
|---|---|
| federal_bills | LEGISinfo page → "Text of the bill" (latest version) |
| provincial_bills | ola.org bill page, latest version |
| dev_apps | devapps.ottawa.ca data service: type, addresses, description |
| motions | eScribe meeting page: agenda item, report recommendation or motion text |
| consultations | engage.ottawa.ca project page description |

`npm run sources -- --dry` writes the text to `source-preview/` for review instead of saving; `--only <table>` and `--limit <n>` narrow the run. Without `--dry`, only rows with no `source_text` are fetched; `--refresh` refetches all.

A page is rejected, and its row left unchanged, if its text is too short, looks like an error page, or (for bills) doesn't contain the bill number. Pro forma bills (C-1, S-1) have no published text.

## On-demand summaries

Plain-language summaries are written when a user first opens an item, not in batch, by `web/app/api/summary/route.ts` using `web/lib/summarize.ts`.

Run `db/migrations/2026-09-26-plain-summaries.sql` before deploying the web app. It needs the same `GEMINI_API_KEY` and `GEMINI_MODEL` as the titles.

Summaries are written from `source_text`. Each must come with 1-4 non-overlapping passages quoted word for word from the document. A summary is also rejected and retried if it contains a number that isn't in the document or location, uses filler words, or states an outcome.

An item with no `source_text` shows "There's no official text for this item yet". A low-confidence summary is saved but not shown; the item shows "The official text doesn't say enough to summarize this item".

Each summary is saved with `plain_summary_version`, a short hash of the model and prompt. After a prompt or model change, older summaries are hidden and rewritten on their next click.

To rewrite a summary, set `plain_summary` to null on its row; the next click regenerates it.
