import { Text } from 'react-native';
import { SLATE, TYPE, leading } from '../../../constants/theme';
import { doubtSegments } from '../../../utils/doubtText';

/**
 * Renders the AI's markdown-lite replies — `**bold**` and newlines, nothing else.
 *
 * One `<Text>` with nested bold runs. The web wraps each line and inserts `<br/>`; React Native
 * renders `\n` inside a Text directly, so the line split is unnecessary and the segments come
 * straight from `utils/doubtText`.
 */
export default function DoubtText({ value, style }) {
  const segments = doubtSegments(value);
  if (segments.length === 0) return null;

  return (
    <Text style={[{ fontSize: TYPE.body, lineHeight: leading(TYPE.body), color: SLATE[700] }, style]}>
      {segments.map((seg, i) =>
        seg.bold ? (
          // eslint-disable-next-line react/no-array-index-key
          <Text key={i} style={{ fontWeight: '800', color: SLATE[800] }}>
            {seg.text}
          </Text>
        ) : (
          // eslint-disable-next-line react/no-array-index-key
          <Text key={i}>{seg.text}</Text>
        ),
      )}
    </Text>
  );
}
