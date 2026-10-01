import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SLATE, TYPE } from '../constants/theme';
import RichText from './RichText';

/**
 * A question's text as the website's editor wrote it.
 *
 * Plain and lightly formatted HTML renders natively through RichText (react-native-render-html).
 * Maths and tables do not: the editor stores maths as KaTeX's own rendered HTML, which needs
 * KaTeX's stylesheet and fonts to read as maths rather than as a jumble of spans, and render-html
 * draws tables poorly. Those go through a small auto-height WebView with the same KaTeX version the
 * website uses (frontendmain → katex 0.16.47).
 */

export const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css';

/** Whether this HTML needs a browser to read right: KaTeX maths, or a table. */
export const needsWebView = (html) => /data-math-rendered|class="katex|<table\b/i.test(String(html || ''));

const page = (html, fontSize) => `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="${KATEX_CSS}"/>
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden}
  body{font-family:-apple-system,Roboto,Arial,sans-serif;font-size:${fontSize}px;line-height:1.45;color:#334155}
  #c{padding:0 1px}
  p{margin:0 0 4px}
  img{max-width:100%;height:auto}
  table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #cbd5e1;padding:3px 6px}
  .katex-display{overflow-x:auto;overflow-y:hidden}
</style></head><body><div id="c">${html}</div>
<script>
  const post = () => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(String(document.getElementById('c').scrollHeight));
  window.addEventListener('load', () => requestAnimationFrame(post));
  setTimeout(post, 400);
</script></body></html>`;

export function MathHtml({ html, fontSize = TYPE.body }) {
  const [height, setHeight] = useState(0);
  const source = useMemo(() => ({ html: page(String(html || ''), fontSize) }), [html, fontSize]);
  return (
    // pointerEvents "none": this is a picture of the text, never touched. Letting the WebView take
    // touches let a drag that began on a question's maths stay with it, and the list stopped scrolling.
    <View style={[styles.wrap, height ? { height } : styles.pending]} pointerEvents="none">
      <WebView
        originWhitelist={['*']}
        source={source}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        onMessage={(e) => {
          const next = Number(e.nativeEvent.data);
          if (next > 0) setHeight(Math.min(Math.max(next + 4, 20), 1200));
        }}
      />
    </View>
  );
}

/** The question's text: natively when it can be, in a WebView when maths or a table needs one. */
export default function QuestionHtml({ html, textStyle, numberOfLines }) {
  if (!html) return null;
  if (needsWebView(html)) return <MathHtml html={html} />;
  return <RichText html={html} textStyle={textStyle} numberOfLines={numberOfLines} />;
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', backgroundColor: 'transparent', borderColor: SLATE[100] },
  // Zero height would unmount the WebView before it reports its size.
  pending: { height: 1, opacity: 0 },
  web: { flex: 1, backgroundColor: 'transparent' },
});
