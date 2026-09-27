__WHAT THE BILL!?__

**Inspiration**

If we were to ask you who the current Prime Minister of Canada is, chances are you'd be able to answer quite easily. But who's your city councillor? What did council vote on last month? For most people the decisions closest to home are the ones they know the least about. The information is public but it's scattered across three levels of government and buried in legal language. We wanted all you'd need to be your address.

**What it does**


Enter your address and What The Bill shows your ward, your councillor, MPP and MP and what's happening at each level of government: council motions, development applications, City consultations and provincial and federal bills. Everything is summarized in plain English and there are pop-up definitions for confusing terms. You can see how your representatives voted and contact them in one tap. Fill in an optional profile, like whether you rent or own and how you get around, and each item also explains how it could affect you personally. Your profile stays in your browser.

**How we built it**


Frontend: Next.js, React and TypeScript.
Database: Supabase (Postgres and PostGIS) matches your address to your ward and ridings.
Data: City of Ottawa, ola.org, LEGISinfo and House of Commons records.
Gemini: the Gemini API writes plain language titles and summaries, plus personalized impact notes, all checked automatically with summaries cached.
Map: Leaflet and MapLibre with OpenFreeMap tiles.
Challenges we ran into
Every level of government publishes its data differently. Federal statuses are full sentences, provincial stages are coded strings and council motions are tied to meeting records, so we had to turn all of it into one consistent format. Votes were tricky too because most items pass without a recorded vote, MPs can be paired or absent, and "First Reading: Carried" doesn't mean a bill passed. Getting Gemini to write summaries that stayed neutral and factual took a strict prompt, automatic checks and retries and caching kept our API costs down. We also went through several map providers and redesigns before landing on a simple look.

**Accomplishments that we're proud of**


We're proud that a single address brings together all three levels of government, plus what's being built and consulted on in your ward, in one clean view. Our plain English summaries stay neutral and stick to the facts, with checks that catch bad output before anyone sees it. We also match real voting records to your representatives, and the whole thing feels approachable on both phone and desktop, even for someone who has never read a bill.

**What we learned**


We learned how Canadian government actually works day to day, from readings and committees to paired votes and how city committees feed into council. We learned how to use an LLM responsibly and give it clear limits, check what it writes and always link back to the official source. We also picked up a lot about spatial databases, geocoding and map styling. Most of all we learned that the hardest part of civic tech isn't the code but It's turning messy public data into something anyone can understand in a few seconds.

**What's next for What The Bill?**


Next we plan to bring in lobbying data, so you can see who has been talking to your representatives about each decision. Alerts would let you know when something in your ward is up for a vote or a consultation opens. We'd also like to add French support, update to the new ward boundaries for the 2026 election, and eventually expand beyond Ottawa to other cities that publish their council records.
