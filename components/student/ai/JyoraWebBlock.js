import { useState } from 'react';
import { ActivityIndicator, Text, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { SPACING, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * The two parts of a Jyora answer that have no native form: a Mermaid diagram and a YouTube embed.
 *
 * ── WHY A WEBVIEW, AND WHY ONLY HERE ─────────────────────────────────────────
 * Mermaid is a JavaScript renderer with no React Native port, and a YouTube embed is an iframe.
 * Everything else in a Jyora answer — the prose, the image — renders natively, so this component is
 * mounted **only when the response actually carries that field**. A text-only answer, which is the
 * common case, never creates a WebView.
 *
 * The import is a normal top-level one and that is safe: `react-native-webview` is already a
 * dependency and is used elsewhere in the app. (The boot-crash trap recorded in memory was
 * `react-native-pdf`, whose dependency dereferences a native module at import time — not this one.)
 *
 * ── THE MERMAID SOURCE IS AI OUTPUT ──────────────────────────────────────────
 * It is frequently invalid. The web's `mermaid.render(...).catch()` silently renders nothing; the
 * same rule applies here — a broken diagram must never take the answer down with it, so the page
 * catches and reports inline rather than throwing.
 *
 * `originWhitelist` is deliberately narrow per kind: the Mermaid page is local HTML with no network
 * of its own, and the YouTube block only ever loads youtube.com.
 */

// Mermaid is loaded as an ES module from jsDelivr INSIDE the WebView. That is the one external
// fetch in this component, and it is the WebView's, not the app's. When it cannot load, the catch
// below renders the diagram source as plain text — still readable, and better than an empty box.
const mermaidHtml = (code) => `<!doctype html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<style>
  body { margin:0; padding:12px; font-family:-apple-system,Roboto,sans-serif; background:#faf5ff; }
  #d { display:flex; justify-content:center; }
  svg { max-width:100%; height:auto; }
  pre { white-space:pre-wrap; font-size:12px; color:#6b7280; }
</style></head>
<body>
<div id="d"></div>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
  const code = ${JSON.stringify(code)};
  const post = (h) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(String(h));
  mermaid.render('jyora-diagram', code)
    .then(({ svg }) => {
      document.getElementById('d').innerHTML = svg;
      post(document.body.scrollHeight);
    })
    .catch(() => {
      // Invalid AI-generated Mermaid. Show the source rather than an empty box.
      document.getElementById('d').innerHTML = '<pre>' + code.replace(/[<>&]/g, '') + '</pre>';
      post(document.body.scrollHeight);
    });
</script>
</body></html>`;

const youtubeHtml = (videoId) => `<!doctype html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<style>html,body{margin:0;padding:0;background:#000;overflow:hidden}
iframe{border:0;width:100%;height:100%;position:absolute;inset:0}</style></head>
<body><iframe src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?playsinline=1"
  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen></iframe></body></html>`;

export default function JyoraWebBlock({ kind, value, title }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState(220);

  if (!value) return null;

  const isVideo = kind === 'youtube';
  // 16:9 inside the card's padding.
  const videoHeight = Math.round(((width - SPACING.md * 2) * 9) / 16);

  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{isVideo ? `🎬 ${title}` : `📊 ${title}`}</Text> : null}
      <View style={[styles.frame, { height: isVideo ? videoHeight : height }]}>
        <WebView
          originWhitelist={isVideo ? ['https://*.youtube.com', 'https://*.ytimg.com'] : ['*']}
          source={{ html: isVideo ? youtubeHtml(value) : mermaidHtml(value) }}
          style={styles.web}
          scrollEnabled={!isVideo}
          javaScriptEnabled
          domStorageEnabled={isVideo}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color="#7C3AED" />
            </View>
          )}
          // The diagram's real height is only known once Mermaid has laid it out.
          onMessage={(e) => {
            if (isVideo) return;
            const h = Number(e?.nativeEvent?.data);
            if (Number.isFinite(h) && h > 40) setHeight(Math.min(h + 16, 520));
          }}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { marginTop: SPACING.md },
  title: { fontSize: TYPE.label, fontWeight: '700', color: '#5B21B6', marginBottom: 6 },
  frame: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#faf5ff' },
  web: { flex: 1, backgroundColor: 'transparent' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
