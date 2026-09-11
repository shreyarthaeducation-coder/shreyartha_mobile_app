import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { loadPdf } from './lazyPdf';
import { PORTALS, SHADOWS, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { SegmentedTabs } from '../../ui';
import TeachAiPanel from './TeachAiPanel';
import SnipOverlay from './SnipOverlay';
import Model3DModal from './Model3DModal';
import { captureSelection } from '../../../utils/snipCapture';
import { aiErrorText, createAiSession, generate3d } from '../../../services/teacher/aiContentService';

/**
 * Shreyartha AI — the "Teach with AI" resource viewer.
 * Ports frontendmain/src/School/Teacher/pages/SHREYA01/TeachAI/TeacherResourceViewer.js.
 *
 * The web is a two-pane glass screen: document on the left, AI panel on the right. That cannot
 * fit portrait, so the two panes become SegmentedTabs and the app switches to the AI tab by
 * itself the moment a generation lands — the teacher never has to know a tab moved.
 *
 * PDFs render through react-native-pdf, a real native view, so PDF viewing needs the EAS dev
 * client — see ./lazyPdf.js for why the import is deferred rather than top-level. Images render
 * through <Image> and work everywhere, Expo Go included. Both live inside the same
 * `collapsable={false}` wrapper, because that wrapper is what react-native-view-shot captures,
 * and the snip rect is measured in the same coordinate space.
 */

const PALETTE = PORTALS.school;

const TABS = [
  { value: 'doc', label: 'Document', icon: 'document-text-outline' },
  { value: 'ai', label: 'Shreyartha AI', icon: 'sparkles-outline' },
];

const isPdfResource = (resource) =>
  resource?.fileType === 'PDF' || /\.pdf$/i.test(resource?.fileName || '');

export default function ResourceViewerScreen({ resource, onClose, chapterName = '', topicName = '' }) {
  const [tab, setTab] = useState('doc');
  const [snipMode, setSnipMode] = useState(false);

  const [docLoading, setDocLoading] = useState(true);
  const [docError, setDocError] = useState('');

  const [session, setSession] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const [threeDLoading, setThreeDLoading] = useState(false);
  const [threeDModelUrl, setThreeDModelUrl] = useState(null);
  const [models3dVersion, setModels3dVersion] = useState(0);

  const docRef = useRef(null);
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const isPdf = isPdfResource(resource);
  // Resolved on first render, not at import — see ./lazyPdf.js.
  const { Pdf, available: pdfAvailable } = useMemo(() => (isPdf ? loadPdf() : {}), [isPdf]);
  const pdfUnavailable = isPdf && !pdfAvailable;
  // The backend stores the S3 URL unencoded, so a filename with a space breaks both the PDF
  // loader and <Image> — same guard as the resource list's openFile.
  const fileUri = resource?.fileUrl ? encodeURI(resource.fileUrl) : '';

  const busy = aiLoading || threeDLoading;

  /** Shared by Generate and View in 3D — crop first, then branch. */
  const cropSelection = useCallback(
    async (selection) => captureSelection(docRef, selection, layout),
    [layout],
  );

  const handleGenerate = useCallback(
    async (selection, bloomsLevel) => {
      setSnipMode(false);
      setAiError('');

      // Crop BEFORE switching tabs. The hidden pane is opacity:0, and captureRef on a fully
      // transparent view yields a blank bitmap on Android — the snip would silently be empty.
      let file;
      try {
        file = await cropSelection(selection);
      } catch (e) {
        setAiError(e?.message || "We couldn't read that selection. Please try again.");
        setTab('ai');
        return;
      }

      setAiLoading(true);
      setTab('ai');
      try {
        const dto = await createAiSession({
          file,
          resourceId: resource.id,
          bloomsLevel: bloomsLevel || undefined,
          chapterName: chapterName || undefined,
          topicName: topicName || undefined,
        });
        setSession(dto);
      } catch (e) {
        setAiError(aiErrorText(e, "We couldn't read that selection. Please try again."));
      }
      setAiLoading(false);
    },
    [cropSelection, resource?.id, chapterName, topicName],
  );

  const handleView3D = useCallback(
    async (selection) => {
      setSnipMode(false);
      setAiError('');
      setThreeDLoading(true);
      try {
        const file = await cropSelection(selection);
        const res = await generate3d({ file, resourceId: resource.id });
        setThreeDModelUrl(res?.modelUrl || null);
        setModels3dVersion((v) => v + 1); // refresh the saved-models strip
        if (!res?.modelUrl) {
          setAiError('The model was generated but came back without a link.');
          setTab('ai');
        }
      } catch (e) {
        setAiError(aiErrorText(e, "3D generation didn't work. Please try again."));
        setTab('ai');
      }
      setThreeDLoading(false);
    },
    [cropSelection, resource?.id],
  );


  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            📖 {resource?.title || 'My Resource'}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color="#ffffff" />
          </Pressable>
        </View>

        <View style={styles.tabBar}>
          <SegmentedTabs
            options={TABS}
            value={tab}
            onChange={(next) => {
              setTab(next);
              // Leaving the document tab must also leave snip mode, or the overlay comes back
              // armed with a stale selection when the teacher returns.
              if (next !== 'doc') setSnipMode(false);
            }}
          />
        </View>

        {/* Both panes stay mounted. The document must keep its layout while the AI tab is open,
            or the very next snip would capture a zero-sized view. */}
        <View style={styles.body}>
          <View style={[styles.pane, tab !== 'doc' && styles.paneHidden]} pointerEvents={tab === 'doc' ? 'auto' : 'none'}>
            <View
              ref={docRef}
              collapsable={false}
              style={styles.doc}
              onLayout={(e) => setLayout(e.nativeEvent.layout)}
            >
              {pdfUnavailable ? (
                // Expo Go, or any build without the native module. Say so plainly instead of
                // showing an empty grey pane, and still offer the file.
                <View style={styles.unavailable}>
                  <Ionicons name="cloud-download-outline" size={40} color={SLATE[400]} />
                  <Text style={styles.unavailableTitle}>PDF viewing needs the full app build</Text>
                  <Text style={styles.unavailableText}>
                    Shreyartha AI reads PDFs with a component that isn&apos;t available in Expo Go.
                    Install the development build to snip from PDFs — image resources work here
                    already.
                  </Text>
                  <Pressable
                    onPress={() => Linking.openURL(fileUri).catch(() => {})}
                    style={({ pressed }) => [styles.unavailableBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.unavailableBtnText}>Open the file instead</Text>
                  </Pressable>
                </View>
              ) : isPdf ? (
                <Pdf
                  source={{ uri: fileUri, cache: true }}
                  style={styles.pdf}
                  trustAllCerts={false}
                  onLoadComplete={() => setDocLoading(false)}
                  onError={() => {
                    setDocLoading(false);
                    setDocError('Could not load this document. Please try again.');
                  }}
                />
              ) : (
                <Image
                  source={{ uri: fileUri }}
                  style={styles.image}
                  resizeMode="contain"
                  onLoadEnd={() => setDocLoading(false)}
                  onError={() => {
                    setDocLoading(false);
                    setDocError('Could not load this image. Please try again.');
                  }}
                />
              )}
            </View>

            {/* Nothing is loading when the native module is missing — the pane already explains
                itself, and onLoadComplete will never fire to clear this. */}
            {docLoading && !pdfUnavailable ? (
              <View style={styles.docOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color={PALETTE.primary} />
                <Text style={styles.docOverlayText}>Loading document…</Text>
              </View>
            ) : null}
            {docError ? (
              <View style={styles.docOverlay} pointerEvents="none">
                <Text style={styles.docError}>{docError}</Text>
              </View>
            ) : null}

            {snipMode && !docLoading && !docError && !pdfUnavailable ? (
              <SnipOverlay
                layout={layout}
                busy={busy}
                onGenerate={handleGenerate}
                onView3D={handleView3D}
              />
            ) : null}

            {/* No document rendered means nothing to snip from — hide the affordance entirely
                rather than offering a disabled button with no explanation. */}
            {pdfUnavailable ? null : (
              <Pressable
                onPress={() => setSnipMode((s) => !s)}
                disabled={docLoading || !!docError || busy}
                style={({ pressed }) => [
                  styles.fab,
                  snipMode && styles.fabActive,
                  (docLoading || !!docError || busy) && styles.fabDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  snipMode ? 'Exit selection mode' : 'Select a part of the document'
                }
              >
                <Ionicons
                  name={snipMode ? 'close' : 'search'}
                  size={22}
                  color={snipMode ? PALETTE.primaryDark : '#ffffff'}
                />
              </Pressable>
            )}
          </View>

          <View style={[styles.pane, tab !== 'ai' && styles.paneHidden]} pointerEvents={tab === 'ai' ? 'auto' : 'none'}>
            <TeachAiPanel
              resource={resource}
              session={session}
              setSession={setSession}
              loading={aiLoading}
              error={aiError}
              onView3D={(url) => setThreeDModelUrl(url)}
              models3dVersion={models3dVersion}
            />
          </View>
        </View>

        {threeDLoading ? (
          <View style={styles.blockingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.blockingText}>Generating 3D model…</Text>
            <Text style={styles.blockingSub}>this takes about 10–30 seconds</Text>
          </View>
        ) : null}

        {threeDModelUrl ? (
          <Model3DModal
            modelUrl={threeDModelUrl}
            title={resource?.title || '3D Model'}
            onClose={() => setThreeDModelUrl(null)}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.headerBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: PALETTE.headerBg,
  },
  headerTitle: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  close: { padding: 4 },

  tabBar: { padding: SPACING.sm, backgroundColor: SLATE[50] },

  body: { flex: 1, backgroundColor: SLATE[50] },
  pane: { ...StyleSheet.absoluteFillObject },
  // Kept mounted but out of sight — unmounting would drop the PDF's render and the doc layout.
  paneHidden: { opacity: 0, zIndex: -1 },

  doc: { flex: 1, backgroundColor: SLATE[200] },
  pdf: { flex: 1, width: '100%', backgroundColor: SLATE[200] },
  image: { flex: 1, width: '100%' },

  docOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  docOverlayText: { fontSize: TYPE.body, color: SLATE[600] },

  unavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: SLATE[50],
  },
  unavailableTitle: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[700], textAlign: 'center' },
  unavailableText: { fontSize: TYPE.body, lineHeight: leading(TYPE.body), color: SLATE[500], textAlign: 'center' },
  unavailableBtn: {
    marginTop: SPACING.sm,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: PALETTE.primaryDark,
  },
  unavailableBtnText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },

  docError: { fontSize: TYPE.body, color: SLATE[700], textAlign: 'center', paddingHorizontal: SPACING.lg },

  fab: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.primaryDark,
    ...SHADOWS.lg,
  },
  fabActive: { backgroundColor: '#ffffff' },
  fabDisabled: { backgroundColor: SLATE[400] },

  blockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.72)',
  },
  blockingText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  blockingSub: { fontSize: TYPE.label, color: 'rgba(255,255,255,0.75)' },
  pressed: { opacity: 0.78 },
});
