import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { makeStyles } from '../../utils/makeStyles';
import { usePalette } from '../ui/PaletteContext';
import { SegmentedTabs } from '../ui';
import PsychometricReport from '../student/psychometric/PsychometricReport';
import { fetchChildReportItems } from '../../services/shared/psychometricReportService';
import { printPsychometricBatch, reshareReportPdf } from '../../utils/psychometricPdf';
import WebReport from '../shared/WebReport';

/**
 * View graphs and Download, inside the parent's psychometric card (2 Nov 2026) — replacing the
 * separate "Print all reports" link above the cards, as on the website.
 *
 * - View graphs works exactly as the teacher's does (components/teacher/StudentPsychometricGraphs):
 *   the child's reports open under the card, one tab per test, drawn by the same component the
 *   student sees, and Hide graphs closes them. Nothing is generated, so they open at once.
 * - Download makes the PDF and hands it to the share sheet (save to Files or Drive, send on
 *   WhatsApp, print). The file is kept, so a second Download skips straight to the share sheet.
 *
 * The reports are fetched and scored when the card appears, so neither button waits for the network.
 */
export default function ParentReportActions() {
  const styles = useStyles();
  const palette = usePalette();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('0');
  const [busy, setBusy] = useState(false);
  const pdfUri = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchChildReportItems(controller.signal)
      .then(setData)
      .catch((e) => {
        if (e?.name !== 'AbortError') setError(e?.message || 'Could not load the reports.');
      });
    return () => controller.abort();
  }, []);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!data) return <ActivityIndicator color={palette.primary} style={styles.loader} />;
  const items = data.items;
  if (items.length === 0) return null;
  const current = items[Number(tab)] || items[0];

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await reshareReportPdf(pdfUri.current)) return;
      const result = await printPsychometricBatch(items);
      pdfUri.current = result?.uri || null;
    } catch (e) {
      Alert.alert('Could not prepare the PDF', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // The website's own card (6 Nov 2026): its View graphs, its graphs and its PDF. What follows is
  // only for when the website cannot be reached.
  const native = (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          style={({ pressed }) => [styles.button, { borderColor: palette.primary }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <Ionicons name={open ? 'chevron-up' : 'stats-chart-outline'} size={16} color={palette.primary} />
          <Text style={[styles.buttonText, { color: palette.primary }]}>{open ? 'Hide graphs' : 'View graphs'}</Text>
        </Pressable>
        <Pressable
          onPress={download}
          disabled={busy}
          style={({ pressed }) => [styles.button, { borderColor: palette.primary }, (pressed || busy) && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ busy }}
        >
          {busy ? (
            <ActivityIndicator color={palette.primary} size="small" />
          ) : (
            <Ionicons name="download-outline" size={16} color={palette.primary} />
          )}
          <Text style={[styles.buttonText, { color: palette.primary }]}>{busy ? 'Preparing…' : 'Download PDF'}</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>
        {items.length} report{items.length === 1 ? '' : 's'} ready
      </Text>

      {open ? (
        <>
          {items.length > 1 ? (
            <SegmentedTabs
              scrollable
              options={items.map((it, i) => ({ value: String(i), label: it.topicName || `Report ${i + 1}` }))}
              value={tab}
              onChange={setTab}
              style={styles.tabs}
            />
          ) : null}
          <PsychometricReport
            key={`${current.topicName}-${tab}`}
            results={current.results}
            topicType={current.topicType}
            topicName={current.topicName}
            studentInfo={current.studentInfo}
          />
        </>
      ) : null}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <WebReport
        kind="psychometric"
        portal="parent"
        payload={{ mode: 'graphs', collapsible: true, students: data.batch }}
        fallback={native}
      />
    </View>
  );
}

// The teacher's View graphs button (StudentPsychometricGraphs), so the two read the same.
const useStyles = makeStyles(() => ({
  wrap: { marginTop: SPACING.md, gap: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.sm },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  buttonText: { fontSize: TYPE.label, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  note: { fontSize: TYPE.caption, color: SLATE[500], lineHeight: leading(TYPE.caption) },
  tabs: { marginBottom: SPACING.xs },
  loader: { marginVertical: SPACING.md },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText },
}));
