/**
 * Words the average reader might not know, shown as hover/tap definitions by
 * <GlossaryText>. Based on the glossary in docs/data-sources.md.
 *
 * `pattern` is a regex source matched case-insensitively on word boundaries.
 * Set `caseSensitive` for short acronyms/codes that would otherwise match
 * ordinary words. List longer phrases before shorter ones they contain.
 */
export type GlossaryTerm = {
  term: string;
  pattern: string;
  definition: string;
  caseSensitive?: boolean;
};

export const GLOSSARY: GlossaryTerm[] = [
  // ---- City -----------------------------------------------------------------
  {
    term: "Zoning",
    pattern: "(?:re)?zoning",
    definition: "The rules for what can be built on a piece of land, like houses, shops or apartments, and how big.",
  },
  {
    term: "Zone code",
    pattern: "(?:R[1-5]|N[1-6])[A-Z]{0,2}",
    caseSensitive: true,
    definition: "A short label for a zone. The letter is the type of zone and the number is how much can be built. Higher numbers allow more.",
  },
  {
    term: "Official Plan",
    pattern: "official plan",
    definition: "The City's long-term plan for where and how Ottawa grows.",
  },
  {
    term: "By-law",
    pattern: "by-?laws?",
    definition: "A law made by the City.",
  },
  {
    term: "Delegation",
    pattern: "delegations?",
    definition: "A member of the public who speaks at a committee meeting.",
  },
  {
    term: "In camera",
    pattern: "in camera",
    definition: "The part of a meeting that is closed to the public, usually for legal or personal matters.",
  },
  {
    term: "Public submissions summary",
    pattern: "public submissions? summary",
    definition: "The City's record of what residents said about something, and how it changed the decision.",
  },
  {
    term: "Engage Ottawa",
    pattern: "engage ottawa",
    definition: "The City's website for surveys and asking residents what they think.",
  },
  {
    term: "Lobbyist Registry",
    pattern: "lobbyist registry",
    definition: "A public list of who contacts government officials to try to influence their decisions.",
  },
  {
    term: "Lobbying",
    pattern: "lobbying|lobbied|lobbyists?",
    definition: "When a company or group meets with officials to try to influence a decision. It has to be publicly registered.",
  },
  {
    term: "Traffic calming",
    pattern: "traffic calming",
    definition: "Changes to a street that slow cars down, like speed bumps or narrower lanes.",
  },
  {
    term: "Pedestrian crossover",
    pattern: "pedestrian crossovers?|PXOs?",
    definition: "A marked crossing where drivers must stop and let people walk across.",
  },
  {
    term: "Speed cushion",
    pattern: "speed cushions?",
    definition: "A speed bump with gaps, so buses and fire trucks can pass over smoothly.",
  },
  {
    term: "Ward",
    pattern: "wards?",
    definition: "One of Ottawa's 24 areas. Each ward elects one city councillor.",
  },
  {
    term: "Notice of motion",
    pattern: "notices? of motion",
    definition: "A proposal announced at one meeting so it can be voted on at the next.",
  },
  {
    term: "Motion",
    pattern: "motions?",
    definition: "A formal proposal that the group votes on.",
  },
  {
    term: "Mover / seconder",
    pattern: "movers?|seconders?|seconded",
    definition: "The mover proposes a motion. The seconder supports it so it can be debated.",
  },

  // ---- Voting ---------------------------------------------------------------
  {
    term: "Recorded vote",
    pattern: "recorded votes?",
    definition: "A vote where each representative's name and choice is written down. Most decisions pass without one.",
  },
  {
    term: "On division",
    pattern: "(?:carried|lost|defeated|passed) on division",
    definition: "Passed or failed with each representative's vote recorded by name.",
  },
  {
    term: "Division",
    pattern: "divisions?",
    definition: "A formal vote where each representative's vote is recorded by name.",
  },
  {
    term: "Yea / Nay",
    pattern: "yeas?|nays?",
    definition: "Yea means a vote for. Nay means a vote against.",
  },
  {
    term: "Paired",
    pattern: "paired",
    definition: "Two representatives on opposite sides agreed to both skip the vote, so their absences cancel out.",
  },

  // ---- Provincial & federal ---------------------------------------------------
  {
    term: "MPP",
    pattern: "MPPs?",
    caseSensitive: true,
    definition: "Member of Provincial Parliament. Your representative in Ontario's government at Queen's Park.",
  },
  {
    term: "MP",
    pattern: "MPs?",
    caseSensitive: true,
    definition: "Member of Parliament. Your representative in Canada's federal House of Commons.",
  },
  {
    term: "Riding",
    pattern: "ridings?",
    definition: "The area an MP or MPP represents. Federal and provincial ridings are different from city wards.",
  },
  {
    term: "Reading",
    pattern: "(?:first|second|third) readings?|readings",
    definition: "The stages a bill goes through: first it's introduced, second it's debated, third is the final vote.",
  },
  {
    term: "Committee",
    pattern: "committees?",
    definition: "A smaller group of representatives who study a bill or issue in detail and can suggest changes.",
  },
  {
    term: "Royal Assent",
    pattern: "royal assent",
    definition: "The last step. The bill officially becomes law.",
  },
  {
    term: "Government bill",
    pattern: "government bills?",
    definition: "A bill from a cabinet minister. These usually pass.",
  },
  {
    term: "Private member's bill",
    pattern: "private members?(?:['’]s?)? bills?",
    definition: "A bill from a regular MP or MPP, often in the opposition. These rarely become law.",
  },
  {
    term: "Senate",
    pattern: "senate",
    definition: "Canada's upper chamber. Its members are appointed, and it reviews bills passed by MPs.",
  },
];
