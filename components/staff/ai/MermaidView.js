import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SLATE } from '../../../constants/theme';

/**
 * Renders the AI's mermaid diagram.
 *
 * `react-native-svg` cannot parse mermaid's DSL, so this is the one place a WebView earns its
 * keep: mermaid is a browser library and runs unchanged. Same `securityLevel: 'strict'` and same
 * "invalid code renders nothing" behaviour as TeachAiPanel's TaiDiagram — the AI does produce
 * broken mermaid often enough that an error box would be noise.
 *
 * Height is posted back after render because the SVG's size is only known once mermaid has run.
 */

const CDN = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

const page = (code) => `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden}
  #d{padding:4px}
  #d svg{max-width:100%;height:auto;display:block;margin:0 auto}
</style></head><body>
<div id="d"></div>
<script type="module">
  const post = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
  try {
    const mermaid = (await import('${CDN}')).default;
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
    const code = ${JSON.stringify(code || '')};
    const { svg } = await mermaid.render('d-1', code);
    document.getElementById('d').innerHTML = svg;
    // rAF so layout has settled before we measure.
    requestAnimationFrame(() => post({ ok: true, height: document.getElementById('d').scrollHeight }));
  } catch (e) {
    post({ ok: false });
  }
</script></body></html>`;

export default function MermaidView({ code }) {
  const [height, setHeight] = useState(0);
  const [failed, setFailed] = useState(false);
  const html = useMemo(() => page(code), [code]);

  if (!code || failed) return null;

  return (
    <View style={[styles.wrap, height ? { height } : styles.pending]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.ok) setHeight(Math.min(Math.max(msg.height, 80), 600));
            else setFailed(true);
          } catch {
            setFailed(true);
          }
        }}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  // Zero-height would unmount the WebView before it can report back.
  pending: { height: 1, opacity: 0 },
  web: { flex: 1, backgroundColor: 'transparent' },
});
