/**
 * HTML → plain text, for the Azure reference text.
 *
 * Replaces the web's `stripToPlainText`, which does the job with
 * `DOMPurify.sanitize` + `document.createElement` + `.textContent`. There is no DOM in React
 * Native, so this has to do it by hand.
 *
 * **This is not cosmetic.** The result is the `referenceText` Azure scores the student's reading
 * against. A leftover `&nbsp;` or `&amp;` becomes a "word" the student never says, so accuracy and
 * completeness are quietly marked down on every single attempt — with nothing on screen to explain
 * why. That is why entity decoding is here and why the checker covers it.
 *
 * Block-level tags become a space rather than vanishing: without that, `<p>one</p><p>two</p>`
 * collapses to "onetwo" and Azure hears a word that does not exist.
 */

/** The entities that actually appear in authored passage HTML. */
const NAMED_ENTITIES = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      // An unparseable numeric entity is left alone rather than turned into garbage.
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? match : named;
  });
}

/**
 * @param {string} html authored passage HTML
 * @returns {string} plain text, whitespace collapsed and trimmed
 */
export function htmlToText(html) {
  if (!html) return '';

  return (
    String(html)
      // Drop anything whose text is not content. Their bodies would otherwise survive tag
      // stripping and end up in the reference text.
      .replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      // Line-breaking tags become whitespace, so adjacent blocks do not fuse into one word.
      .replace(/<\s*(br|hr)\s*\/?\s*>/gi, ' ')
      .replace(/<\/\s*(p|div|li|tr|h[1-6]|blockquote|section|article)\s*>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      // Decode AFTER stripping: a decoded `&lt;b&gt;` must not then be treated as a tag.
      .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m) => decodeEntities(m))
      // Non-breaking space survives decoding as U+00A0 and is not matched by \s in older engines.
      .replace(/ /g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export default htmlToText;
