import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { Select } from '../ui';
import WebReport from './WebReport';

/**
 * "Where I stand" / "Where my child stands" (7 Nov 2026): where the student stands in their class's
 * adaptive assessments, and against the India mark (the top 10,000 need 95.6%).
 *
 * The figures are the server's (AdaptiveStandingService) — the student's own row, the top five by
 * name, the class's figures. The website draws them (/app-report/adaptive-standing) so the app shows
 * what the website shows; the native lines below are the fallback.
 *
 * @param loadSubjects (signal) => [{ subjectId, subjectName }]
 * @param loadStanding (subjectId, topicId, signal) => the standing
 * @param viewer       "student" | "parent"
 * @param portal       the WebReport session: "student" | "parent"
 * @param scroll       true when the caller does not scroll (the parent's View Report tabs)
 */

const pct = (v) => (v == null ? '—' : `${Math.round(Number(v) * 10) / 10}%`);
const signed = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Math.round(Number(v) * 10) / 10}`);
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};
const tagList = (list) => (list?.length ? list.map((r) => `${r.tag} ${pct(r.percent)}`).join(', ') : null);

/** The standing as lines — what shows when the website page cannot draw. */
export function StandingLines({ data, viewer }) {
  const you = viewer === 'parent' ? 'Your child' : 'You';
  const me = data?.me;
  const c = me?.condition || {};
  return (
    <View style={styles.card}>
      <Text style={styles.scope}>
        {[data.className && `${data.className}${data.sectionName ? `-${data.sectionName}` : ''}`, data.subjectName].filter(Boolean).join(' · ')}
        {' · '}
        {data.participants} of {data.rosterSize} took part · class average {pct(data.classAverage)}
      </Text>
      {me ? (
        <>
          <Text style={styles.big}>
            {you}: {pct(me.score)} · {ordinal(me.rank)}
            {me.tied ? '=' : ''} of {data.participants} ({signed(me.vsAverage)})
          </Text>
          <Text style={styles.india}>
            India: to be in the top 10,000 {viewer === 'parent' ? 'a student needs' : 'you need'} {pct(data.india?.cutoff)} —{' '}
            {me.inIndiaTop ? 'there' : `${me.indiaGap} points to go`}
          </Text>
          <Text style={styles.line}>Top skills: {tagList(c.topSkills) || 'none at 75% or more yet'}</Text>
          <Text style={styles.line}>Weak skills: {tagList(c.weakSkills) || 'none below 50%'}</Text>
        </>
      ) : (
        <Text style={styles.line}>{viewer === 'parent' ? 'Your child has' : 'You have'} not finished one here yet.</Text>
      )}
      <Text style={styles.heading}>Top five in the class</Text>
      {(data.top5 || []).length === 0 ? (
        <Text style={styles.line}>Nobody has finished one yet.</Text>
      ) : (
        data.top5.map((t, i) => (
          <Text key={`${t.rank}-${i}`} style={[styles.line, t.me && styles.meLine]}>
            {t.rank}
            {t.tied ? '=' : ''}. {t.name} — {pct(t.score)}
            {t.me ? ` (${you})` : ''}
          </Text>
        ))
      )}
    </View>
  );
}

export default function AdaptiveStandingSection({ loadSubjects, loadStanding, viewer = 'student', portal = 'student', scroll = false }) {
  const [subjects, setSubjects] = useState(null);
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    loadSubjects(controller.signal)
      .then((list) => {
        const rows = Array.isArray(list) ? list : [];
        setSubjects(rows);
        setSubjectId(rows[0] ? String(rows[0].subjectId) : '');
      })
      .catch((e) => {
        if (e?.name === 'AbortError' || e?.name === 'CanceledError') return;
        setSubjects([]);
        setError(e?.message || 'The subjects could not be loaded.');
      });
    return () => controller.abort();
  }, [loadSubjects]);

  const load = useCallback(
    (signal) => {
      if (!subjectId) return;
      setLoading(true);
      setError('');
      loadStanding(subjectId, topicId || null, signal)
        .then(setData)
        .catch((e) => {
          if (e?.name === 'AbortError' || e?.name === 'CanceledError') return;
          setData(null);
          setError(e?.message || 'The standing could not be loaded.');
        })
        .finally(() => setLoading(false));
    },
    [loadStanding, subjectId, topicId],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  let body;
  if (subjects === null) body = <ActivityIndicator style={styles.spinner} />;
  else if (subjects.length === 0) {
    body = (
      <Text style={styles.note}>
        {viewer === 'parent' ? 'Your child has' : 'You have'} not finished an adaptive assessment with a class yet.
      </Text>
    );
  } else {
    body = (
      <>
        <View style={styles.filters}>
          <Select
            variant="chip"
            label="Subject"
            value={subjectId}
            options={subjects.map((s) => ({ value: String(s.subjectId), label: s.subjectName }))}
            onChange={(v) => {
              setSubjectId(v);
              setTopicId('');
            }}
          />
          <Select
            variant="chip"
            label="Topic"
            value={topicId}
            options={[{ value: '', label: 'All topics' }, ...(data?.topics || []).map((t) => ({ value: String(t.id), label: t.name }))]}
            onChange={setTopicId}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator style={styles.spinner} /> : null}
        {data && !loading ? (
          <WebReport
            kind="adaptive-standing"
            portal={portal}
            payload={{ data, viewer }}
            fallback={<StandingLines data={data} viewer={viewer} />}
          />
        ) : null}
      </>
    );
  }

  return scroll ? <ScrollView contentContainerStyle={styles.scroll}>{body}</ScrollView> : <View>{body}</View>;
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl * 3 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  spinner: { marginVertical: SPACING.lg },
  note: { fontSize: TYPE.label, lineHeight: leading(TYPE.label), color: SLATE[600], padding: SPACING.md },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, backgroundColor: FEEDBACK.errorBg, borderRadius: 10, padding: SPACING.sm, marginBottom: SPACING.sm },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: SPACING.md, gap: 6, borderWidth: 1, borderColor: SLATE[200] },
  scope: { fontSize: TYPE.caption, color: SLATE[600] },
  big: { fontSize: TYPE.heading, lineHeight: leading(TYPE.heading), fontWeight: '700', color: SLATE[900] },
  india: { fontSize: TYPE.label, color: '#92400e' },
  heading: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[800], marginTop: SPACING.sm },
  line: { fontSize: TYPE.label, lineHeight: leading(TYPE.label), color: SLATE[700] },
  meLine: { fontWeight: '700', color: SLATE[900] },
});
