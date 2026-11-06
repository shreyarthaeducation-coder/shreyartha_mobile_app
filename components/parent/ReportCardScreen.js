import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../constants/theme';
import { hueOf } from '../../constants/parentColours';
import { usePalette } from '../ui/PaletteContext';
import { EmptyState, ScreenScaffold, SegmentedTabs, useToast } from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import { fetchReportCard, fetchReportCardYears } from '../../services/parent/testAnalysisService';
import { captureAndShare } from '../../utils/shareCapture';
import { makeStyles } from '../../utils/makeStyles';

/**
 * The child's report card (4 Nov 2026), opened from View Report → Test & Analysis → View Report
 * Card — the website's ParentReportCard on the phone.
 *
 * The website prints the school's own card layout; a phone cannot hold an A4 grid, so this draws the
 * same figures as a parent reads them: each term's subjects with their total and grade, the
 * school's own lines ("Overall Average", "Best of 5"), the co-scholastic grades, and the class
 * teacher's remarks. Share sends it as an image (WhatsApp, Files, print), as the analysis does.
 *
 * Whether there is a card at all is the school's decision, checked on the server on every request:
 * "not shared yet" comes back as the server's own words and is shown as such, not as a failure.
 * A year picker appears when the child has been in more than one year.
 */
export default function ReportCardScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const hue = hueOf('tests');
  const { toast, showToast } = useToast();
  const captureRef = useRef(null);
  const [yearId, setYearId] = useState(null);
  const [sharing, setSharing] = useState(false);

  const fetcher = useCallback(
    async (signal) => {
      const years = await fetchReportCardYears(signal).catch(() => []);
      const list = Array.isArray(years) ? years : [];
      const chosen = yearId ?? list.find((y) => y.current)?.id ?? list[0]?.id ?? null;
      try {
        return { years: list, yearId: chosen, sheet: await fetchReportCard(chosen, signal), message: '' };
      } catch (e) {
        // "Not shared yet" and "not enrolled" are the server's words for an ordinary state.
        return { years: list, yearId: chosen, sheet: null, message: e?.message || 'Could not load the report card.' };
      }
    },
    [yearId],
  );
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher, { initialData: null });

  const sheet = data?.sheet;
  const child = sheet?.students?.[0];

  const share = async () => {
    setSharing(true);
    try {
      const ok = await captureAndShare(captureRef, `Report card — ${child?.studentName || 'student'}`);
      if (!ok) showToast('Sharing is not available on this device.', 'error');
    } catch (e) {
      showToast(e?.message || 'Could not share the report card.', 'error');
    } finally {
      setSharing(false);
    }
  };

  const years = data?.years || [];
  const terms = [...(sheet?.terms || [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const rows = child?.subjectRows || sheet?.subjects || [];
  const hidden = new Set(child?.hiddenGradeFieldIds || []);

  return (
    <ScreenScaffold
      title="Report Card"
      fallbackRoute="/parent/view-report"
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      {years.length > 1 ? (
        <SegmentedTabs
          scrollable
          options={years.map((y) => ({ value: String(y.id), label: y.current ? `${y.yearLabel} (Current)` : y.yearLabel }))}
          value={String(data?.yearId ?? '')}
          onChange={(v) => setYearId(Number(v))}
          style={styles.years}
        />
      ) : null}

      {!child ? (
        <EmptyState icon="ribbon-outline" title="No report card yet" message={data?.message || 'No report card has been shared for your child yet.'} />
      ) : (
        <>
          <Pressable
            onPress={share}
            disabled={sharing}
            style={({ pressed }) => [styles.share, { borderColor: palette.primary }, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="share-outline" size={18} color={palette.primaryDark} />
            <Text style={[styles.shareText, { color: palette.primaryDark }]}>{sharing ? 'Preparing…' : 'Share / Save'}</Text>
          </Pressable>

          <View ref={captureRef} collapsable={false} style={styles.card}>
            <View style={[styles.head, { backgroundColor: hue.bg, borderColor: hue.border }]}>
              {sheet.school?.logoUrl ? <Image source={{ uri: sheet.school.logoUrl }} style={styles.logo} resizeMode="contain" /> : null}
              <View style={styles.headText}>
                <Text style={styles.school} numberOfLines={2}>{sheet.school?.name || ''}</Text>
                <Text style={[styles.kicker, { color: hue.fg }]}>REPORT CARD{sheet.academicYearLabel ? ` · ${sheet.academicYearLabel}` : ''}</Text>
              </View>
            </View>

            <Text style={styles.child}>{child.studentName}</Text>
            <Text style={styles.meta}>
              Class {sheet.className}
              {sheet.sectionName ? `-${sheet.sectionName}` : ''}
              {child.rollNumber ? ` · Roll ${child.rollNumber}` : ''}
              {child.admissionNumber ? ` · Adm. ${child.admissionNumber}` : ''}
            </Text>

            {terms.map((term) => {
              const marks = child.terms?.[term.id] || child.terms?.[String(term.id)] || {};
              const lines = (child.aggregates || []).filter((a) => a.byTerm && (a.byTerm[term.id] ?? a.byTerm[String(term.id)]) != null);
              return (
                <View key={term.id} style={styles.term}>
                  <Text style={[styles.termName, { color: hue.fg }]}>{term.name}</Text>
                  <View style={[styles.tableHead, { borderBottomColor: hue.border }]}>
                    <Text style={[styles.colSubject, styles.th]}>Subject</Text>
                    <Text style={[styles.colNum, styles.th]}>Total</Text>
                    <Text style={[styles.colGrade, styles.th]}>Grade</Text>
                  </View>
                  {rows.map((row) => {
                    const st = marks[row.subjectId] || marks[String(row.subjectId)];
                    return (
                      <View key={`${term.id}-${row.subjectId}-${row.subjectName}`} style={styles.tr}>
                        <Text style={[styles.colSubject, styles.td, row.depth > 0 && styles.indented]} numberOfLines={2}>
                          {row.subjectName}
                        </Text>
                        <Text style={[styles.colNum, styles.td]}>{st?.total ?? '—'}</Text>
                        <Text style={[styles.colGrade, styles.td, styles.grade]}>{st?.grade || '—'}</Text>
                      </View>
                    );
                  })}
                  {lines.map((a) => (
                    <View key={a.label} style={[styles.tr, styles.aggregate]}>
                      <Text style={[styles.colSubject, styles.tdStrong]}>{a.label}</Text>
                      <Text style={[styles.colNum, styles.tdStrong]} numberOfLines={1}>
                        {a.byTerm[term.id] ?? a.byTerm[String(term.id)]}
                      </Text>
                      <Text style={styles.colGrade} />
                    </View>
                  ))}
                </View>
              );
            })}

            {(child.aggregates || []).some((a) => a.overall != null) ? (
              <View style={[styles.overall, { backgroundColor: hue.bg, borderColor: hue.border }]}>
                {child.aggregates.filter((a) => a.overall != null).map((a) => (
                  <View key={`o-${a.label}`} style={styles.overallRow}>
                    <Text style={styles.overallLabel}>{a.overallLabel || a.label}</Text>
                    <Text style={[styles.overallValue, { color: hue.fg }]}>{a.overall}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {(sheet.areas || []).map((group) => {
              const fields = (group.fields || []).filter((f) => !hidden.has(f.id) && (child.grades?.[f.id] ?? child.grades?.[String(f.id)]));
              if (fields.length === 0) return null;
              return (
                <View key={String(group.category)} style={styles.term}>
                  <Text style={[styles.termName, { color: hueOf('learning-activities').fg }]}>
                    {String(group.category || 'Co-scholastic').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                  </Text>
                  {fields.map((f) => (
                    <View key={f.id} style={styles.tr}>
                      <Text style={[styles.colSubject, styles.td]}>{f.name}</Text>
                      <Text style={[styles.colGrade, styles.td, styles.grade]}>{child.grades[f.id] ?? child.grades[String(f.id)]}</Text>
                    </View>
                  ))}
                </View>
              );
            })}

            {child.remarks ? (
              <View style={styles.remarks}>
                <Text style={styles.remarksLabel}>Class teacher&apos;s remarks</Text>
                <Text style={styles.remarksText}>{child.remarks}</Text>
              </View>
            ) : null}
            {child.promotedTo ? <Text style={styles.promoted}>Promoted to {child.promotedTo}</Text> : null}
            {sheet.classTeacher?.name ? <Text style={styles.teacher}>Class teacher: {sheet.classTeacher.name}</Text> : null}
          </View>
        </>
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  years: { marginBottom: SPACING.md },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: SPACING.md,
  },
  shareText: { fontSize: TYPE.heading, fontWeight: '800' },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  logo: { width: 44, height: 44 },
  headText: { flex: 1 },
  school: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[800] },
  kicker: { fontSize: TYPE.micro, fontWeight: '800', letterSpacing: 0.6, marginTop: 2 },
  child: { fontSize: TYPE.title, fontWeight: '800', color: SLATE[800] },
  meta: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2, marginBottom: SPACING.sm },

  term: { marginTop: SPACING.md },
  termName: { fontSize: TYPE.label, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  tableHead: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1.5 },
  th: { fontSize: TYPE.micro, fontWeight: '800', color: SLATE[500], textTransform: 'uppercase' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: SLATE[100] },
  colSubject: { flex: 1, paddingRight: SPACING.sm },
  colNum: { width: 64, textAlign: 'right' },
  colGrade: { width: 56, textAlign: 'right' },
  td: { fontSize: TYPE.body, color: SLATE[700], lineHeight: leading(TYPE.body) },
  tdStrong: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[800] },
  indented: { paddingLeft: SPACING.md, color: SLATE[600] },
  grade: { fontWeight: '800', color: SLATE[800] },
  aggregate: { backgroundColor: SLATE[50] },

  overall: { marginTop: SPACING.md, padding: SPACING.sm, borderRadius: 12, borderWidth: 1 },
  overallRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  overallLabel: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[700] },
  overallValue: { fontSize: TYPE.heading, fontWeight: '800' },

  remarks: { marginTop: SPACING.md, padding: SPACING.sm, borderRadius: 10, backgroundColor: SLATE[50] },
  remarksLabel: { fontSize: TYPE.caption, fontWeight: '800', color: SLATE[500], textTransform: 'uppercase' },
  remarksText: { fontSize: TYPE.body, color: SLATE[700], marginTop: 3, lineHeight: leading(TYPE.body) },
  promoted: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800], marginTop: SPACING.sm },
  teacher: { fontSize: TYPE.caption, color: SLATE[500], marginTop: SPACING.sm },

  pressed: { opacity: 0.8 },
}));
