import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { FormSheet, Select, useToast } from '../../ui';
import { LineChart } from '../../ui/charts';
import { usePalette } from '../../ui/PaletteContext';
import StudentScaffold from '../StudentScaffold';
import { StudentCard, StudentCardTitle, StudentNote } from '../StudentCard';
import AdaptiveReportBody from '../../shared/AdaptiveReportBody';
import { fetchMyAdaptiveAttempts, fetchUniversalReport } from '../../../services/student/academicIqService';

/**
 * My Adaptive Performance — the website's page of the same name (22 Oct 2026): every adaptive test
 * the student has taken, on their own (Practice Zone, School Resources) or in a teacher's Live Test
 * Room, with marks, accuracy, the level reached, the place in class and the time taken; subject and
 * topic filters; accuracy over time; and each test's full report.
 */

export const LEVEL_LABEL = { BASIC: 'Basic', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' };

/** 0:00 style — minutes and seconds, or hours when it ran that long. */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}h ${m}m` : `${m}m ${String(r).padStart(2, '0')}s`;
}

const pct = (v) => (v == null ? '—' : `${Math.round(Number(v))}%`);
const day = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Totals over the attempts shown — the website's `summarize`. */
export function summarize(attempts) {
  const done = attempts.filter((a) => (a.totalAnswered || 0) > 0);
  const accuracies = done.map((a) => Number(a.accuracy) || 0);
  return {
    tests: attempts.length,
    average: accuracies.length ? accuracies.reduce((x, y) => x + y, 0) / accuracies.length : null,
    best: accuracies.length ? Math.max(...accuracies) : null,
    topics: new Set(attempts.map((a) => a.topicId)).size,
    live: attempts.filter((a) => a.roomId != null).length,
  };
}

export default function MyAdaptivePerformanceScreen() {
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const [attempts, setAttempts] = useState(null);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [open, setOpen] = useState(null); // { attempt, report?, error? }

  const load = useCallback(() => {
    setError('');
    fetchMyAdaptiveAttempts()
      .then(setAttempts)
      .catch((e) => {
        setAttempts([]);
        setError(e?.message || 'Your adaptive tests could not be loaded.');
      });
  }, []);

  useEffect(load, [load]);

  const all = useMemo(() => attempts || [], [attempts]);
  const subjects = useMemo(() => [...new Set(all.map((a) => a.subjectName).filter(Boolean))].sort(), [all]);
  const topics = useMemo(() => {
    const seen = new Map();
    all.filter((a) => !subject || a.subjectName === subject).forEach((a) => seen.set(String(a.topicId), a.topicName));
    return [...seen.entries()].sort((x, y) => String(x[1]).localeCompare(String(y[1])));
  }, [all, subject]);
  const shown = useMemo(
    () => all.filter((a) => (!subject || a.subjectName === subject) && (!topic || String(a.topicId) === topic)),
    [all, subject, topic],
  );
  const stats = summarize(shown);
  // Oldest first for the trend; the list stays newest first, as the server sends it.
  const trend = useMemo(() => [...shown].filter((a) => (a.totalAnswered || 0) > 0).reverse(), [shown]);

  const openReport = async (a) => {
    setOpen({ attempt: a });
    try {
      setOpen({ attempt: a, report: await fetchUniversalReport(a.attemptId) });
    } catch (e) {
      setOpen({ attempt: a, error: e?.message || 'This report could not be loaded.' });
      showToast(e?.message || 'This report could not be loaded.', 'error');
    }
  };

  return (
    <StudentScaffold
      title="My Adaptive Performance"
      fallbackRoute="/student/academic-iq"
      loading={attempts === null}
      error={error && !all.length ? error : ''}
      onRetry={load}
      toast={toast}
    >
      {all.length === 0 ? (
        <StudentCard>
          <StudentNote>
            No adaptive tests yet. Take one from Practice Zone or a topic in School Resources, and it appears here.
          </StudentNote>
        </StudentCard>
      ) : (
        <>
          <View style={styles.filters}>
            <Select
              variant="chip"
              label="Subject"
              value={subject}
              options={[{ value: '', label: 'All subjects' }, ...subjects.map((s) => ({ value: s, label: s }))]}
              onChange={(v) => {
                setSubject(v);
                setTopic('');
              }}
            />
            <Select
              variant="chip"
              label="Topic"
              value={topic}
              options={[{ value: '', label: 'All topics' }, ...topics.map(([id, name]) => ({ value: id, label: name }))]}
              onChange={setTopic}
            />
          </View>

          <View style={styles.tiles}>
            {[
              [stats.tests, 'Tests taken'],
              [pct(stats.average), 'Average accuracy'],
              [pct(stats.best), 'Best accuracy'],
              [stats.topics, 'Topics'],
              [stats.live, 'In live tests'],
            ].map(([value, label]) => (
              <View key={label} style={styles.tile}>
                <Text style={[styles.tileValue, { color: palette.deep }]}>{value}</Text>
                <Text style={styles.tileLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {trend.length > 1 ? (
            <StudentCard>
              <StudentCardTitle>Accuracy over time</StudentCardTitle>
              <LineChart
                data={trend.map((a) => ({ label: day(a.finishedAt || a.startedAt).split(' ').slice(0, 2).join(' '), value: Number(a.accuracy) || 0 }))}
                height={180}
              />
            </StudentCard>
          ) : null}

          <StudentCard>
            <StudentCardTitle>Your adaptive tests</StudentCardTitle>
            {shown.map((a) => (
              <View key={a.attemptId} style={styles.row}>
                <View style={styles.rowHead}>
                  <Text style={styles.topicName} numberOfLines={2}>
                    {a.topicName}
                  </Text>
                  <Text style={styles.accuracy}>{pct(a.accuracy)}</Text>
                </View>
                <Text style={styles.meta}>
                  {[day(a.finishedAt || a.startedAt), a.subjectName].filter(Boolean).join(' · ')}
                </Text>
                <View style={styles.badges}>
                  {a.roomId != null ? <Text style={[styles.badge, styles.badgeLive]}>Live test</Text> : null}
                  {a.stoppedEarly ? <Text style={styles.badge}>Stopped early</Text> : null}
                </View>
                <Text style={styles.meta}>
                  Marks {a.correctCount ?? 0} / {a.totalAnswered ?? 0} · Level {LEVEL_LABEL[a.finalLevel] || '—'} · Rank{' '}
                  {a.rank ? `${a.rank} of ${a.totalParticipants}` : '—'} · {formatDuration(a.activeSeconds || a.durationSeconds)}
                </Text>
                <Pressable
                  onPress={() => openReport(a)}
                  disabled={!a.totalAnswered}
                  style={({ pressed }) => [styles.link, !a.totalAnswered && styles.disabled, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.linkText, { color: palette.deep }]}>View report</Text>
                </Pressable>
              </View>
            ))}
          </StudentCard>
        </>
      )}

      <FormSheet
        visible={!!open}
        title={open?.attempt?.topicName || 'Report'}
        subtitle={open ? [open.attempt.subjectName, day(open.attempt.finishedAt || open.attempt.startedAt)].filter(Boolean).join(' · ') : ''}
        onClose={() => setOpen(null)}
        fullHeight
      >
        {open?.report ? (
          <AdaptiveReportBody report={open.report} />
        ) : open?.error ? (
          <Text style={styles.meta}>{open.error}</Text>
        ) : (
          <ActivityIndicator color={palette.primary} style={styles.loader} />
        )}
      </FormSheet>
    </StudentScaffold>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  tile: {
    flexGrow: 1,
    minWidth: 96,
    backgroundColor: SLATE[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  tileValue: { fontSize: TYPE.title, fontWeight: '700' },
  tileLabel: { fontSize: TYPE.caption, color: SLATE[500] },
  row: { borderTopWidth: 1, borderTopColor: SLATE[100], paddingVertical: SPACING.sm, gap: 3 },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  topicName: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  accuracy: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  meta: { fontSize: TYPE.caption, color: SLATE[600] },
  badges: { flexDirection: 'row', gap: 6 },
  badge: {
    fontSize: TYPE.micro,
    fontWeight: '700',
    color: SLATE[600],
    backgroundColor: SLATE[100],
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  badgeLive: { color: FEEDBACK.warningText, backgroundColor: FEEDBACK.warningBg },
  link: { alignSelf: 'flex-start', paddingVertical: 4 },
  linkText: { fontSize: TYPE.label, fontWeight: '700' },
  loader: { marginVertical: SPACING.lg },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.72 },
});
