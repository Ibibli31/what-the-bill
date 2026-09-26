# Data sources & app usage reference
 
What each data source is, in plain English, and how StreetWatch Ottawa uses it. For the database shape, see `db-schema.md`; for how the data was actually collected, see `scraping-plan.md` and `collected-data-notes.md`.
 
Provincial and federal content (bills, votes) is **city-wide** — it goes in the "Affects everyone" feed regardless of address, since those laws apply to all of Ottawa. Riding boundaries are used only to answer "who represents my address" (the address→MPP/MP lookup), never to filter which bills show. Municipal content (dev apps, motions, consultations) is ward-specific, resolved the same way via ward boundaries.
 
"How did our reps vote?" (council, MPPs, MPs) is answered by checking a fixed list of Ottawa representatives against a bill/motion's recorded vote — a separate mechanism from the address→riding lookup, which only answers who your rep *is*.
 
---
 
## 1. DevApps
**Plain English:** someone asking the City for permission to build, change, split or demolish something on a property.
**Fields:** file number, type, description, address, status history, City planner (name/email/phone), PDF documents.
**Source:** ottwatch.ca (index) → devapps.ottawa.ca (detail).
**In the app:** map pins in the ward, sidebar card with AI summary, "Email the planner" button.
 
**Types by file code:**
| Code | Type | Plain English |
|---|---|---|
| D01 | Official Plan Amendment | Changing the City's long-term plan for an area |
| D02 | Zoning By-law Amendment | Changing the rules for one property (height, use, parking) |
| D07-12 | Site Plan Control | Checking design details once the rules allow the building; usually a staff decision |
| D07-16 | Plan of Subdivision | Splitting land into lots and new streets |
| D07-04 | Plan of Condominium | Shared ownership, e.g. a private road |
| D07-05 | Demolition Control | Permission to tear down homes |
| (Committee of Adjustment) | Minor variance / consent | Small exceptions, or splitting one lot into two |
 
## 2. Consultations
**Plain English:** the City asking the public about its own plans (parks, sidewalks, bike lanes, traffic calming, city-wide strategies).
**Source:** ottwatch.ca (index) → engage.ottawa.ca (project pages: overview, study area, options, survey, named City contact).
**In the app:** AI "options compared" summary (what you gain / what you lose), "Take the survey" button — likely the strongest demo moment.
 
## 3. Meetings
**Plain English:** a committee discusses an item and votes; City Council makes the final decision about a week later.
**Fields:** date, committee, agenda items with a ward tag, file number, report recommendation, PDFs, deadline to register to speak.
**Source:** ottwatch.ca (index) → pub-ottawa.escribemeetings.com.
**In the app:** filter agenda items by ward, a timeline (filed → comment period → committee → Council), "Speak at this meeting" button with the deadline. The City writes a public submissions summary of what residents said, so a comment becomes part of the official record — good pitch line.
 
