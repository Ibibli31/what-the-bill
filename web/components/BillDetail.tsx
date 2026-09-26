"use client";

import { useEffect, useState } from "react";
import { VOTE_LABEL, type Bill, type ItemKind, type Vote } from "@/lib/bill";
import type { Representative, TextStyle } from "@/components/Sidebar";
import GlossaryText from "@/components/GlossaryText";
import styles from "@/modules/BillDetail.module.css";

type Role = { role: string; short: string; label: string };

/** Per-kind wording: what the summary is called and where the source link goes. */
const COPY: Record<ItemKind, { about: string; source: string }> = {
  bill: { about: "What it does", source: "Read the official text" },
  motion: { about: "What it does", source: "View the meeting record" },
  consultation: { about: "What it’s about", source: "View the consultation" },
  devApp: { about: "What’s proposed", source: "View the application" },
};

/** The one thing to do next, when there is one. Opens the same page as the source link. */
function nextAction(bill: Bill) {
  if (bill.kind === "consultation" && bill.status === "Open") return "Give feedback";
  if (bill.kind === "devApp" && bill.voteSoon) return "Comment on this application";
  return null;
}

/** Summaries fetched this session, keyed by bill id. */
const generated = new Map<string, string>();

const POLL_MS = 2000;
const MAX_POLLS = 8;

/** Fetches a plain-language summary for a bill that has none saved, waiting out a summary another request is writing. */
function useGeneratedSummary(bill: Bill, enabled: boolean) {
  const needed = enabled && !bill.summary;
  const [text, setText] = useState<string | null>(() => generated.get(bill.id) ?? null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!needed || generated.has(bill.id)) return;
    const controller = new AbortController();
    setFailed(false);

    (async () => {
      for (let poll = 0; poll < MAX_POLLS; poll++) {
        const response = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: bill.id }),
          signal: controller.signal,
        });
        if (response.status === 202) {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          if (controller.signal.aborted) return;
          continue;
        }
        if (!response.ok) throw new Error(`Summary request failed with ${response.status}`);
        const { summary } = (await response.json()) as { summary: string };
        generated.set(bill.id, summary);
        setText(summary);
        return;
      }
      throw new Error("Summary took too long");
    })().catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });

    return () => controller.abort();
  }, [bill.id, needed, attempt]);

  return {
    text: bill.summary ?? text,
    loading: needed && !text && !failed,
    failed: needed && !text && failed,
    retry: () => setAttempt((count) => count + 1),
  };
}

function voteNote(vote: Vote, bill: Bill) {
  const on = bill.latestVote ? ` on ${bill.latestVote.label.toLowerCase()} (${bill.latestVote.date})` : "";
  switch (vote) {
    case "none":
      return "No recorded vote on this bill. Many bills pass stages without one.";
    case "paired":
      return `Paired${on}: agreed with a member on the other side that neither would vote.`;
    case "absent":
      return `Didn't vote in the recorded division${on}.`;
    default:
      return `Recorded division${on}.`;
  }
}

