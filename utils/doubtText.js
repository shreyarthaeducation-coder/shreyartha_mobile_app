// utils/doubtText.js
// Port of frontendmain/src/student/components/DoubtResolution/renderDoubtText.js
//
// The AI's replies come back as markdown-lite: **bold** and newlines, nothing else. The web splits
// on `/(\*\*[^*]+\*\*)/g` and wraps each match in <strong>, joining lines with <br/>.
//
// Two details of that regex are load-bearing and are reproduced exactly:
//
//   * `[^*]+` means `**a*b**` is NOT matched — an asterisk inside the delimiters breaks the pair,
//     and the whole run is emitted literally.
//   * A lone unpaired `**` is emitted literally too, rather than swallowing the rest of the text.
//
// The `<br/>` split is NOT needed in React Native: a `\n` inside a <Text> renders as a line break,
// so this returns segments and the caller renders them in one <Text>.

const BOLD = /(\*\*[^*]+\*\*)/g;

/**
 * The SAME pattern, anchored — used to decide whether a split part was a captured bold run.
 *
 * Re-testing the shape by hand (`startsWith('**') && endsWith('**')`) is subtly wrong and was the
 * first version of this file: `**a*b**` starts and ends with `**`, so it got bolded — but `BOLD`
 * never matched it, because `[^*]+` cannot span the inner asterisk. The web emits that string
 * literally. Testing with the same character class is the only way to stay in step with it.
 */
const BOLD_EXACT = /^\*\*[^*]+\*\*$/;

/**
 * Split markdown-lite text into styled segments.
 *
 * @param {string} text
 * @returns {Array<{ text: string, bold: boolean }>} empty for blank input
 */
export function doubtSegments(text) {
  if (!text) return [];
  return String(text)
    .split(BOLD)
    .filter((part) => part !== '')
    .map((part) =>
      BOLD_EXACT.test(part)
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    );
}

export default doubtSegments;
