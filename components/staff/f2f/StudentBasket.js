import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { Card, EmptyState, TextField } from '../../ui';
import { fetchReportStudents, fetchReportTree } from '../../../services/counsellor/reportService';

/**
 * Who the session is for — the screen that stands between "open the room" and a live session.
 *
 * ══ ONE SCHOOL PER SESSION, AND THE SERVER WILL NOT SAY SO ═════════════════
 * A session carries a single `schoolId`, but the server validates the student ids against EVERY
 * school the counsellor is linked to. So a basket mixing two schools is accepted and then files
 * one school's children under another's session. The Shreyartha counsellor covers several schools
 * in one tree, which makes this easy to do by accident — hence `basketSchoolId` below, enforced
 * here because nothing downstream will.
 *
 * ══ THE TREE'S TWO SHAPES ══════════════════════════════════════════════════
 * `fetchReportTree` returns one root per school. Two traps carried over from `reportService`:
 *   · `classId` lives on the YEAR node, not the class node — one className spans several years and
 *     each is a different SchoolClass row.
 *   · A class with no academic year lands under a single `UNASSIGNED` year, so `yearLabel` is not
 *     always a real year.
 *
 * A walk-in needs none of this: it opens an empty session and adds people as they sit down.
 */
export default function StudentBasket({ portal, isWalkIn, busy, error, onStart }) {
  const styles = useStyles();
  const palette = usePalette();

  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(!isWalkIn);
  const [treeError, setTreeError] = useState('');
  const [openLeaf, setOpenLeaf] = useState(null);
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  /** studentId → {studentId, name, schoolId}. A map so re-ticking a leaf cannot duplicate. */
  const [basket, setBasket] = useState({});
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (isWalkIn) return undefined;
    let alive = true;
    (async () => {
      try {
        const rows = await fetchReportTree(portal.report);
        if (alive) setTree(rows);
      } catch (e) {
        if (alive) setTreeError(e?.message || 'Could not load your classes.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isWalkIn, portal.report]);

  const openYear = useCallback(
    async (school, className, year) => {
      const leaf = {
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        className,
        // `classId` is on the YEAR, not the class — see the note above.
        classId: year.classId,
        yearLabel: year.yearLabel,
        sectionName: null,
      };
      setOpenLeaf(leaf);
      setRosterLoading(true);
      setRoster([]);
      try {
        const rows = await fetchReportStudents({
          apiBase: portal.report,
          classId: leaf.classId,
          sectionName: leaf.sectionName,
          yearLabel: leaf.yearLabel,
        });
        setRoster(rows);
      } catch (e) {
        setTreeError(e?.message || 'Could not load that class.');
      } finally {
        setRosterLoading(false);
      }
    },
    [portal.report],
  );

  const basketIds = Object.keys(basket);
  const basketSchoolId = basketIds.length ? basket[basketIds[0]].schoolId : null;

  const toggleStudent = (student) => {
    const id = String(student.studentId);
    setBasket((b) => {
      if (b[id]) {
        const next = { ...b };
        delete next[id];
        return next;
      }
      // The guard the server does not apply.
      if (basketSchoolId != null && openLeaf?.schoolId !== basketSchoolId) {
        setTreeError(
          'A session belongs to one school. Finish this one before starting another school.',
        );
        return b;
      }
      return {
        ...b,
        [id]: {
          studentId: student.studentId,
          name: student.studentName || student.fullName,
          schoolId: openLeaf?.schoolId,
        },
      };
    });
  };

  if (isWalkIn) {
    return (
      <Card>
        <Text style={styles.title}>Walk-in</Text>
        <Text style={styles.body}>
          Opens a session with nobody in it. Add each student as they sit down — name and grade are
          all that is needed, and they do not have to be on any roster.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          onPress={() => onStart({ title: title.trim() || undefined })}
          disabled={busy}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: palette.primary },
            busy && styles.disabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>{busy ? 'Opening…' : 'Open walk-in session'}</Text>
        </Pressable>
      </Card>
    );
  }

  return (
    <View>
      {treeError ? <Text style={styles.error}>{treeError}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card>
        <Text style={styles.title}>Who is this session for?</Text>
        <TextField
          label="Session title"
          value={title}
          onChangeText={setTitle}
          placeholder="Face-to-face counselling"
        />

        {loading ? (
          <Text style={styles.body}>Loading your classes…</Text>
        ) : tree.length === 0 ? (
          <EmptyState message="You have no classes assigned yet." />
        ) : (
          tree.map((school) => (
            <View key={school.schoolId} style={styles.school}>
              <Text style={styles.schoolName}>{school.schoolName}</Text>
              {(school.classes || []).map((klass) =>
                (klass.years || []).map((year) => {
                  const isOpen =
                    openLeaf?.classId === year.classId && openLeaf?.yearLabel === year.yearLabel;
                  return (
                    <Pressable
                      key={`${klass.className}-${year.classId}-${year.yearLabel}`}
                      onPress={() => openYear(school, klass.className, year)}
                      style={({ pressed }) => [styles.leaf, pressed && styles.pressed]}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={isOpen ? 'chevron-down' : 'chevron-forward'}
                        size={18}
                        color={SLATE[400]}
                      />
                      <Text style={styles.leafText}>
                        {`Class ${klass.className}`}
                        {/* A class with no academic year lands under UNASSIGNED — showing that
                            literal would read as a data error rather than an absence. */}
                        {year.yearLabel && year.yearLabel !== 'UNASSIGNED'
                          ? ` · ${year.yearLabel}`
                          : ' · Year not set'}
                      </Text>
                    </Pressable>
                  );
                }),
              )}
            </View>
          ))
        )}
      </Card>

      {openLeaf ? (
        <Card>
          <Text style={styles.title}>
            {`Class ${openLeaf.className} · ${openLeaf.schoolName}`}
          </Text>
          {rosterLoading ? (
            <Text style={styles.body}>Loading students…</Text>
          ) : roster.length === 0 ? (
            <EmptyState message="No students in this class." />
          ) : (
            roster.map((s) => {
              const id = String(s.studentId);
              const ticked = !!basket[id];
              return (
                <Pressable
                  key={id}
                  onPress={() => toggleStudent(s)}
                  style={({ pressed }) => [styles.student, pressed && styles.pressed]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ticked }}
                >
                  <Ionicons
                    name={ticked ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={ticked ? palette.primary : SLATE[400]}
                  />
                  <Text style={styles.studentName}>{s.studentName || s.fullName}</Text>
                </Pressable>
              );
            })
          )}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.body}>
          {basketIds.length
            ? `${basketIds.length} student${basketIds.length === 1 ? '' : 's'} selected.`
            : 'Pick a class, then tick the students you will see.'}
        </Text>
        <Pressable
          onPress={() =>
            onStart({
              schoolId: basketSchoolId,
              studentIds: basketIds.map((k) => basket[k].studentId),
              title: title.trim() || undefined,
            })
          }
          disabled={busy || basketIds.length === 0}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: palette.primary },
            (busy || basketIds.length === 0) && styles.disabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>{busy ? 'Starting…' : 'Start session'}</Text>
        </Pressable>
      </Card>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  title: { fontSize: TYPE.title, fontWeight: '800', color: SLATE[900], marginBottom: SPACING.sm },
  body: { fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body), marginBottom: SPACING.sm },
  error: {
    fontSize: TYPE.caption,
    color: FEEDBACK.errorOnBg,
    backgroundColor: FEEDBACK.errorBg,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  school: { marginTop: SPACING.sm },
  schoolName: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500] },
  leaf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
  },
  leafText: { flex: 1, fontSize: TYPE.body, color: SLATE[800] },

  student: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
  },
  studentName: { flex: 1, fontSize: TYPE.body, color: SLATE[800] },

  primary: {
    minHeight: TOUCH.min,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
}));
