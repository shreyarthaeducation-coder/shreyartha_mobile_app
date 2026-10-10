import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TINTS, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { EmptyState, ScreenScaffold } from '../ui';
import { fetchStudentStatusScope, fetchStudentStatusTable } from '../../services/staff/studentStatusService';
import { LEGEND, STATES, findSection, flattenScope, parentNode, searchableRows, summaryText } from '../../utils/studentStatus';
import { useStudentSearch } from '../../utils/studentSearch';
import { useDrillBack } from '../../hooks/useDrillBack';
import StudentSearchBar from './shared/StudentSearchBar';
import { makeStyles } from '../../utils/makeStyles';

/** How a cell of each state is painted. */
const STATE_STYLE = {
  DONE: { bg: TINTS.green.bg, fg: TINTS.green.fg },
  PARTIAL: { bg: '#fef9c3', fg: '#854d0e' },
  NONE: { bg: SLATE[50], fg: SLATE[600] },
  LOCKED: { bg: SLATE[200], fg: SLATE[700] },
  CLOSED: { bg: SLATE[100], fg: SLATE[500] },
  NA: { bg: 'transparent', fg: SLATE[400] },
};

/**
 * Student Status (10 Oct 2026) — the app's twin of the website's page: a section's students against
 * everything the platform records, from the overview down to a single topic.
 *
 * On a phone a wide table does not fit, so the columns sit in a strip at the top (each with how
 * much of the section is done, and ▸ when it opens a level deeper) and every student is a card with
 * one line per column. The phone's back button, like "Up one level", climbs one level.
 */