## 4. Lobbying
**Plain English:** a public log of companies and consultants contacting City officials to influence decisions.
**Fields:** topic, client, lobbyist, who was contacted, date, method.
**Source:** ottwatch.ca (mirrors the City's Lobbyist Registry).
**In the app:** "Who's been talking to the City about this?" on a dev-app card. Matched by company name only — won't always find a link.
 
## 5. Councillors, mayor and council votes
**Plain English:** who represents each ward, and how they voted when a vote was recorded.
**Source:** howtheyvoted.ca (independent site — credit "Voting data: howtheyvoted.ca" in the app; don't republish its data wholesale).
**In the app:** ward → councillor → "Email your councillor" button. Mayor's own page filters for his votes/motions moved/seconded across all committees.
**Key facts:**
- Most motions have no individual votes recorded — show "Passed without a recorded vote" rather than names.
- A blank result means a notice of motion, to be voted on next meeting — show "Coming up."
- Only current-term (2022–2026) committees are used; committee names changed between terms.
**Committees used:**
| Priority | Committees |
|---|---|
| Core | City Council; Planning and Housing; Agriculture and Rural Affairs |
| Included | Built Heritage; Public Works and Infrastructure; Community Services; Joint Planning and Housing + Agriculture and Rural Affairs; Finance and Corporate Services; Environment and Climate Change; Transit Committee |
| Excluded | Police Service Board; Board of Health; advisory/admin committees — not ward-level or not all-councillor bodies |
 
## 6. Ward boundaries
**Plain English:** the map outline of each of Ottawa's 24 wards — the core of the address→ward feature.
**Source:** Open Ottawa "Wards 2022-2026" (Open Government Licence – City of Ottawa, attribution required).
**Note:** these are the 2022–2026 boundaries. Open Ottawa also publishes Wards 2026-2030 for the Oct 26, 2026 election — check before the demo in case the current ward map needs to change.
 
## 7. Provincial: Ontario bills and Ottawa MPPs
**Plain English:** laws from the Ontario Legislature at Queen's Park — apply to the whole province, so every bill goes in "Affects everyone" regardless of riding.
**Source:** ola.org (current-session bills).
 
**Reading a bill's status:**
- "First Reading → Vote → Carried" does **not** mean the bill passed — it's automatic to allow introduction.
- Only law once the stage history reads "Royal Assent received."
- Path: First Reading → Second Reading (first real vote) → Committee → Third Reading (final vote) → Royal Assent.
- Government bills (sponsor "Hon. … (Minister of …)") usually pass; Private Members' bills (regular MPPs, mostly opposition) rarely do.
**Status badges:**
| Latest stage says | Show users |
|---|---|
| First Reading, Ordered for Second Reading | 🟡 Introduced |
| Second Reading, Ordered referred to committee | 🟠 Being studied in committee |
| Third Reading, Vote, Carried | 🟢 Passed final vote |
| Royal Assent received | ✅ Now law |
| Lost on division | 🔴 Voted down |
 
**Which bills show:** an automatic filter, not a hand-picked list — past First Reading, tagged with a relevant topic, or sponsored by an Ottawa MPP regardless of topic/stage (labelled "Introduced by an Ottawa MPP, not yet debated").
 
**"How did our MPPs vote?":** for any bill with "Carried/Lost on division," check whether each of the 9 Ottawa-area MPPs appears and how they voted. Only "on division" votes have named ballots — a plain "Carried" means "No recorded vote."
 
**Ottawa-area MPPs (9):**
| Riding | MPP | Party |
|---|---|---|
| Carleton | George Darouze | PC |
| Kanata—Carleton | Karen McCrimmon | Liberal |
| Nepean | Tyler Watt | Liberal |
| Orléans | Stephen Blais | Liberal |
| Ottawa Centre | Catherine McKenney | NDP |
| Ottawa South | John Fraser | Liberal |
| Ottawa—Vanier | Lucille Collard | Liberal |
| Ottawa West—Nepean | Chandra Pasma | NDP |
| Glengarry—Prescott—Russell | Stéphane Sarrazin | — |
 
**Take action:** Environmental Registry of Ontario (ero.ontario.ca) for public comment; committee submissions (ola.org/en/get-involved/participate-committees); "Contact your MPP" via the address lookup.
 
## 8. Federal: Parliament of Canada bills, votes and Ottawa MPs
**Plain English:** federal laws — apply to the whole country, also go in "Affects everyone."
**Source:** LEGISinfo JSON (bills — `status_name` already gives a plain-English status directly); ourcommons.ca vote XML (votes/ballots).
 
**"How did our MPs vote?":** matched by House of Commons person ID (`house_person_id`), not name. Key facts:
- Most bills pass with no recorded vote at all; even ones that do usually only get it at Second/Third Reading.
- One bill can have several recorded votes — the key one (final reading) shows on the card.
- Not every recorded vote is about a bill (budget/opposition-day motions are excluded).
- A bill that just never got a final vote reads "Didn't pass before Parliament ended," not "Voted down" — that label is reserved for an actual Lost vote.
- Senate bills have no MP votes until they reach the House — shown as "Started in the Senate, not yet voted on by MPs."
- Ballot choices: Yea / Nay / Paired ("Paired" = two MPs on opposite sides agreed to both sit out, cancelling each other's absence).
**Address → "who's my MP":** riding boundaries changed for the 2025 election, and several ridings were renamed again as of Sept 16, 2026 — always match by riding code, never by name.
 
---
 
## Glossary (for "What does this mean?" pop-ups)
 
| Term | Means |
|---|---|
| Zoning | The rules for what can be built on a lot |
| N3, R3, etc. | Zone codes: letter = zone type, number = how much is allowed |
| Official Plan | The City's long-term plan for where and how Ottawa grows |
| By-law | A City law |
| Delegation | A member of the public speaking at a committee meeting |
| In camera | The part of a meeting closed to the public |
| Public submissions summary | The City's record of what residents said and how it affected the decision |
| Engage Ottawa | The City's consultation and survey website |
| Lobbyist Registry | Public log of who contacts City officials to influence decisions |
| Traffic calming | Changes that slow cars down |
| Pedestrian crossover (PXO) | Marked crossing where cars must stop for pedestrians |
| Speed cushion | Speed hump with gaps so buses/fire trucks pass smoothly |
| Ward | One of Ottawa's 24 areas, each with one councillor |
| Recorded vote | A vote where each rep's name/choice is written down; most motions pass without one |
| Notice of motion | A motion announced at one meeting, voted on at the next |
| Mover / seconder | The councillor proposing a motion, and the one backing it so it can be debated |
| MPP | Member of Provincial Parliament — your rep at Queen's Park |
| MP | Member of Parliament — your rep in the federal House of Commons |
| Riding | The area an MP/MPP represents (different from a ward; federal ridings differ from provincial) |
| First / Second / Third Reading | Stages a bill goes through: introduced, debated, final vote |
| Royal Assent | The last step; the bill becomes law |
| Carried / Lost on division | Passed/failed with each rep's vote recorded by name |
| Government bill | From a cabinet minister; usually passes |
| Private member's bill | From a regular MPP/MP, often opposition; rarely becomes law |
| Yea / Nay / Paired | For / against / (paired) sitting out by agreement, cancelling both votes |
| Senate | Canada's upper chamber; Senate bills need no MP vote until reaching the House |