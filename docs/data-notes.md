# Collected data — current state
 
Describes what's actually in the database right now (loaded per `claude/supabase-load-notes.md`, matching the schema in `claude/db-schema.md`). Source URLs and fetch mechanics are in `claude/scraping-plan.md`.
 
## Scope actually collected
 
- **Ottawa MPPs: 9** — the 8 core ridings plus Stéphane Sarrazin (Glengarry—Prescott—Russell, which covers Ottawa's rural east, ~9% of the city).
- **Provincial bills: spring 2026 sitting only** (latest stage-history row on/after 2026-03-01) — 89 of 191 current bills. Queen's Park hasn't moved since Aug 12, 2026, so a stricter recent-activity filter would return nothing.
- **Federal bills:** all 187 current-session bills (no date scoping needed — LEGISinfo already returns only current-session bills).
- **Federal votes:** 53 recorded votes on a bill itself (Second Reading, Report Stage concurrence, Third Reading, Senate amendments — split votes carry the part in `vote_label`). Non-bill divisions, time allocation, report-stage amendments, recommittal/reasoned amendments are excluded.
- **Provincial votes:** 23 recorded Second/Third Reading divisions across the 89 in-scope bills (10 closure votes excluded), 9 Ottawa MPPs only.
- **Municipal activity (meetings/motions/lobbying/dev app status updates):** September 2026 only.
- **Reference data (wards, ridings, councillors, MPPs, MPs):** current roster, not date-scoped.
## Known data quirks
 
- **Federal votes** come from ourcommons.ca vote XML, not openparliament.ca. MP IDs are House of Commons person IDs (`house_person_id`). Absent MPs have no ballot row. Carney is missing from 5 votes.
- **`federal_bills.sponsor_mp_id`** is set only for bills sponsored by Ottawa MPs: C-1 (Carney), C-11 (McGuinty), C-248 (Lalonde).
- **`federal_bills.is_government_bill`** is derived from `BillDocumentTypeName` (44 government bills) — LEGISinfo's own `IsGovernmentBill` flag came back false on all 187 bills and isn't used.
- **Geocoding** uses the City of Ottawa's public ArcGIS locator (exact matches only), not Google Maps — confirmed accurate to within about a metre against the devapps API's own address points.
  - `dev_apps.location`: the City's own address point, or the geocoder's when the API returned 0,0 (happened once, for a new address). `ward_id` is point-in-polygon and matches the City's own ward on every located app. Two "City Wide" by-law amendments have no location or ward.
  - `motions.ward_id`: set only for site-specific items (26 of 71) — multi-ward items (e.g. a corridor spanning wards, rural operations, a bus route, road closures spanning two wards) stay null (city-wide).
  - `consultations`: 14 have a ward, 2 are explicitly city-wide. Two others (a park with no single stated site, and sidewalks spanning two wards) are local but left with `ward_id` null and `is_citywide` false.
- **`wards.boundary`** is GeoJSON MultiPolygon at full source precision — rounding to 6 decimals breaks Ward 1's geometry (self-intersects). These are the 2022–2026 wards; Open Ottawa also publishes Wards 2026-2030 for the Oct 26, 2026 election — check before the demo.
- **`ridings`**: 9 provincial + 9 federal, Ottawa-area only (kept where a riding covers ≥1% of the city; a riding only touching the city line is 0.1% or less). Provincial code is `ED_ID` (2022 districts), federal is `FED_NUM` (2023 representation order) — some federal ridings were renamed Sept 16, 2026, so always match by code.
- **howtheyvoted.ca**: a Sept 9 Brownfield grant vote had 26 ballots for 25 people (a stray duplicate name) — those votes are excluded.
- **ola.org blocks scripted access** (Akamai 403), including its PDFs — `provincial_bills` came from a browser-rendered snapshot of the current-bills list rather than a raw fetch; `mpps` still depends on browser-rendered profile pages.
- **Provincial ballots**: read directly off the vote-page text rather than parsed from structured data. An MPP not listed on a vote page is recorded as `absent`.
- **Lobbying**: covers undertakings back to Mar 23, 2026 — paging stopped once a page's newest entry predated June 2026.
- **Consultations `closing_date`**: taken from whatever date the source actually states (a Key Dates deadline, the end of a Key Dates range, or the survey's own scheduled close, in that priority order) — a couple of consultations show a stated close date even though their survey itself has no scheduled end and still shows as published; the stated date is kept either way.
- **"Children's Services Surveys"** is excluded from consultations — it's an admin hub for child-care providers, not a resident consultation.
Attribution: voting data from howtheyvoted.ca; ward data under the Open Government Licence – City of Ottawa.
 