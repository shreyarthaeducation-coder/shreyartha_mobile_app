/**
 * The text of Shreya's most recent turn in a chat-sheet transcript — what the header's "Shreya
 * Speak" reads. Same rule as the website's `components/ShreyaVoice/latestShreyaTurn.js`.
 *
 * A turn is every bot message after the user's last message: a section summary arrives together
 * with its "Want to go deeper?" prompt, and reading only the prompt would be useless. Typing
 * indicators are skipped (while Shreya thinks there is nothing to read, and "" disables the
 * button), and the walk stops at the "New conversation" divider, so a reopened sheet reads today's
 * greeting and never last week's history. `**bold**` markers are stripped — `htmlToText` leaves
 * them, and the voice would read them out.
 *
 * Import-free on purpose: scripts/checkshreyavoice.mjs evaluates it directly.
 */
export function latestShreyaTurn(messages) {
  if (!Array.isArray(messages)) return '';
  const parts = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (!msg || msg.divider || msg.sender === 'user') break;
    if (msg.sender === 'bot' && !msg.typing && typeof msg.text === 'string' && msg.text.trim()) {
      parts.unshift(msg.text.trim());
    }
  }
  return parts.join('\n\n').replace(/\*\*/g, '').trim();
}
