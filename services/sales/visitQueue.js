import AsyncStorage from '@react-native-async-storage/async-storage';
import { SALES_VISIT_QUEUE_KEY } from '../../constants/storageKeys';
import { checkIn, uploadVisitPhoto } from './salesService';

/**
 * Who is signed in right now.
 *
 * Read here rather than passed in by the screen, deliberately. The owner stamp is a safety
 * property of the queue, and a safety property a caller has to remember to supply is one that is
 * eventually not supplied — the first draft of this file took `ownerEmail` as an argument and
 * every call site omitted it, which left the guard permanently inert.
 */
async function currentOwner() {
  try {
    return (await AsyncStorage.getItem('schoolUserEmail')) || null;
  } catch {
    return null;
  }
}

/**
 * Offline queue for field check-ins.
 *
 * Reps lose signal inside school buildings constantly, and a visit that fails to post is a visit
 * that never happened — it vanishes from their count, their closure report and, downstream, the
 * evidence behind their incentive. So a check-in is written to disk first and posted second.
 *
 * Three properties make a retry safe:
 *
 *  1. Every item carries a `dedupeKey` generated at capture time. The server returns the original
 *     visit for a key it has already seen, so a flush that half-succeeded and ran again cannot
 *     create a twin.
 *  2. Every item carries `checkInAt` from the moment of capture, not of sending. A visit that
 *     syncs two days later still lands on the day it happened.
 *  3. Every item carries `ownerEmail`. A flush only sends items captured by the account currently
 *     signed in — on a shared device the next rep must never inherit the previous one's visits.
 *
 * The photo is uploaded as a second request. If it fails the visit is still kept — a logged visit
 * without its photo is worth more than no visit at all — and the item is retained with
 * `photoPending` so a later flush can attach it.
 */

const MAX_ATTEMPTS = 5;

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(SALES_VISIT_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items) {
  try {
    await AsyncStorage.setItem(SALES_VISIT_QUEUE_KEY, JSON.stringify(items));
  } catch {
    // A full disk is not something a rep can act on mid-visit; the in-flight send still happens.
  }
}

export function newDedupeKey() {
  return `mob-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function queueSize() {
  return (await readQueue()).length;
}

/** Adds a captured visit to the queue. Returns the stored item. */
export async function enqueueVisit({ payload, photo }) {
  const item = {
    id: payload.dedupeKey || newDedupeKey(),
    payload: { ...payload, dedupeKey: payload.dedupeKey || newDedupeKey() },
    photo: photo || null,
    ownerEmail: await currentOwner(),
    attempts: 0,
    queuedAt: new Date().toISOString(),
    photoPending: !!photo,
  };
  const queue = await readQueue();
  await writeQueue([...queue, item]);
  return item;
}

/**
 * Attempts to send everything queued for this account.
 *
 * Never throws — it is called on screen focus and on a successful online check-in, where an
 * unhandled rejection would take a screen down for a reason the rep cannot act on.
 *
 * @returns {Promise<{sent:number, failed:number, remaining:number, skipped:number}>}
 */
export async function flushQueue() {
  const queue = await readQueue();
  if (queue.length === 0) return { sent: 0, failed: 0, remaining: 0, skipped: 0 };

  const ownerEmail = await currentOwner();

  const keep = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of queue) {
    // Belt and braces alongside the logout wipe: never post one rep's visit as another's.
    if (item.ownerEmail && ownerEmail && item.ownerEmail !== ownerEmail) {
      skipped += 1;
      keep.push(item);
      continue;
    }

    try {
      const visit = await checkIn(item.payload);
      if (item.photo?.uri && visit?.id) {
        try {
          await uploadVisitPhoto(visit.id, item.photo);
        } catch {
          // The visit is safely on the server; only the photo is outstanding. The item is kept so
          // a later flush retries the upload — and re-posting it is harmless, because the server
          // returns this same visit for the dedupeKey rather than creating a second one. That
          // idempotency is the only reason this retry does not need its own code path.
          keep.push({ ...item, visitId: visit.id, photoPending: true, attempts: item.attempts + 1 });
          sent += 1;
          continue;
        }
      }
      sent += 1;
    } catch (err) {
      const attempts = item.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        // Dropping it beats retrying a permanently rejected payload on every screen focus for
        // the rest of the install. The rep is told the count in the banner.
        failed += 1;
      } else {
        keep.push({ ...item, attempts, lastError: err?.message || 'Sync failed' });
      }
    }
  }

  await writeQueue(keep);
  return { sent, failed, remaining: keep.length, skipped };
}

/** Discards the queue — used only when the rep explicitly chooses to. */
export async function clearQueue() {
  await writeQueue([]);
}
