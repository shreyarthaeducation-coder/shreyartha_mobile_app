import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { PORTALS, SPACING } from '../../../constants/theme';
import { FormSheet } from '../../ui';
import AdaptiveReportBody from '../../shared/AdaptiveReportBody';
import { fetchAttemptAnalysis } from '../../../services/teacher/adaptiveService';
import { captureAndShare } from '../../../utils/shareCapture';

/**
 * One student's adaptive-assessment report, as a teacher sees it.
 *
 * This is now only the shell — the modal, the fetch by `attemptId`, and the share button. The
 * report itself lives in `components/shared/AdaptiveReportBody`, because the STUDENT sees the same
 * analysis over the same DTO (`UniversalAdaptiveAnalysisResponse`) and the website shares one
 * component here too. Two renderers over one DTO is how this codebase ended up with three
 * near-identical Bloom's remark tables.
 *
 * This screen sits OUTSIDE a PaletteProvider, so the body's `usePalette()` falls back to
 * `PORTALS.school` and it renders exactly as it did before the extraction.
 */

const PALETTE = PORTALS.school;

export default function AdaptiveReport({ visible, attempt, onClose, showToast }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const captureRef = useRef(null);

  // Kept out of the effect's deps on purpose — the parent passes an inline arrow, so depending on
  // `onClose` would re-run the fetch every render and loop forever.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const attemptId = attempt?.attemptId;

  useEffect(() => {
    if (!visible || !attemptId) return undefined;
    let alive = true;
    setLoading(true);
    setReport(null);

    (async () => {
      try {
        const res = await fetchAttemptAnalysis(attemptId);
        if (alive) setReport(res);
      } catch (e) {
        if (alive) {
          showToast?.(e?.message || 'Could not load the analysis.', 'error');
          onCloseRef.current?.();
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [visible, attemptId, showToast]);

  const share = async () => {
    setSharing(true);
    try {
      const ok = await captureAndShare(captureRef, `${report?.topicName || 'Adaptive'} report`);
      if (!ok) showToast?.('Sharing is not available on this device.', 'error');
    } catch (e) {
      showToast?.(e?.message || 'Could not share the report.', 'error');
    } finally {
      setSharing(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title={attempt?.topicName || 'Adaptive assessment'}
      subtitle={report?.studentName}
      onClose={onClose}
      headerAction={
        report ? { icon: 'share-outline', label: 'Share', onPress: share, busy: sharing } : undefined
      }
      fullHeight
    >
      {loading ? (
        <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
      ) : !report ? null : (
        // An opaque ground for the screenshot — captureRef over a transparent view produces a
        // bitmap with whatever happened to be behind it.
        <View ref={captureRef} collapsable={false} style={styles.capture}>
          <AdaptiveReportBody report={report} />
        </View>
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: SPACING.xl },
  capture: { backgroundColor: '#ffffff' },
});