function Titlebar({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className={styles.titlebar}>
      {/* Phones/tablets: the details cover the list, so this reads as "back" */}
      <button type="button" className={styles.back} onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>
      <span className={styles.windowTitle}>{title}</span>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close details">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export default function BillDetail({
  bill,
  role,
  textStyle,
  onClose,
}: {
  bill: Bill;
  role: Role;
  textStyle: TextStyle;
  onClose: () => void;
}) {
  const totalMeetings = bill.lobbying.reduce((sum, item) => sum + item.meetings, 0);
  const maxMeetings = Math.max(1, ...bill.lobbying.map((item) => item.meetings));
  const plain = textStyle === "plain";
  const generatedSummary = useGeneratedSummary(bill, plain);
  const summary = plain ? generatedSummary.text : bill.officialSummary;
  // Votes and lobbying are recorded for bills and council motions only.
  const legislative = bill.kind === "bill" || bill.kind === "motion";
  const action = nextAction(bill);

  return (
    <>
      <Titlebar title={bill.number} onClose={onClose} />
      <div className={styles.body}>
        <div className={styles.tags}>
          <span className={styles.tag} data-status={bill.status}>
            <GlossaryText>{bill.statusLabel}</GlossaryText>
          </span>
          {bill.topics.map((topic) => (
            <span key={topic} className={styles.topic}>
              {topic}
            </span>
          ))}
        </div>

        <h2 className={styles.title}>{textStyle === "plain" ? bill.title : bill.officialTitle}</h2>
        {textStyle === "plain" && bill.officialTitle !== bill.title && (
          <p className={styles.updated}>Official title: {bill.officialTitle}</p>
        )}
        {bill.kind === "bill" && bill.updated && <p className={styles.updated}>Last activity {bill.updated}</p>}

        {bill.facts.length > 0 && (
          <dl className={styles.facts}>
            {bill.facts.map((fact) => (
              <div key={fact.label} style={{ display: "contents" }}>
                <dt>{fact.label}</dt>
                <dd>
                  <GlossaryText>{fact.value}</GlossaryText>
                </dd>
              </div>
            ))}
          </dl>
        )}

        {action && (
          <a className={styles.action} href={bill.sourceUrl} target="_blank" rel="noreferrer">
            {action}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}

        {(plain || legislative || summary) && (
          <section className={styles.section}>
            <p className={styles.label}>
              {plain ? COPY[bill.kind].about : "Official summary"}
              {plain && summary && <span className={styles.aiTag}>AI-generated</span>}
            </p>
            {summary ? (
              <p className={styles.text}>{summary}</p>
            ) : generatedSummary.loading ? (
              <div className={styles.skeleton} role="status" aria-label="Writing a plain-English summary">
                <i />
                <i />
                <i />
              </div>
            ) : generatedSummary.failed ? (
              <>
                <p className={styles.muted}>Couldn&rsquo;t write a plain-English summary right now.</p>
                <button type="button" className={styles.retry} onClick={generatedSummary.retry}>
                  Try again
                </button>
                {bill.officialSummary && <p className={styles.text}>{bill.officialSummary}</p>}
              </>
            ) : (
              <p className={styles.muted}>See the official text below.</p>
            )}
          </section>
        )}

        {bill.impact && (
          <section className={`${styles.section} ${styles.impact}`}>
            <p className={styles.label}>How it might affect you</p>
            <p className={styles.text}>
              <GlossaryText>{bill.impact}</GlossaryText>
            </p>
          </section>
        )}

        {legislative && (
          <section className={styles.section}>
            <p className={styles.label}>How {role.short === "CLR" ? "your councillor" : `your ${role.short}`} voted</p>
            {bill.repVote ? (
              <div className={styles.vote}>
                <b data-vote={bill.repVote}>{VOTE_LABEL[bill.repVote]}</b>
                <span>
                  <GlossaryText>{voteNote(bill.repVote, bill)}</GlossaryText>
                </span>
              </div>
            ) : (
              <p className={styles.muted}>
                {bill.votesByRiding ? "Shows once your riding is found." : "Voting records for this level aren't loaded yet."}
              </p>
            )}
          </section>
        )}

        <section className={styles.section}>
          <p className={styles.label}>Progress</p>
          <ol className={styles.stages}>
            {bill.stages.map((stage, index) => {
              const current = stage.done && !bill.stages[index + 1]?.done;
              return (
                <li key={stage.label} data-done={stage.done} data-current={current}>
                  <GlossaryText>{stage.label}</GlossaryText>
                </li>
              );
            })}
          </ol>
        </section>

        {legislative && (
          <section className={styles.section}>
            <p className={styles.label}>
              <GlossaryText>Lobbying</GlossaryText> · {totalMeetings} meeting{totalMeetings === 1 ? "" : "s"}
            </p>
            {bill.lobbying.length === 0 ? (
              <p className={styles.muted}>No registered lobbying on this yet.</p>
            ) : (
              <ul className={styles.lobby}>
                {bill.lobbying.map((item) => (
                  <li key={item.group}>
                    <span className={styles.lobbyName}>{item.group}</span>
                    <span className={styles.bar} aria-hidden="true">
                      <i style={{ width: `${(item.meetings / maxMeetings) * 100}%` }} />
                    </span>
                    <span className={styles.lobbyCount}>{item.meetings}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* The action button already links to the source. */}
        {!action && (
          <a className={styles.source} href={bill.sourceUrl} target="_blank" rel="noreferrer">
            {COPY[bill.kind].source}
          </a>
        )}
      </div>
    </>
  );
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function PhoneIcon() {
  return (
    <svg className={styles.contactIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className={styles.contactIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="m3 7 9 6 9-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Copies the address to paste into webmail; mailto: does nothing without a desktop mail app. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      className={styles.source}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // Clipboard blocked (e.g. insecure context); the address is still shown to select by hand.
        }
      }}
    >
      <MailIcon />
      <span aria-live="polite">{copied ? "Email address copied" : label}</span>
    </button>
  );
}

export function RepDetail({
  role,
  rep,
  bills,
  onOpenBill,
  onClose,
}: {
  role: Role;
  rep?: Representative;
  bills: Bill[];
  onOpenBill: (id: string) => void;
  onClose: () => void;
}) {
  const voted = bills.filter((bill) => bill.repVote && bill.repVote !== "none");
  const yes = voted.filter((bill) => bill.repVote === "yes").length;
  const no = voted.filter((bill) => bill.repVote === "no").length;

  return (
    <>
      <Titlebar title={role.role} onClose={onClose} />
      <div className={styles.body}>
        <div className={styles.repHead}>
          <span className={styles.avatar} aria-hidden="true">
            {role.short}
          </span>
          <div>
            <h2 className={styles.title}>{rep?.name ?? "Not loaded yet"}</h2>
            <p className={styles.updated}>
              {rep
                ? [rep.district, rep.party].filter(Boolean).join(" · ")
                : "Shows once the ward lookup is connected"}
            </p>
          </div>
        </div>

        {(rep?.email || rep?.phone) && (
          <section className={styles.section}>
            <p className={styles.label}>Contact</p>
            {rep.phone && (
              <a className={styles.contactLine} href={telHref(rep.phone)}>
                <PhoneIcon />
                {rep.phone}
              </a>
            )}
            {rep.email && (
              <a className={styles.contactLine} href={`mailto:${rep.email}`}>
                <MailIcon />
                {rep.email}
              </a>
            )}
            <div className={styles.contactActions}>
              {rep.phone && (
                <a className={styles.source} href={telHref(rep.phone)}>
                  <PhoneIcon />
                  Call {rep.name}
                </a>
              )}
              {rep.email && <CopyButton text={rep.email} label={`Email ${rep.name}`} />}
            </div>
          </section>
        )}

        <div className={styles.stats}>
          <div>
            <b>{voted.length}</b>
            <span>votes on these bills</span>
          </div>
          <div>
            <b>{yes}</b>
            <span>voted yes</span>
          </div>
          <div>
            <b>{no}</b>
            <span>voted no</span>
          </div>
        </div>

        <section className={styles.section}>
          <p className={styles.label}>Voting record</p>
          {voted.length === 0 && (
            <p className={styles.muted}>
              {rep ? "No recorded votes on these bills yet." : "Shows once the ward lookup is connected."}
            </p>
          )}
          <ul className={styles.record}>
            {voted.map((bill) => (
              <li key={bill.id}>
                <button type="button" onClick={() => onOpenBill(bill.id)}>
                  <span className={styles.recordTitle}>
                    <span>{bill.number}</span>
                    {bill.title}
                  </span>
                  {bill.repVote && <b data-vote={bill.repVote}>{VOTE_LABEL[bill.repVote]}</b>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}