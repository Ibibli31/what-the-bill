import type { Bill } from "@/lib/bill";
import { parseImpacts, type PersonalizedImpact } from "@/lib/personalizedImpact";
import { profileVersion, sanitizeAnswers, type UserProfile } from "@/lib/profile";

export type { PersonalizedImpact };

/**
 * Analyses for this session, keyed by bill id + profile answers, so switching views doesn't re-ask
 * Gemini and an edited profile gets a fresh analysis.
 */
const done = new Map<string, PersonalizedImpact[]>();
const pending = new Map<string, Promise<PersonalizedImpact[]>>();

const cacheKey = (bill: Bill, profile: UserProfile) => `${bill.id}|${profileVersion(profile)}`;

/** A finished analysis for this bill and profile, if there is one. */
export function cachedImpacts(bill: Bill, profile: UserProfile) {
  return done.get(cacheKey(bill, profile));
}

/**
 * How `bill` could affect someone with `profile`, analyzed by Gemini on the server.
 * Rejects when personalization is off, the request fails, or the reply isn't valid impacts.
 */
export function getPersonalizedImpacts(bill: Bill, profile: UserProfile): Promise<PersonalizedImpact[]> {
  if (!profile.personalizationEnabled) return Promise.reject(new Error("Personalization is turned off"));

  const key = cacheKey(bill, profile);
  const finished = done.get(key);
  if (finished) return Promise.resolve(finished);
  const existing = pending.get(key);
  if (existing) return existing;

  const request = (async () => {
    const response = await fetch("/api/impacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bill.id, profile: sanitizeAnswers(profile) }),
    });
    if (!response.ok) throw new Error(`Impact request failed with ${response.status}`);
    const data = (await response.json()) as unknown;
    const impacts = parseImpacts(data);
    if (!impacts) throw new Error("Impact response was not valid");
    done.set(key, impacts);
    return impacts;
  })();

  pending.set(key, request);
  // Settled either way; a failed analysis can then be retried.
  request.then(
    () => pending.delete(key),
    () => pending.delete(key)
  );
  return request;
}
