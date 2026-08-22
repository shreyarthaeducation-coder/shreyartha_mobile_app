import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FEEDBACK, PORTALS, SLATE, SPACING } from '../../../constants/theme';
import { FormSheet, GaugeChart, GroupedBars } from '../../ui';
import { fetchExamAnalysis } from '../../../services/teacher/examService';
import { captureAndShare } from '../../../utils/shareCapture';

/**
 * One student's breakdown for one exam.
 *
 * The web offers "Download PDF" via html2canvas + jsPDF on a DOM node; that has no RN equivalent
 * and a phone has no Downloads folder worth targeting, so this shares a PNG through the OS share
 * sheet instead — more useful for sending a report to a parent over WhatsApp.
 *
 * `collapsable={false}` on the captured View is required: without it Android may flatten the
 * wrapper out of the native hierarchy and `captureRef` has nothing to capture.
 */

const PALETTE = PORTALS.school;

function StatTile({ label, value, highlight }) {
  return (
    <View style={[styles.tile, highlight && styles.tileHighlight]}>
      <Text style={[styles.tileValue, highlight && { color: PALETTE.primaryDark }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

export default function ExamAnalysisSheet({ visible, target, onClose, showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const captureRef = useRef(null);

  // Held in a ref, and deliberately NOT in the effect's deps. The parent passes an inline arrow,
  // so `onClose` is a new function on every render — depending on it would re-run the fetch each
  // time, and since the fetch sets state, that is an infinite loop.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const examId = target?.examId;
  const studentId = target?.studentId;

  useEffect(() => {
    if (!visible || !examId || !studentId) return undefined;
    let alive = true;
    setLoading(true);
    setData(null);

    (async () => {
      try {
        const res = await fetchExamAnalysis({ examId, studentId });
        if (alive) setData(res);
      } catch (e) {
        if (alive) {
          showToast?.(e?.message || 'Could not load the analysis.', 'error');
          // The web leaves the modal open and empty here; closing is the honest response.
          onCloseRef.current?.();
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [visible, examId, studentId, showToast]);

  const share = async () => {
    setSharing(true);
    try {
      const ok = await captureAndShare(captureRef, `${target?.examName || 'Exam'} analysis`);
      if (!ok) showToast?.('Sharing is not available on this device.', 'error');
    } catch (e) {
      showToast?.(e?.message || 'Could not share the report.', 'error');
    } finally {
      setSharing(false);
    }
  };

  const marks =
    data?.studentStatus === 'PRESENT' ? (data?.studentMarks ?? '—') : (data?.studentStatus || '—');

  return (
    <FormSheet
      visible={visible}
      title={target?.examName || 'Detailed analysis'}
      subtitle={data?.studentName}
      onClose={onClose}
      headerAction={data ? { icon: 'share-outline', label: 'Share', onPress: share, busy: sharing } : undefined}
      fullHeight
    >
      {loading ? (
        <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
      ) : !data ? null : (
        <View ref={captureRef} collapsable={false} style={styles.capture}>
          <View style={styles.tiles}>
            <StatTile label="Full marks" value={data.fullMarks ?? '—'} />
            <StatTile label={`${data.studentName || 'Student'}'s marks`} value={marks} highlight />
            <StatTile label="Highest" value={data.highestMarks ?? '—'} />
            <StatTile label="Lowest" value={data.lowestMarks ?? '—'} />
            <StatTile label="Took exam" value={data.studentsTookExam ?? '—'} />
          </View>

          {data.studentRemarks ? (
            <View style={styles.remarks}>
              <Text style={styles.remarksLabel}>Teacher remarks</Text>
              <Text style={styles.remarksText}>{data.studentRemarks}</Text>
            </View>
          ) : null}

          <Text style={styles.heading}>Bloom&apos;s taxonomy</Text>
          <GroupedBars
            rows={data.bloomsBreakdown || []}
            emptyMessage="No Bloom's breakdown for this exam."
          />

          <Text style={styles.heading}>Skill set</Text>
          <GroupedBars
            rows={data.skillBreakdown || []}
            emptyMessage="No skill breakdown for this exam."
          />

          {(data.skillBreakdown || []).length > 0 ? (
            <>
              <Text style={styles.heading}>Skill gauges</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.gauges}
              >
                {data.skillBreakdown.map((skill) => (
                  <GaugeChart key={skill.tag} tag={skill.tag} percentage={skill.percentage} />
                ))}
              </ScrollView>
            </>
          ) : null}

          {(data.questionScores || []).length > 0 ? (
            <>
              <Text style={styles.heading}>Question-wise score</Text>
              {data.questionScores.map((q) => {
                const pct =
                  q.maxMarks > 0 ? Math.round((q.marksObtained / q.maxMarks) * 100) : 0;
                return (
                  <View key={q.questionOrder} style={styles.qCard}>
                    <View style={styles.qHead}>
                      <Text style={styles.qIndex}>Q{q.questionOrder}</Text>
                      <Text style={styles.qScore}>
                        {q.marksObtained ?? 0}/{q.maxMarks ?? 0} · {pct}%
                      </Text>
                    </View>
                    <Text style={styles.qText}>{q.questionStatement}</Text>
                    <View style={styles.qMeta}>
                      {[q.chapterName, q.topicName, q.bloomsTaxonomy, q.skillSet]
                        .filter(Boolean)
                        .map((meta) => (
                          <View key={meta} style={styles.qChip}>
                            <Text style={styles.qChipText} numberOfLines={1}>
                              {meta}
                            </Text>
                          </View>
                        ))}
                    </View>
                  </View>
                );
              })}
            </>
          ) : null}
        </View>
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: SPACING.xl },
  capture: { backgroundColor: '#ffffff' },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tile: {
    flexGrow: 1,
    minWidth: '30%',
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tileHighlight: { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary },
  tileValue: { fontSize: 18, fontWeight: '800', color: SLATE[800] },
  tileLabel: { fontSize: 10.5, color: SLATE[500], fontWeight: '600', marginTop: 2, textAlign: 'center' },

  remarks: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    borderRadius: 10,
    backgroundColor: SLATE[50],
  },
  remarksLabel: { fontSize: 11, fontWeight: '700', color: SLATE[500], textTransform: 'uppercase' },
  remarksText: { fontSize: 13, color: SLATE[700], marginTop: 3, lineHeight: 18 },

  heading: {
    fontSize: 12,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  gauges: { gap: SPACING.md, paddingVertical: 4 },

  qCard: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  qHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  qIndex: { flex: 1, fontSize: 12, fontWeight: '800', color: PALETTE.primaryDark },
  qScore: { fontSize: 12, fontWeight: '700', color: SLATE[600] },
  qText: { fontSize: 13, color: SLATE[700], lineHeight: 18 },
  qMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  qChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: SLATE[100] },
  qChipText: { fontSize: 10.5, fontWeight: '600', color: SLATE[500] },
});
