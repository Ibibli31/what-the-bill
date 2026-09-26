# Database schema
 
StreetWatch Ottawa's schema, as deployed in Supabase (Postgres + PostGIS). This matches what's actually running — see `claude/supabase-load-notes.md` for the load process and the couple of places the deployed schema differs from the original design draft.
 
**Conventions**
- Every table filled by a scraper has a **source key** (unique) — scripts write with upsert on that key so re-runs update rows instead of duplicating them.
- All geometry is SRID 4326 (lat/lng).
- Tag columns are `text[]`.
- Geography is **wards + ridings only** (no neighbourhoods). An address point resolves to one ward, one federal riding, one provincial riding.
- RLS is **not enabled** — this is a public, read-only dataset with no per-user rows.
---
 
## Geography
 
### `wards`
| Column | Type | Notes |
|---|---|---|
| ward_id | serial PK | |
| ward_number | int, unique | source key; joins to councillor data |
| ward_name | text | |
| boundary | geometry(MultiPolygon, 4326) | address→ward lookup, powers the map |
 
Index: GiST on `boundary`. 24 rows (2022–2026 ward boundaries — check Open Ottawa's Wards 2026-2030 dataset before the Oct 26, 2026 election).
 
### `ridings`
| Column | Type | Notes |
|---|---|---|
| riding_id | serial PK | |
| level | enum(federal/provincial) | federal and provincial boundaries are separate, don't assume they match |
| code | text | official district code (Elections Canada / Elections Ontario) — always match on this, never on name (ridings were renamed Sept 16, 2026) |
| name | text | |
| boundary | geometry(MultiPolygon, 4326) | address→riding lookup for "Your MP" / "Your MPP" |
 
Unique `(level, code)`. Index: GiST on `boundary`. 18 rows total (9 federal + 9 provincial, Ottawa-area only — kept where a riding covers ≥1% of the city).
 
**Address → reps lookup** (one query, fed by one geocode call):
```sql
select
  (select ward_id   from wards   where ST_Contains(boundary, p.pt)) as ward_id,
  (select riding_id from ridings where level = 'federal'    and ST_Contains(boundary, p.pt)) as federal_riding_id,
  (select riding_id from ridings where level = 'provincial' and ST_Contains(boundary, p.pt)) as provincial_riding_id
from (select ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) as pt) p;
```
Geocoding uses the City of Ottawa's public ArcGIS locator (exact matches only) to turn an address into `:lng`/`:lat`.

**Function `ward_lookup(lat, lng)`** (`db/functions/ward_lookup.sql`): returns the containing ward's number and name, its councillor's name/email/phone, and the boundary as GeoJSON. No rows when the point is outside Ottawa. Called by the web app's `/api/ward` route.

**Function `riding_lookup(lat, lng)`** (`db/functions/riding_lookup.sql`): returns the federal and provincial ridings containing the point (level, code, name, member name/party/email, boundary as GeoJSON). No rows unless the point is inside an Ottawa ward. Called by the web app's `/api/riding` route.
 
**Function `ottawa_mask()`** (`db/functions/ottawa_mask.sql`): returns the world extent minus the union of all ward boundaries (the city limits), as GeoJSON. Called by the web app's `/api/ottawa-mask` route; the map uses its holes to black out everything outside the city.
 
---
 
## Municipal core
 
### `councillors`
| Column | Type | Notes |
|---|---|---|
| councillor_id | serial PK | |
| htv_slug | text, unique | source key (howtheyvoted.ca); reliable vote-matching |
| name | text | |
| ward_id | FK → wards, nullable | null for the mayor |
| is_mayor | bool | |
| email | text | "Email your councillor" |
| phone | text | |
 
One councillor per ward, one mayor row. Current term (2022–2026) only.
 
### `dev_apps`
| Column | Type | Notes |
|---|---|---|
| app_id | serial PK | |
| file_number | text, unique | source key; also gives the real filing year |
| address | text, nullable | some records have none in the source |
| location | geometry(Point, 4326), nullable | map pin |
| application_type | text | e.g. "Zoning By-law Amendment", "Site Plan Control" |
| status | text | card badge |
| last_activity_date | date, nullable | feed sort-by-recency |
| ward_id | FK → wards, nullable | point-in-polygon against `location` |
| source_url | text | |
| planner_email | text | "Email the planner" |
 
Index: GiST on `location`, btree on `ward_id`.
 
### `consultations`
| Column | Type | Notes |
|---|---|---|
| consultation_id | serial PK | |
| title | text | |
| description | text | feeds the AI "options compared" summary |
| ward_id | FK → wards, nullable | |
| is_citywide | bool | routes to "Affects everyone" |
| closing_date | date, nullable | open = `closing_date >= current_date` |
| source_url | text, unique | source key |
 
### `meetings`
| Column | Type | Notes |
|---|---|---|
| meeting_id | text PK | source key (same ID eScribe/OttWatch use) |
| committee_name | text | |
| meeting_date | date | |
| speak_by_date | date, nullable | |
| source_url | text | |
 
### `motions`
| Column | Type | Notes |
|---|---|---|
| motion_id | serial PK | |
| meeting_id | FK → meetings | |
| motion_number | text | source key with `meeting_id` |
| summary | text | plain-English card line |
| ward_id | FK → wards, nullable | null = city-wide → "Affects everyone" |
| tags | text[] | closed tag list (see below) |
| vote_kind | enum(none/dissent/recorded) | |
| result | enum(carried/lost/notice), nullable | |
| related_dev_app_id | FK → dev_apps, nullable | address-matched |
 
Unique `(meeting_id, motion_number)`.
 
### `motion_votes`
| Column | Type | Notes |
|---|---|---|
| motion_vote_id | serial PK | |
| motion_id | FK → motions | |
| councillor_id | FK → councillors | matched via `htv_slug` |
| vote | enum(yea/nay/abstain) | |
 
Unique `(motion_id, councillor_id)`.
 
### `lobbying_entries`
| Column | Type | Notes |
|---|---|---|
| lobbying_id | serial PK | |
| client_name | text | "Who's been talking to the City about this?" |
| lobbyist_name | text | |
| subject | text | |
| date | date | |
| source_url | text, unique | source key |
 
No ward/geo link — matched by company name only, which won't always work.
 
---
 
## Provincial
 
### `mpps`
| Column | Type | Notes |
|---|---|---|
| mpp_id | serial PK | |
| ola_member_id | text, unique | source key |
| name | text | |
| riding_id | FK → ridings (level=provincial), nullable | null for the one MPP whose riding isn't loaded |
| party | text | |
| email | text | "Contact your MPP" |
 
9 Ottawa-area MPPs (the 8 core ridings plus Glengarry—Prescott—Russell, which covers Ottawa's rural east).
 
### `provincial_bills`
| Column | Type | Notes |
|---|---|---|
| bill_id | serial PK | |
| parliament | int | |
| session | int | |
| bill_number | text | |
| title | text | |
| sponsor_mpp_id | FK → mpps, nullable | drives "always include Ottawa MPP bills" |
| is_government_bill | bool | |
| current_stage | text | latest stage-history row |
| last_activity_date | date, nullable | |
| topic_tags | text[] | |
| source_url | text | |
 
Unique `(parliament, session, bill_number)`.
 
### `provincial_votes`
| Column | Type | Notes |
|---|---|---|
| vote_id | serial PK | |
| bill_id | FK → provincial_bills | |
| vote_label | text | e.g. "Second Reading" |
| vote_date | date | |
 
Unique `(bill_id, vote_label, vote_date)`.
 
### `provincial_ballots`
| Column | Type | Notes |
|---|---|---|
| vote_id | FK → provincial_votes | |
| mpp_id | FK → mpps | matched via `ola_member_id` |
| ballot | enum(yea/nay/absent) | |
 
PK `(vote_id, mpp_id)`.
 
---
 
## Federal
 
### `mps`
| Column | Type | Notes |
|---|---|---|
| mp_id | serial PK | |
| house_person_id | int, unique | source key; vote records identify MPs by this |
| name | text | |
| riding_id | FK → ridings (level=federal) | |
| party | text | |
| email | text | "Contact your MP" |
 
9 Ottawa-area MPs (one per federal riding).
 
### `federal_bills`
| Column | Type | Notes |
|---|---|---|
| bill_id | serial PK | |
| legisinfo_id | int, unique | source key |
| parliament | int | |
| session | int | |
| number_code | text | e.g. "C-25" |
| title | text | |
| status_name | text | LEGISinfo's plain-English status |
| is_government_bill | bool | derived from `BillDocumentTypeName`, not LEGISinfo's own (always-false) flag |
| origin_chamber | enum(house/senate) | |
| sponsor_mp_id | FK → mps, nullable | set only for Ottawa MPs |
| last_activity_date | date, nullable | |
| topic_tags | text[] | |
| source_url | text | |
 
Unique `legisinfo_id`; also `(parliament, session, number_code)`.
 
### `federal_votes`
| Column | Type | Notes |
|---|---|---|
| vote_id | serial PK | |
| parliament | int | |
| session | int | |
| division_number | int | source key |
| bill_id | FK → federal_bills | |
| vote_label | text | split votes carry the part here |
| vote_date | date | |
 
Unique `(parliament, session, division_number)`.
 
### `federal_ballots`
| Column | Type | Notes |
|---|---|---|
| vote_id | FK → federal_votes | |
| mp_id | FK → mps | matched via `house_person_id` |
| ballot | enum(yea/nay/paired) | absent MPs have no row |
 
PK `(vote_id, mp_id)`.
 
---
 
## Preset topics (closed tag vocabulary)
 
The only valid values for `topic_tags` / `tags` — assigned by an LLM classification pass reading title + summary, not keyword rules.
 
| Tag | Covers |
|---|---|
| Housing & Development | Zoning, rezoning, housing supply, rent, building codes, heritage designations |
| Transit & Roads | Buses, LRT, bike lanes, road work, traffic calming, parking |
| Cost of Living & Taxes | Taxes, fees, affordability, budgets |
| Environment & Climate | Climate action, waste, water, green space |
| Public Safety | Policing, emergency services, bylaw enforcement |
| Health & Social Services | Public health, shelters, addiction/mental health, community services |
| Parks & Recreation | Parks, rec centres, libraries, sports facilities |
| Education & Schools | School boards, tuition, student programs (provincial/federal only) |
| Municipal/Cities' Powers & Governance | Laws changing what cities can/must do, election/government-structure rules |
| Other | Doesn't touch daily Ottawa life — filtered out unless the sponsor is an Ottawa MPP/MP |
 
Agriculture/rural items fold into Housing & Development.
 
---
 
## Indexes (beyond unique constraints above)
 
- GiST: `wards.boundary`, `ridings.boundary`, `dev_apps.location`
- btree on every FK: `councillors.ward_id`, `dev_apps.ward_id`, `consultations.ward_id`, `motions.meeting_id`, `motions.ward_id`, `motions.related_dev_app_id`, `motion_votes.councillor_id`, `mpps.riding_id`, `mps.riding_id`, `provincial_bills.sponsor_mpp_id`, `provincial_votes.bill_id`, `provincial_ballots.mpp_id`, `federal_bills.sponsor_mp_id`, `federal_votes.bill_id`, `federal_ballots.mp_id`
- GIN: `motions.tags`, `provincial_bills.topic_tags`, `federal_bills.topic_tags`
- btree: `last_activity_date` on `dev_apps`, `provincial_bills`, `federal_bills`; `consultations.closing_date`; `meetings.meeting_date`
## What's intentionally left unlinked
- Lobbying has no ward/geo link — company-name match only.
- No `feed_items` table — "Affects everyone" is a query-time union of `motions WHERE ward_id IS NULL` + `consultations WHERE is_citywide` + all of `provincial_bills` + `federal_bills`, sorted by date.
- Councillor/MPP/MP votes stay in three separate tables (no shared ID space between them).