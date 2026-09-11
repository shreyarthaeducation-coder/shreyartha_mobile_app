import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { PORTALS, SLATE, SPACING, TYPE } from '../../../constants/theme';

/**
 * Full-screen viewer for a generated .glb.
 *
 * The web hand-builds a three.js scene (Model3DModal.js) with PMREM + RoomEnvironment + ACES tone
 * mapping, and its own comment explains why: PBR meshes render near-black without an environment
 * map. Google's <model-viewer> ships exactly that — image-based lighting, ACES, orbit controls —
 * so the whole scene reduces to one tag, and the dark-output problem does not recur.
 *
 * expo-gl + expo-three would be the alternative; that is two native deps and a hand-written
 * render loop to reach the same place.
 */

const PALETTE = PORTALS.school;
const CDN = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js';

const page = (modelUrl) => `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<style>
  html,body{margin:0;height:100%;background:#0f172a}
  model-viewer{width:100%;height:100%;--poster-color:transparent}
  #err{color:#e2e8f0;font:14px system-ui;padding:24px;text-align:center}
</style>
<script type="module" src="${CDN}"></script>
</head><body>
<model-viewer
  src="${modelUrl}"
  camera-controls
  auto-rotate
  touch-action="none"
  shadow-intensity="1"
  exposure="1.1"
  environment-image="neutral"
  onerror="document.body.innerHTML='<div id=err>This model could not be loaded.</div>'">
</model-viewer>
</body></html>`;

export default function Model3DModal({ modelUrl, title, onClose }) {
  const html = useMemo(() => page(modelUrl || ''), [modelUrl]);
  if (!modelUrl) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title || '3D Model'}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close 3D viewer"
          >
            <Ionicons name="close" size={22} color="#ffffff" />
          </Pressable>
        </View>
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.web}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo={false}
          // The .glb sits on the public S3 bucket; the CDN serves model-viewer. Nothing else.
          mixedContentMode="never"
        />
        <Text style={styles.hint}>Drag to rotate · pinch to zoom</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: 44,
    paddingBottom: 12,
    backgroundColor: PALETTE.headerBg,
  },
  title: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  close: { padding: 4 },
  web: { flex: 1, backgroundColor: '#0f172a' },
  hint: {
    textAlign: 'center',
    fontSize: TYPE.caption,
    color: SLATE[500],
    paddingVertical: 10,
    backgroundColor: '#0f172a',
  },
  pressed: { opacity: 0.7 },
});
