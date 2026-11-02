import { useMemo } from 'react';
import { Text } from 'react-native';
import { CATEGORY_STYLE } from '../../../../constants/shreyaSpeaking';
import { vocabSegments } from '../../../../utils/vocabHighlight';

/**
 * A line of the passage with its vocabulary words and phrases in bold, in their categories'
 * colours (2 Nov 2026) — the website's `VocabText`. Nested inside the line's own `<Text>`, so the
 * text around each word keeps the line's style; a word whose category has no colour stays plain.
 */
export default function VocabText({ text, vocabulary }) {
  const segments = useMemo(() => vocabSegments(text, vocabulary), [text, vocabulary]);
  return segments.map((s, i) => {
    const colour = s.category && CATEGORY_STYLE[s.category]?.colour;
    return colour ? (
      <Text key={i} style={{ fontWeight: 'bold', color: colour }}>
        {s.text}
      </Text>
    ) : (
      s.text
    );
  });
}
