import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BAND, DONE, FEEDBACK, INK, SLATE, SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { CalendarGrid, EmptyState, MonthNavigator, useToast } from '../../ui';
import StudentScaffold from '../StudentScaffold';
import { StudentCard, StudentCardTitle, StudentNote } from '../StudentCard';
import { useTranslations } from '../../../hooks/useTranslations';
import {
  dateKey,
  fetchPersonalisedResources,
  groupByDate,
  setResourceCompleted,
  typeMeta,
} from '../../../services/student/personalisedResourceService';

/**
 * Personalised Resources — the material a teacher assigned to this student individually.
 *
 * ── THIS IS THE FEATURE THAT WAS MISSING ────────────────────────────────────
 * The bug report said personalised resources "was not fetching properly". It was never built. The
 * app had the OTHER endpoint — `/api/students/personali**z**ed-resources`, the student's own
 * Academic IQ tree — wired into the Academic IQ hub and working correctly, and the one-letter
 * difference is why the two were confused for each other. See the header of
 * services/student/personalisedResourceService.js.
 *
 * ── THE CALENDAR IS NOT DECORATION ──────────────────────────────────────────
 * Every row carries an `assignedDate`, and the question a student actually asks is "what was set
 * for me this week", not "what is in my list". The website leads with the month grid for that
 * reason and so does this. Tapping a day filters; tapping it again, or Show All, clears.
 */

const STRINGS = {
  // "Teacher-Assigned", not "Personalised" — see the note in constants/studentMenu.js. The Academic
  // IQ hub's own card is now called "Personalised Resources" (matching the website) and reads the
  // OTHER endpoint, so this screen carries the name that distinguishes them. File name, route and
  // endpoint are deliberately untouched: checkresources.mjs pins the `personali_s_ed` spelling.
  title: 'Teacher-Assigned Resources',
  intro: 'Material your teacher picked out for you, on the day it was set.',
  legend: 'Resources assigned',
  all: 'All resources',
  showAll: 'Show all',
  emptyTitle: 'Nothing assigned yet',
  emptyBody:
    'When a teacher assigns something to you personally it will appear here, on the day they set it.',
  emptyDay: 'Nothing was assigned on this day.',
  forbidden: 'Personalised resources are available on school student accounts.',
  watch: 'Watch',
  view: 'Open',
  done: 'Completed',
};

