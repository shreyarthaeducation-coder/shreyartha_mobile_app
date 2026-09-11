import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { PARTNER_TERMS, TERMS_TITLE, TERMS_VERSION } from '../../constants/partnerTerms';

/**
 * The Partner Program T&C, full text, scrollable.
 *
 * Ports PartnerTermsModal.js + PartnerTermsContent.js. The web mounts the same content twice — the
 * signup gate and the dashboard header button — so this takes no props beyond visibility.
 *
 * The text comes from constants/partnerTerms.js, extracted from the web by script and verified back
 * word for word. Nothing here reflows or reformats it.
 *
 * No `autoFocus` and no text input anywhere in this sheet: an Android Modal with a focused input is
 * the documented keyboard-dismiss bug, and the signup checkbox lives on the login screen, not here.
 */
export default function PartnerTermsSheet({ visible, onClose }) {
  const styles = useStyles();
  const palette = usePalette();

  return (
    <Modal visible={!!visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>
                {TERMS_TITLE}
              </Text>
              <Text style={styles.version}>Version {TERMS_VERSION}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close terms"
            >
              <Ionicons name="close" size={22} color="#ffffff" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator
            /* The signup gate requires reading this; keep the bounce so it is obvious it scrolls. */
          >
            {PARTNER_TERMS.map((section) => (
              <View key={section.heading} style={styles.section}>
                <Text style={styles.heading}>{section.heading}</Text>

                {section.blocks.map((block, bi) =>
                  block.type === 'p' ? (
                    <Text key={`p-${bi}`} style={styles.paragraph}>
                      {block.text}
                    </Text>
                  ) : (
                    <View key={`ul-${bi}`} style={styles.list}>
                      {block.items.map((item, ii) => (
                        <View key={`li-${ii}`} style={styles.listRow}>
                          <View style={[styles.bullet, { backgroundColor: palette.primary }]} />
                          <Text style={styles.listText}>
                            {item.lead ? <Text style={styles.lead}>{item.lead} </Text> : null}
                            {item.text}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ),
                )}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((p) => ({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: p.headerBg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerText: { flex: 1 },
  title: { color: '#ffffff', fontSize: TYPE.heading, fontWeight: '800', lineHeight: leading(TYPE.heading) },
  version: { color: 'rgba(255,255,255,0.78)', fontSize: TYPE.label, marginTop: 2, fontWeight: '600' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  section: { marginBottom: SPACING.lg },
  heading: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[800], marginBottom: 8 },
  paragraph: { fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body), marginBottom: 8 },
  list: { gap: 8 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7.5 },
  listText: { flex: 1, fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body) },
  lead: { fontWeight: '800', color: SLATE[800] },
}));
