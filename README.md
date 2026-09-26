# What The Bill?
**Your city. Your government. In plain English.**

What The Bill is a civic web app for Ottawa residents. You enter your address or postal code, and it shows your ward, your electoral districts, and the people who represent you. Then you choose a level of government (municipal, provincial, or federal) to see the bills, motions, and decisions that affect you, how your representatives voted, and who has been lobbying them. Everything is explained in plain language.

Built for Ottawa. By the people, for the people.

---

## Features

- **Location lookup.** Enter an address or postal code to find your city ward, provincial riding and federal riding.
- **Your representatives.** See your city councillor, your MPP, and your MP, with contact details and photos.
- **Level picker.** Switch between **Municipal**, **Provincial**, and **Federal** views.
- **Bills and decisions that affect you.** See current and recent bills, council motions, and committee items each with a plain English summary.
- **Voting records.** See how your representative voted on each item.
- **Lobbying activity.** See registered lobbying communications with your representatives.
- **Source links.** Every summary links back to the official record.

---

## How It Works

```
Address / postal code
        │
        ▼
 Ward, ridings, representatives
        │
        ▼
 Choose level: Municipal │ Provincial │ Federal
        │
        ▼
 Bills, votes and lobbying
        │
        ▼
 Plain English summaries + "How this affects you"
```

### Addresses

A postal code can cross more than one boundary so postal code lookups are not always accurate. We use the address approach:

**Address.** Geocode the address to a latitude and longitude, then look up the boundaries at that point. This always returns a single match.

---

## Data Sources

| Level | Data | Source | Access |
| --- | --- | --- | --- |
| All | Wards, ridings, representatives |  |  |
| Federal | Bills, votes, MPs, debates |  |  |
| Federal | Official bill text and status |  |  |
| Federal | Lobbying communications |  |  |
| Provincial | Bills, votes, MPPs |  |  |
| Municipal | Council and committee agendas, minutes, votes |  |  |
| Municipal | Lobbying |  |  |

**Data notes:**

---

## Plain English Summaries

Bills and motions are summarized ahead of time by an LLM and stored with the record. Each summary includes:

- **What it does**: a two or three sentence summary
- **How it might affect you**: its practical impact on residents
- **Status**: where it is in the process
- **Official source**: a link to the full text

Summaries are not legal advice. The official text is always the authority.

---

## Project Structure (proposed)

```
what-the-bill/
├── web/            # Frontend (landing page, location search, level views)
├── api/            # Backend API (lookup, bills, votes, lobbying endpoints)
├── ingest/         # Scheduled scrapers and API importers per data source
│   ├── federal/
│   ├── provincial/
│   └── municipal/
├── summarize/      # LLM summarization jobs
└── db/             # Schema and migrations
```

---

## Getting Started

> The stack is still being finalized.
> 

```bash
git clone <repo-url>
cd what-the-bill
# install dependencies
# copy .env.example to .env and fill in the keys
# run the dev server
```

### Environment variables (expected)

| Variable | Purpose |
| --- | --- |
| `GEOCODER_API_KEY` | Converts addresses to latitude and longitude |
| `LLM_API_KEY` | Generates plain English summaries |
| `DATABASE_URL` | bills, votes, and lobbying records |
|  |  |

---

## Contributing

Contributions are welcome. Open an issue to discuss an idea or report a data problem, or submit a pull request.

## Disclaimer

What The Bill is not a government website. Data comes from public sources and may be incomplete or out of date. Always check the official record.

## License

TBD