export default function PersonalisedResourcesScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const t = useTranslations(STRINGS);

  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const [selected, setSelected] = useState(null);

  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setResources(await fetchPersonalisedResources());
    } catch (e) {
      // A 403 is the server's role rule, not a failure — say which, because "try again" will never
      // help a college student and the retry button would be a lie.
      setError(e?.isForbidden ? STRINGS.forbidden : e?.message || 'Could not load your resources.');
      setResources([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byDate = useMemo(() => groupByDate(resources), [resources]);

  /** The month's days as `YYYY-MM-DD`, which is the shape CalendarGrid takes. */
  const monthDates = useMemo(() => {
    const { year, month } = view;
    const days = new Date(year, month, 0).getDate();
    return Array.from({ length: days }, (_, i) => dateKey(new Date(year, month - 1, i + 1)));
  }, [view]);

  const visible = selected ? byDate[selected] || [] : resources;
  const todayKey = dateKey(today);

  const toggle = async (resource) => {
    setBusyId(resource.id);
    try {
      const updated = await setResourceCompleted(resource.id, !resource.completed);
      // Merge the SERVER's answer rather than flipping the local flag: `completedAt` is a real
      // timestamp the card shows, and only the server knows it.
      setResources((prev) =>
        prev.map((r) =>
          r.id === resource.id
            ? { ...r, completed: updated?.completed ?? !r.completed, completedAt: updated?.completedAt }
            : r,
        ),
      );
    } catch (e) {
      showToast(e?.message || 'Could not update that just now.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const open = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => showToast('Could not open that link.', 'error'));
  };

  return (
    <StudentScaffold
      title={t.title}
      loading={loading}
      error={error}
      // No retry on a 403 — the answer would not change.
      onRetry={error && error !== STRINGS.forbidden ? load : undefined}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      toast={toast}
    >
      <Text style={styles.intro}>{t.intro}</Text>

      <StudentCard>
        <MonthNavigator
          year={view.year}
          month={view.month}
          onChange={(next) => {
            setView(next);
            // A selection from another month would filter the list to nothing while the grid shows
            // no highlighted day — the state and the view would disagree.
            setSelected(null);
          }}
        />

        <CalendarGrid
          dates={monthDates}
          selectedDate={selected}
          onDayPress={(d) => setSelected((prev) => (prev === d ? null : d))}
          getDay={(d) => ({
            dot: byDate[d] ? palette.primary : undefined,
            bold: d === todayKey,
            borderColor: d === todayKey ? palette.primary : undefined,
          })}
        />

        <View style={styles.legend}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>{t.legend}</Text>
        </View>
      </StudentCard>

      <View style={styles.listHead}>
        <StudentCardTitle style={styles.listTitle}>
          {selected ? formatDay(selected) : t.all}
        </StudentCardTitle>
        {selected ? (
          <Pressable onPress={() => setSelected(null)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.showAll}>{t.showAll}</Text>
          </Pressable>
        ) : null}
      </View>

      {visible.length === 0 ? (
        selected ? (
          <StudentCard>
            <StudentNote>{t.emptyDay}</StudentNote>
          </StudentCard>
        ) : (
          <EmptyState icon="locate-outline" title={t.emptyTitle} message={t.emptyBody} />
        )
      ) : (
        visible.map((r) => {
          const meta = typeMeta(r.resourceType);
          const url = r.fileUrl || r.linkUrl;
          const isNote = r.resourceType === 'NOTE';
          return (
            <StudentCard key={r.id} style={r.completed && styles.cardDone}>
              <View style={styles.rowTop}>
                <View style={styles.typeChip}>
                  <Ionicons name={meta.icon} size={15} color={palette.primary} />
                  <Text style={styles.typeText}>{meta.label}</Text>
                </View>

                {r.learningGapLevel ? (
                  <View style={styles.gap}>
                    <Text style={styles.gapText}>{r.learningGapLevel}</Text>
                  </View>
                ) : null}

                <View style={styles.spacer} />

                <Pressable
                  onPress={() => toggle(r)}
                  disabled={busyId === r.id}
                  style={({ pressed }) => [
                    styles.tick,
                    r.completed && styles.tickOn,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!r.completed }}
                  accessibilityLabel={r.completed ? 'Mark as not done' : 'Mark as done'}
                >
                  {busyId === r.id ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={r.completed ? '#ffffff' : SLATE[600]}
                    />
                  )}
                </Pressable>
              </View>

              <Text style={styles.title}>{r.title}</Text>

              {/* A NOTE has no file and no link — its `description` IS the resource, so it is shown
                  as the body rather than as a subtitle above a button that would do nothing. */}
              {r.description ? (
                <Text style={[styles.body, isNote && styles.note]}>{r.description}</Text>
              ) : null}

              <View style={styles.meta}>
                {r.subjectName ? <Text style={styles.metaText}>{r.subjectName}</Text> : null}
                {r.teacherName ? <Text style={styles.metaText}>· {r.teacherName}</Text> : null}
                {r.completed ? <Text style={styles.doneText}>· {t.done}</Text> : null}
              </View>

              {url && !isNote ? (
                <Pressable
                  onPress={() => open(url)}
                  style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={r.resourceType === 'VIDEO' ? 'play' : 'open-outline'}
                    size={16}
                    color={palette.onPrimary}
                  />
                  <Text style={styles.actionText}>
                    {r.resourceType === 'VIDEO' ? t.watch : t.view}
                  </Text>
                </Pressable>
              ) : null}
            </StudentCard>
          );
        })
      )}
    </StudentScaffold>
  );
}

/** "24 August 2026" from a local `YYYY-MM-DD`, without going near `Date` parsing rules. */
function formatDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const useStyles = makeStyles((p) => ({
  intro: { fontSize: TYPE.label, color: SLATE[600], lineHeight: leading(TYPE.label), marginBottom: SPACING.md },

  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  legendDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: p.primary },
  legendText: { fontSize: TYPE.caption, color: SLATE[600] },

  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  listTitle: { marginBottom: 0, color: p.primary },
  showAll: { fontSize: TYPE.caption, fontWeight: '700', color: p.primary },

  cardDone: { opacity: 0.72 },

  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  spacer: { flex: 1 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  typeText: { fontSize: TYPE.micro, fontWeight: '800', color: p.primary, textTransform: 'uppercase' },
  gap: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
  gapText: { fontSize: TYPE.micro, fontWeight: '800', color: FEEDBACK.warningOnBg },

  tick: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[50],
  },
  tickOn: { backgroundColor: DONE, borderColor: DONE },

  title: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  body: { fontSize: TYPE.body, color: INK.light.body, lineHeight: leading(TYPE.body), marginTop: 4 },
  // A NOTE's description is the whole resource, so it gets its own inset rather than reading as a
  // caption under a title.
  note: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 12,
    backgroundColor: SLATE[50],
  },

  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: SPACING.sm },
  metaText: { fontSize: TYPE.caption, color: SLATE[600] },
  doneText: { fontSize: TYPE.caption, fontWeight: '700', color: FEEDBACK.successText },

  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: TOUCH.min,
    borderRadius: 999,
    backgroundColor: p.primary,
    marginTop: SPACING.md,
  },
  actionText: { fontSize: TYPE.label, fontWeight: '800', color: p.onPrimary },

  pressed: { opacity: 0.78 },
}));
