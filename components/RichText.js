import { useMemo } from 'react';
import { Text, useWindowDimensions } from 'react-native';
import RenderHTML from 'react-native-render-html';
import { API_BASE_URL } from '../services/apiService';

const ABSOLUTE_URL_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/|data:|blob:)/i;

const normalizeHtml = (html) => {
  const rawHtml = String(html || '').trim();
  if (!rawHtml) return '';
  return rawHtml.replace(/\b(src|href)\s*=\s*(['"])(\/[^'"]*)\2/gi, (_, attr, quote, path) => {
    if (ABSOLUTE_URL_REGEX.test(path)) return `${attr}=${quote}${path}${quote}`;
    return `${attr}=${quote}${API_BASE_URL}${path}${quote}`;
  });
};

export default function RichText({ html, textStyle, numberOfLines }) {
  const { width } = useWindowDimensions();
  const resolvedHtml = useMemo(() => normalizeHtml(html), [html]);
  if (!resolvedHtml) return null;

  if (!/[<>&]/.test(resolvedHtml)) {
    return (
      <Text numberOfLines={numberOfLines} style={textStyle}>
        {resolvedHtml}
      </Text>
    );
  }

  return (
    <RenderHTML
      contentWidth={Math.max(0, width - 32)}
      source={{ html: resolvedHtml }}
      baseStyle={textStyle}
      defaultTextProps={numberOfLines ? { numberOfLines } : undefined}
      tagsStyles={{
        p: { marginTop: 0, marginBottom: 10, lineHeight: 21 },
        strong: { fontWeight: '700' },
        em: { fontStyle: 'italic' },
        u: { textDecorationLine: 'underline' },
        ul: { marginTop: 0, marginBottom: 10, paddingLeft: 18 },
        ol: { marginTop: 0, marginBottom: 10, paddingLeft: 18 },
        li: { marginBottom: 6 },
        h1: { fontSize: 22, lineHeight: 30, marginTop: 6, marginBottom: 10, fontWeight: '800' },
        h2: { fontSize: 20, lineHeight: 28, marginTop: 6, marginBottom: 10, fontWeight: '800' },
        h3: { fontSize: 18, lineHeight: 26, marginTop: 6, marginBottom: 10, fontWeight: '700' },
        h4: { fontSize: 16, lineHeight: 24, marginTop: 4, marginBottom: 8, fontWeight: '700' },
        h5: { fontSize: 15, lineHeight: 22, marginTop: 4, marginBottom: 8, fontWeight: '700' },
        h6: { fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 8, fontWeight: '700' },
        blockquote: {
          borderLeftWidth: 3,
          borderLeftColor: 'rgba(148,163,184,0.55)',
          paddingLeft: 10,
          marginTop: 6,
          marginBottom: 10,
          opacity: 0.95,
        },
        code: {
          backgroundColor: 'rgba(148,163,184,0.2)',
          fontFamily: 'monospace',
          paddingHorizontal: 4,
          borderRadius: 4,
        },
        pre: {
          backgroundColor: 'rgba(15,23,42,0.75)',
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