export default function StudentStatusScreen({ homeRoute = '/teacher' }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const [scope, setScope] = useState(null);
  const [scopeError, setScopeError] = useState('');
  const [schoolCode, setSchoolCode] = useState(null);
  const [classId, setClassId] = useState(null);
  const [sectionId, setSectionId] = useState(null);
  const [node, setNode] = useState('overview');
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchStudentStatusScope(controller.signal)
      .then((res) => {
        const schools = flattenScope(res);
        setScope(schools);
        if (schools.length > 0) setSchoolCode(schools[0].schoolCode);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setScopeError(e?.message || 'Could not load your classes.');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!sectionId) {
      setTable(null);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetchStudentStatusTable(sectionId, node, controller.signal)
      .then((res) => setTable(res))
      .catch((e) => {
        if (controller.signal.aborted) return;
        setTable(null);
        setError(e?.message || 'Could not load this section.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [sectionId, node, reload]);

  const school = useMemo(() => (scope || []).find((s) => s.schoolCode === schoolCode) || null, [scope, schoolCode]);
  const cls = useMemo(() => (school?.classes || []).find((c) => c.classId === classId) || null, [school, classId]);
  const rows = useMemo(() => searchableRows(table), [table]);
  const studentSearch = useStudentSearch(rows);
  const summaries = useMemo(() => {
    const out = {};
    (table?.summary || []).forEach((s) => {
      out[s.key] = s;
    });
    return out;
  }, [table]);

  const depth = table ? Math.max(0, (table.path?.length || 1) - 1) : 0;
  const up = useCallback(() => {
    const parent = parentNode(table);
    if (parent) setNode(parent);
  }, [table]);
  useDrillBack(depth, up);

  const chooseSection = (id) => {
    const found = findSection(scope, id);
    if (found) setClassId(found.cls.classId);
    setSectionId(id);
    setNode('overview');
  };

  return (
    <ScreenScaffold
      title="Student Status"
      fallbackRoute={homeRoute}
      refreshing={loading && !!table}
      onRefresh={sectionId ? () => setReload((n) => n + 1) : undefined}
      scroll
    >
      <Text style={styles.intro}>
        How far each student has got. Choose a section, then tap a column marked ▸ to go a level deeper.
      </Text>

      {scopeError ? <Text style={styles.error} accessibilityRole="alert">{scopeError}</Text> : null}
      {!scope && !scopeError ? <ActivityIndicator color={PALETTE.primary} style={styles.loader} /> : null}
      {scope && scope.length === 0 ? (
        <EmptyState icon="people-outline" title="No classes" message="You have no classes to look at yet." />
      ) : null}

      {scope && scope.length > 1 ? (
        <Chips
          label="School"
          items={scope.map((s) => ({ key: s.schoolCode, text: s.schoolName }))}
          value={schoolCode}
          onChange={(code) => {
            setSchoolCode(code);
            setClassId(null);
          }}
        />
      ) : null}
      {school ? (
        <Chips
          label="Class"
          items={school.classes.map((c) => ({ key: c.classId, text: /^\d/.test(String(c.className)) ? `Class ${c.className}` : c.className }))}
          value={classId}
          onChange={setClassId}
        />
      ) : null}
      {cls ? (
        <Chips
          label="Section"
          items={cls.sections.map((s) => ({ key: s.sectionId, text: `Section ${s.sectionName}` }))}
          value={sectionId}
          onChange={chooseSection}
        />
      ) : null}

      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {loading && !table ? <ActivityIndicator color={PALETTE.primary} style={styles.loader} /> : null}

      {table ? (
        <>
          <View style={styles.crumbs} accessibilityLabel="Where you are">
            {table.path.map((crumb, i) => {
              const last = i === table.path.length - 1;
              return (
                <View key={crumb.node} style={styles.crumbItem}>
                  {i > 0 ? <Text style={styles.crumbSep}>›</Text> : null}
                  {last ? (
                    <Text style={styles.crumbHere}>{crumb.label}</Text>
                  ) : (
                    <Pressable onPress={() => setNode(crumb.node)} hitSlop={6} accessibilityRole="link">
                      <Text style={[styles.crumbLink, { color: PALETTE.primaryDark }]}>{crumb.label}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
          <Text style={styles.context}>
            {table.className} · Section {table.sectionName} · {table.students.length} students
          </Text>
          {depth > 0 ? (
            <Pressable onPress={up} style={styles.upBtn} accessibilityRole="button">
              <Ionicons name="arrow-up" size={16} color={SLATE[700]} />
              <Text style={styles.upText}>Up one level</Text>
            </Pressable>
          ) : null}

          {(table.notes || []).map((note) => (
            <Text key={note} style={styles.note}>{note}</Text>
          ))}

          {table.columns.length > 0 ? (
            <View style={styles.columns}>
              {table.columns.map((c) => (
                <Pressable
                  key={c.key}
                  disabled={!c.drill}
                  onPress={() => setNode(c.node)}
                  style={({ pressed }) => [styles.column, c.drill && { borderColor: PALETTE.primary }, pressed && styles.pressed]}
                  accessibilityRole={c.drill ? 'button' : 'text'}
                  accessibilityLabel={`${c.label}, ${summaryText(summaries[c.key])}${c.drill ? ', opens a level deeper' : ''}`}
                >
                  <Text style={[styles.columnLabel, c.drill && { color: PALETTE.primaryDark }]} numberOfLines={2}>
                    {c.label}{c.drill ? ' ▸' : ''}
                  </Text>
                  <Text style={styles.columnSummary}>{summaryText(summaries[c.key])}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>Nothing to show at this level yet.</Text>
          )}

          <View style={styles.legend}>
            {LEGEND.map((state) => (
              <View key={state} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATE_STYLE[state].bg }]} />
                <Text style={styles.legendText}>{STATES[state]}</Text>
              </View>
            ))}
          </View>

          {table.students.length === 0 ? (
            <EmptyState icon="people-outline" title="No students" message="No students in this section yet." />
          ) : (
            <>
              <StudentSearchBar search={studentSearch} />
              {studentSearch.results.map((row) => (
                <View key={row.studentId} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.roll}>{row.rollNumber || '—'}</Text>
                    <Text style={styles.name}>{row.name}</Text>
                  </View>
                  {table.columns.map((c) => {
                    const cell = row.cells?.[c.key];
                    const look = STATE_STYLE[cell?.state] || STATE_STYLE.NA;
                    return (
                      <View key={c.key} style={styles.cellRow}>
                        <Text style={styles.cellLabel} numberOfLines={2}>{c.label}</Text>
                        <View
                          style={[styles.cellValue, { backgroundColor: look.bg }]}
                          accessibilityLabel={`${c.label}: ${cell?.text || '—'}${cell?.sub ? `, ${cell.sub}` : ''}, ${STATES[cell?.state] || ''}`}
                        >
                          <Text style={[styles.cellText, { color: look.fg }]}>{cell?.text || '—'}</Text>
                          {cell?.sub ? <Text style={styles.cellSub}>{cell.sub}</Text> : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </>
          )}
        </>
      ) : null}
    </ScreenScaffold>
  );
}

/** A labelled row of choices that scrolls sideways. */
function Chips({ label, items, value, onChange }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  return (
    <View style={styles.chipsWrap}>
      <Text style={styles.chipsLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {items.map((item) => {
          const on = item.key === value;
          return (
            <Pressable
              key={item.key}
              onPress={() => onChange(item.key)}
              style={[styles.chip, on && { backgroundColor: PALETTE.primary, borderColor: PALETTE.primary }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.text}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  intro: { fontSize: TYPE.label, color: SLATE[600], lineHeight: leading(TYPE.label), marginBottom: SPACING.md },
  loader: { marginVertical: SPACING.lg },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, backgroundColor: FEEDBACK.errorBg, borderRadius: 8, padding: SPACING.sm, marginVertical: SPACING.sm },
  chipsWrap: { marginBottom: SPACING.sm },
  chipsLabel: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[500], marginBottom: 4 },
  chips: { gap: SPACING.sm, paddingRight: SPACING.md },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: SLATE[300], backgroundColor: '#fff', minHeight: 40, justifyContent: 'center' },
  chipText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[800] },
  chipTextOn: { color: '#fff' },
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: SPACING.sm },
  crumbItem: { flexDirection: 'row', alignItems: 'center' },
  crumbSep: { color: SLATE[400], marginHorizontal: 4, fontSize: TYPE.label },
  crumbLink: { fontSize: TYPE.label, fontWeight: '600', textDecorationLine: 'underline' },
  crumbHere: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[800] },
  context: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 4 },
  upBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: SPACING.sm, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: SLATE[100], minHeight: 40 },
  upText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[700] },
  note: { fontSize: TYPE.label, color: '#92400e', backgroundColor: '#fffbeb', borderRadius: 8, padding: SPACING.sm, marginTop: SPACING.sm },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  column: { width: '48%', borderWidth: 1, borderColor: SLATE[200], borderRadius: 10, padding: SPACING.sm, backgroundColor: '#fff' },
  columnLabel: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[800] },
  columnSummary: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginVertical: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 3, borderWidth: 1, borderColor: SLATE[300] },
  legendText: { fontSize: TYPE.caption, color: SLATE[600] },
  muted: { fontSize: TYPE.label, color: SLATE[500], marginVertical: SPACING.md },
  card: { borderWidth: 1, borderColor: SLATE[200], borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.sm, backgroundColor: '#fff' },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm, marginBottom: 6 },
  roll: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[500], minWidth: 24 },
  name: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  cellRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 5, borderTopWidth: 1, borderTopColor: SLATE[100] },
  cellLabel: { flex: 1, fontSize: TYPE.label, color: SLATE[700] },
  cellValue: { maxWidth: '55%', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, alignItems: 'flex-end' },
  cellText: { fontSize: TYPE.label, fontWeight: '700' },
  cellSub: { fontSize: TYPE.caption, color: SLATE[600], textAlign: 'right' },
  pressed: { opacity: 0.72 },
}));
