// services/shreyaApi.js
// A factory for the Shreya chatbot transport. Backs services/teacher/shreyaService.js and
// services/parent/shreyaService.js.
//
// WHY ONE FACTORY. The three Shreya controllers — parent, teacher and student — share their DTOs
// as literal classes, not parallel copies: `SectionSummaryRequest`, `ShreyaChatRequest`,
// `ShreyaReplyResponse`, `SubTile` and `ChapterLink` all live in one package
// (backend infrastructure/shreya). They also share an error contract, spelled out below. So the
// only things that differ per portal are the base path and which HTTP client carries the token.
//
// THE ERROR CONTRACT, identical across portals and load-bearing for the UI:
//
//   /history          catches everything server-side and returns `{messages: []}`. It CANNOT fail,
//                     because history is a nicety that must never stop the panel from opening.
//   /section-summary  an AI failure still returns **200 with `fallback: true`** and the sub-tiles
//                     intact, so the caller renders its own static section text and the drill-down
//                     keeps working. Only a genuinely broken request 400s or 500s.
//   /chat             has **no fallback** — a DeepSeek outage is a 502 and the caller must show a
//                     retry message.
//
// Treating section-summary like chat (or vice versa) is the easy mistake: one degrades gracefully,
// the other does not.

/**
 * DeepSeek round trips are slow — well past the default timeout on either client. The web has no
 * timeout at all (plain axios/fetch), so anything we pick is stricter than production; 60 s is long
 * enough for a cold section summary and short enough that a dead connection still surfaces.
 */
const AI_TIMEOUT_MS = 60000;

/** Only the last 8 turns are sent, matching the web — the backend re-grounds on every call. */
export const CHAT_HISTORY_WINDOW = 8;

/**
 * @param {object} config
 * @param {object} config.client a portal HTTP client (staffApi / parentApi / …)
 * @param {string} config.base   e.g. '/api/parent/shreya'
 */
export function createShreyaService({ client, base }) {
  /**
   * The persisted conversation, oldest first.
   *
   * Guarded here as well as server-side, in case the request itself never lands (offline).
   *
   * @returns {Promise<Array<{ role: 'user'|'assistant', content: string }>>}
   */
  async function fetchChatHistory(signal) {
    try {
      const res = await client.get(`${base}/history`, { signal });
      return Array.isArray(res?.messages) ? res.messages : [];
    } catch {
      return [];
    }
  }

  /**
   * Layer 1 — the AI summary of a section, or of one drill-down item inside it.
   *
   * @param {{ sectionKey: string, itemKey?: string|null }} payload
   * @returns {Promise<{ reply: string|null, fallback: boolean,
   *   subTiles: Array<{ key: string, label: string, selected: boolean }>,
   *   chapterLink: { label, route, state }|null }>}
   */
  function fetchSectionSummary({ sectionKey, itemKey = null }, signal) {
    return client.post(
      `${base}/section-summary`,
      { sectionKey, itemKey },
      { signal, timeoutMs: AI_TIMEOUT_MS },
    );
  }

  /**
   * Layer 2 — free-text chat, grounded server-side in this user's own data.
   *
   * @param {{ sectionKey: string|null, itemKey: string|null,
   *   messages: Array<{ role: string, content: string }> }} payload
   * @returns {Promise<{ reply: string }>}
   */
  function sendChatMessage({ sectionKey, itemKey, messages }, signal) {
    return client.post(
      `${base}/chat`,
      {
        sectionKey: sectionKey || null,
        itemKey: itemKey || null,
        messages: (messages || []).slice(-CHAT_HISTORY_WINDOW),
      },
      { signal, timeoutMs: AI_TIMEOUT_MS },
    );
  }

  return { fetchChatHistory, fetchSectionSummary, sendChatMessage };
}
