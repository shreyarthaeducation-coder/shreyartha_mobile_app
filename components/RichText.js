import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import RenderHTML from 'react-native-render-html';
import { API_BASE_URL } from '../services/apiService';
import { SLATE, TYPE, leading } from '../constants/theme';

const SAFE_API_BASE_URL = String(API_BASE_URL || '').trim().replace(/[<>"'\s]/g, '').replace(/\/+$/, '');

const normalizeHtml = (html) => {
  const rawHtml = String(html || '').trim();
  if (!rawHtml) return '';
  return rawHtml.replace(/\b(src|href)\s*=\s*(['"])(\/[^'"]*)\2/gi, (_, attr, quote, path) => `${attr}=${quote}${SAFE_API_BASE_URL}${path}${quote}`);
};

/**
 * The type every HTML body starts from, merged UNDER the caller's `textStyle`.
 *
 * There was none. `baseStyle` forwarded whatever the caller passed, so a caller that set no
 * `fontSize` got react-native-render-html's own 14px default — a size outside the scale, chosen by a
 * library, on every Jyora answer and HTML resource that did not happen to pass one. A caller's own
 * values still win; this only fills what they leave out.
 */
const BASE = { fontSize: TYPE.body, lineHeight: leading(TYPE.body), color: SLATE[700] };

/**
 * Heading tags on the scale.
 *
 * h1–h3 take three distinct roles. A generic literal→role rule would have mapped 22, 20 and 18 all
 * to `headline` and flattened three heading levels into one. h4–h6 sit at `body` and are told apart
 * by weight: with body copy now 16, anything smaller would make a heading smaller than the paragraph
 * beneath it.
 */
const heading = (role, weight, top, bottom) => ({
  fontSize: TYPE[role],
  lineHeight: leading(TYPE[role]),
  marginTop: top,
  marginBottom: bottom,
  fontWeight: weight,
});

export default function RichText({ html, textStyle, numberOfLines }) {
  const { width } = useWindowDimensions();
  const resolvedHtml = useMemo(() => normalizeHtml(html), [html]);
  const base = useMemo(() => ({ ...BASE, ...StyleSheet.flatten(textStyle) }), [textStyle]);
  if (!resolvedHtml) return null;

  if (!/[<>&]/.test(resolvedHtml)) {
    return (
      <Text numberOfLines={numberOfLines} style={[BASE, textStyle]}>
        {resolvedHtml}
      </Text>
    );
  }

  return (
    <RenderHTML
      contentWidth={Math.max(0, width - 32)}
      source={{ html: resolvedHtml }}
      baseStyle={base}
      defaultTextProps={numberOfLines ? { numberOfLines } : undefined}
      tagsStyles={{
        p: { marginTop: 0, marginBottom: 10, lineHeight: leading(TYPE.body) },
        strong: { fontWeight: '700' },
        em: { fontStyle: 'italic' },
        u: { textDecorationLine: 'underline' },
        ul: { marginTop: 0, marginBottom: 10, paddingLeft: 18 },
        ol: { marginTop: 0, marginBottom: 10, paddingLeft: 18 },
        li: { marginBottom: 6 },
        h1: heading('headline', '800', 6, 10),
        h2: heading('title', '800', 6, 10),
        h3: heading('heading', '700', 6, 10),
        h4: heading('body', '800', 4, 8),
        h5: heading('body', '700', 4, 8),
        h6: heading('body', '700', 4, 8),
        // No opacity. It dimmed quoted text by the same mechanism that made chat history hard to
        // read; the left rule already marks a quotation.
        blockquote: {
          borderLeftWidth: 3,
          borderLeftColor: 'rgba(148,163,184,0.55)',
          paddingLeft: 10,
          marginTop: 6,
          marginBottom: 10,
        },
        code: {
          backgroundColor: 'rgba(148,163,184,0.2)',
          fontFamily: 'monospace',
          paddingHorizontal: 4,
          borderRadius: 4,
        },
        // A dark code block needs LIGHT text. It painted a 75% navy background and set no colour,
        // so the code inherited the body ink and rendered near-black on dark navy — unreadable in
        // every Jyora answer that contained a code sample.
        pre: {
          backgroundColor: 'rgba(15,23,42,0.75)',
          color: SLATE[50],
          padding: 10,
          borderRadius: 8,
          marginTop: 6,
          marginBottom: 10,
        },
        img: {
          marginTop: 6,
          marginBottom: 10,
        },
        a: {
          textDecorationLine: 'underline',
        },
      }}
      classesStyles={{
        'ql-align-center': { textAlign: 'center' },
        'ql-align-right': { textAlign: 'right' },
      }}
    />
  );
}
