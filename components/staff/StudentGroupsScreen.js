import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, GROUP_LEVELS, PORTALS, SHADOWS, SLATE, SPACING, TYPE, groupLevelMeta, leading } from '../../constants/theme';
import {
  EMPTY_SCHOOL_SCOPE,
  EMPTY_SCOPE,
  EmptyState,
  SchoolClassPicker,
  ScopePicker,
  ScreenScaffold,
  SegmentedTabs,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  ALL_SUBJECTS,
  groupClassesLoader,
  fetchGroupStudents,
  fetchGroups,
  removeGroupAssignment,
  saveGroups,
  updateGroupLevel,
  fetchShreya01GroupStudents,
  fetchShreya01Groups,
  saveShreya01Groups,
  removeShreya01GroupAssignment,
} from '../../services/teacher/groupService';

/**
 * Native Student Groups — sort a class into the four ability bands, per subject.
 *
 * Mirrors frontendmain/src/School/Teacher/pages/TeacherGroups.js, which is a Create / View toggle
 * over a year → class → section → subject cascade. The web's Create view is a table with four
 * radio columns; on a phone that becomes four compact colour-coded buttons on each student row.
 *
 * Portal A only. Portal B's group API has no /classes, is classId-based with no section or subject,
 * takes a raw array body and has no PUT — the row renderer and the level palette are reusable, the
 * cascade and the save call are not.
 */

const PALETTE = PORTALS.school;

const TABS = [
  { value: 'create', label: 'Create', icon: 'add-circle-outline' },
  { value: 'view', label: 'View', icon: 'eye-outline' },
];

const SUBJECT_EXTRAS = [{ subjectId: ALL_SUBJECTS, subjectName: 'All Subjects' }];

/** ScreenScaffold's scroll={false} body is a flex column, so anything that should sit centred in
 *  the leftover space (empty states, spinners) needs to claim it. */
function Fill({ children }) {
  return <View style={styles.fill}>{children}</View>;
}

function Legend() {
  return (
    <View style={styles.legend}>
      {GROUP_LEVELS.map((level) => (
        <View key={level.key} style={styles.legendItem}>
          <View style={[styles.legendKey, { backgroundColor: level.bg, borderColor: level.color }]}>
            <Text style={[styles.legendKeyText, { color: level.color }]}>{level.short}</Text>
          </View>
          <Text style={styles.legendText}>{level.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** The four bands as one compact row of colour-coded initials — the phone form of the web's
 *  four radio columns. `selected` may be undefined: nothing is lit until the teacher taps. */
function LevelButtons({ selected, disabled, onPick }) {
  return (
    <View style={styles.levelRow}>
      {GROUP_LEVELS.map((level) => {
        const active = selected === level.key;
        return (
          <Pressable
            key={level.key}
            onPress={() => onPick(level.key)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.levelBtn,
              active && { backgroundColor: level.bg, borderColor: level.color },
              pressed && styles.pressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={level.label}
          >
            <Text style={[styles.levelBtnText, active && { color: level.color }]}>
              {level.short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom sheet used by the View tab to move one student to another band. */
function LevelSheet({ visible, studentName, current, onPick, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {studentName}
          </Text>
          {GROUP_LEVELS.map((level) => {
            const active = level.key === current;
            return (
              <Pressable
                key={level.key}
                onPress={() => onPick(level.key)}
                style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.sheetDot, { backgroundColor: level.color }]} />
                <Text style={[styles.sheetOptionText, active && { fontWeight: '700' }]}>
                  {level.label}
                </Text>
                {active ? (
                  <Ionicons name="checkmark" size={19} color={PALETTE.primaryDark} />
                ) : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function StudentGroupsScreen({
  homeRoute = '/teacher',
  // 'schoolClass' is the Shreyartha teacher: School -> Class, no section and NO SUBJECT TIER, an
  // id-keyed bare-array save, and no update-level endpoint. See groupService's Portal B block.
  scopeKind = 'classSection',
  schoolsEndpoint,
}) {
  const schoolScoped = scopeKind === 'schoolClass';

  const [scope, setScope] = useState(schoolScoped ? EMPTY_SCHOOL_SCOPE : EMPTY_SCOPE);
  const [tab, setTab] = useState('create');
  const [assignments, setAssignments] = useState({});
  const [saving, setSaving] = useState(false);
  const [busyGroupId, setBusyGroupId] = useState(null);
  const [editing, setEditing] = useState(null); // the StudentGroupResponse row being re-levelled

  const { toast, showToast } = useToast();

  const isAllSubjects = !schoolScoped && scope.subjectId === ALL_SUBJECTS;
  // Portal B needs only a class; Portal A needs class + section, and then a subject to read groups.
  const hasSection = schoolScoped ? !!scope.classId : !!(scope.className && scope.sectionName);
  const hasSubject = schoolScoped ? hasSection : hasSection && !!scope.subjectName;
  // "ALL" only means something to POST /save; GET does a literal string match and would come back
  // empty, so the read side must never ask for it. Portal B has no subjects, so nothing to guard.
  const canReadGroups = schoolScoped ? hasSection : hasSubject && !isAllSubjects;

  const studentsFetcher = useCallback(
    (signal) =>
      schoolScoped
        ? fetchShreya01GroupStudents({ classId: scope.classId }, signal)
        : fetchGroupStudents({ className: scope.className, sectionName: scope.sectionName }, signal),
    [schoolScoped, scope.classId, scope.className, scope.sectionName],
  );
  const {
    data: students,
    loading: studentsLoading,
    error: studentsError,
    refreshing,
    reload: reloadStudents,
    refresh: refreshStudents,
  } = useStaffResource(studentsFetcher, { enabled: hasSection, initialData: [] });

  const groupsFetcher = useCallback(
    (signal) =>
      schoolScoped
        ? fetchShreya01Groups({ classId: scope.classId }, signal)
        : fetchGroups(
            {
              className: scope.className,
              sectionName: scope.sectionName,
              subjectName: scope.subjectName,
            },
            signal,
          ),
    [schoolScoped, scope.classId, scope.className, scope.sectionName, scope.subjectName],
  );
  const {
    data: groups,
    loading: groupsLoading,
    error: groupsError,
    reload: reloadGroups,
    revalidate: revalidateGroups,
  } = useStaffResource(groupsFetcher, { enabled: canReadGroups, initialData: [] });

  const roster = students || [];
  const groupRows = useMemo(() => (canReadGroups ? groups || [] : []), [groups, canReadGroups]);

  // Existing assignments pre-fill the Create tab, so a teacher edits rather than starts over.
  // With "All Subjects" there is nothing to read back, so it starts blank.
  useEffect(() => {
    if (!canReadGroups) {
      setAssignments({});
      return;
    }
    const next = {};
    groupRows.forEach((row) => {
      next[row.studentId] = row.groupLevel;
    });
    setAssignments(next);
  }, [groupRows, canReadGroups]);

  const savedLevelByStudent = useMemo(() => {
    const map = {};
    groupRows.forEach((row) => {
      map[row.studentId] = row.groupLevel;
    });
    return map;
  }, [groupRows]);

  const assignedCount = useMemo(
    () => Object.values(assignments).filter(Boolean).length,
    [assignments],
  );

  const pickLevel = (studentId, level) => {
    setAssignments((prev) => {
      // Tapping the lit band clears it — but only while it is unsaved. `saveGroups` is an upsert
      // that never deletes, so clearing a saved assignment here would look like a removal and
      // silently do nothing. Removal lives in the View tab, on DELETE /{groupId}.
      if (prev[studentId] === level && !savedLevelByStudent[studentId]) {
        const next = { ...prev };
        delete next[studentId];
        return next;
      }
      return { ...prev, [studentId]: level };
    });
  };

  const assignAll = (level) => {
    const next = {};
    roster.forEach((student) => {
      next[student.id] = level;
    });
    setAssignments(next);
  };

  const save = async () => {
    if (!hasSubject || saving || assignedCount === 0) return;

    setSaving(true);
    const entries = Object.entries(assignments)
      .filter(([, level]) => !!level)
      .map(([studentId, groupLevel]) => ({ studentId: Number(studentId), groupLevel }));
    try {
      if (schoolScoped) {
        // Bare array + classId in the query string. The Portal A object shape saves nothing here.
        await saveShreya01Groups({ classId: scope.classId, entries });
      } else {
        await saveGroups({
          className: scope.className,
          sectionName: scope.sectionName,
          subjectName: scope.subjectName,
          entries,
        });
      }
      showToast(
        isAllSubjects
          ? 'Groups saved for every subject you teach in this section.'
          : 'Groups saved.',
        'success',
      );
      if (canReadGroups) await revalidateGroups();
    } catch (e) {
      showToast(e?.message || 'Could not save groups.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const changeLevel = async (row, level) => {
    setEditing(null);
    if (level === row.groupLevel) return;
    setBusyGroupId(row.id);
    try {
      await updateGroupLevel(row.id, level);
      showToast(`${row.studentName} moved to ${groupLevelMeta(level)?.label || level}.`, 'success');
      await revalidateGroups();
    } catch (e) {
      showToast(e?.message || 'Could not change the group.', 'error');
    } finally {
      setBusyGroupId(null);
    }
  };

  const confirmRemove = (row) => {
    Alert.alert('Remove from group?', `${row.studentName} will be left unassigned.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyGroupId(row.id);
          try {
            await (schoolScoped
              ? removeShreya01GroupAssignment(row.id)
              : removeGroupAssignment(row.id));
            showToast('Removed from group.', 'success');
            await revalidateGroups();
          } catch (e) {
            showToast(e?.message || 'Could not remove the assignment.', 'error');
          } finally {
            setBusyGroupId(null);
          }
        },
      },
    ]);
  };

  const scopePrompt = () => (
    <Fill>
      {!hasSection ? (
        <EmptyState
          icon="school-outline"
          title="Choose a class"
          message={
            schoolScoped
              ? 'Pick a school and class to load the roster.'
              : 'Pick an academic year, class and section to load the roster.'
          }
        />
      ) : (
        <EmptyState
          icon="book-outline"
          title="Choose a subject"
          message="Groups are per subject, so a student can sit in different bands for different subjects."
        />
      )}
    </Fill>
  );

  // ── Create tab ────────────────────────────────────────────────────────────
  const renderCreate = () => {
    if (!hasSubject) return scopePrompt();
    if (studentsLoading || (canReadGroups && groupsLoading)) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PALETTE.primary} />
        </View>
      );
    }
    if (studentsError && roster.length === 0) {
      return (
        <Fill>
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load the roster"
            message={studentsError}
            actionLabel="Try again"
            onAction={reloadStudents}
          />
        </Fill>
      );
    }
    if (roster.length === 0) {
      return (
        <Fill>
          <EmptyState
            icon="people-outline"
            title="No students in this section"
            message="Students need to be registered and assigned to this class and section first."
          />
        </Fill>
      );
    }

    return (
      <FlatList
        style={styles.list}
        data={roster}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={styles.createHeader}>
            {isAllSubjects ? (
              <View style={styles.infoBanner}>
                <Ionicons name="information-circle" size={18} color={PALETTE.primaryDark} />
                <Text style={styles.infoText}>
                  These bands will be written identically for every subject you teach in this
                  section. Edit an individual subject afterwards from the View tab.
                </Text>
              </View>
            ) : null}
            <Legend />
            <View style={styles.quickRow}>
              <Text style={styles.quickLabel}>Assign all</Text>
              {GROUP_LEVELS.map((level) => (
                <Pressable
                  key={level.key}
                  onPress={() => assignAll(level.key)}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.quickBtn,
                    { backgroundColor: level.bg, borderColor: level.color },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Assign everyone ${level.label}`}
                >
                  <Text style={[styles.quickBtnText, { color: level.color }]}>{level.short}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Text style={styles.rowIndex}>{index + 1}</Text>
            <Text style={styles.rowName} numberOfLines={1}>
              {item.fullName}
            </Text>
            <LevelButtons
              selected={assignments[item.id]}
              disabled={saving}
              onPick={(level) => pickLevel(item.id, level)}
            />
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              refreshStudents();
              // The roster and the saved bands are two calls; a pull should re-read both.
              if (canReadGroups) revalidateGroups();
            }}
            tintColor={PALETTE.primary}
            colors={[PALETTE.primary]}
          />
        }
      />
    );
  };

  // ── View tab ──────────────────────────────────────────────────────────────
  const renderView = () => {
    if (!hasSubject) return scopePrompt();
    if (isAllSubjects) {
      return (
        <Fill>
          <EmptyState
            icon="albums-outline"
            title="Pick a specific subject"
            message='"All Subjects" is only for creating groups in bulk. Choose one subject to view or edit its bands.'
          />
        </Fill>
      );
    }
    if (groupsLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PALETTE.primary} />
        </View>
      );
    }
    if (groupsError && groupRows.length === 0) {
      return (
        <Fill>
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load the groups"
            message={groupsError}
            actionLabel="Try again"
            onAction={reloadGroups}
          />
        </Fill>
      );
    }
    if (groupRows.length === 0) {
      return (
        <Fill>
          <EmptyState
            icon="people-circle-outline"
            title="No groups yet for this subject"
            message="Switch to the Create tab to assign students to bands."
          />
        </Fill>
      );
    }

    return (
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.viewScroll}
        showsVerticalScrollIndicator={false}
      >
        {GROUP_LEVELS.map((level) => {
          const members = groupRows.filter((row) => row.groupLevel === level.key);
          return (
            <View key={level.key} style={styles.levelCard}>
              <View
                style={[
                  styles.levelCardHeader,
                  { backgroundColor: level.bg, borderLeftColor: level.color },
                ]}
              >
                <Text style={[styles.levelCardTitle, { color: level.color }]}>{level.label}</Text>
                <View style={[styles.countBadge, { backgroundColor: level.color }]}>
                  <Text style={styles.countBadgeText}>{members.length}</Text>
                </View>
              </View>

              {members.length === 0 ? (
                <Text style={styles.emptyBand}>No students in this band</Text>
              ) : (
                members.map((row) => (
                  <View key={row.id} style={styles.memberRow}>
                    <View style={styles.memberText}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {row.studentName}
                      </Text>
                      {row.studentEmail ? (
                        <Text style={styles.memberEmail} numberOfLines={1}>
                          {row.studentEmail}
                        </Text>
                      ) : null}
                    </View>

                    {busyGroupId === row.id ? (
                      <ActivityIndicator size="small" color={PALETTE.primary} />
                    ) : (
                      <View style={styles.memberActions}>
                        {/* Portal B has no update-level route (Shreya01GroupController exposes
                            GET/POST/DELETE only), so re-levelling there is done by saving again. */}
                        {schoolScoped ? null : (
                        <Pressable
                          onPress={() => setEditing(row)}
                          hitSlop={6}
                          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                          accessibilityRole="button"
                          accessibilityLabel={`Change ${row.studentName}'s group`}
                        >
                          <Ionicons name="swap-horizontal" size={19} color={SLATE[600]} />
                        </Pressable>
                        )}
                        <Pressable
                          onPress={() => confirmRemove(row)}
                          hitSlop={6}
                          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${row.studentName} from their group`}
                        >
                          <Ionicons name="close" size={20} color={FEEDBACK.errorText} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <ScreenScaffold title="Student Groups" fallbackRoute={homeRoute} scroll={false} toast={toast}>
      <View style={styles.header}>
        {schoolScoped ? (
          <SchoolClassPicker
            endpoint={schoolsEndpoint}
            value={scope}
            onChange={setScope}
            style={styles.schoolPicker}
          />
        ) : (
          <ScopePicker
            loadClasses={groupClassesLoader}
            value={scope}
            onChange={setScope}
            includeSubject
            subjectExtraOptions={SUBJECT_EXTRAS}
          />
        )}
        <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
      </View>

      {tab === 'create' ? renderCreate() : renderView()}

      {tab === 'create' && hasSubject && roster.length > 0 ? (
        <View style={styles.footer}>
          <Text style={styles.footerCount}>
            {assignedCount} of {roster.length} assigned
          </Text>
          <Pressable
            onPress={save}
            disabled={saving || assignedCount === 0}
            style={({ pressed }) => [
              styles.saveBtn,
              (saving || assignedCount === 0) && styles.saveBtnDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <LevelSheet
        visible={!!editing}
        studentName={editing?.studentName}
        current={editing?.groupLevel}
        onPick={(level) => changeLevel(editing, level)}
        onClose={() => setEditing(null)}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
  schoolPicker: { paddingHorizontal: 0, paddingVertical: 0 },
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: SLATE[200],
    gap: SPACING.sm,
  },
  list: { flex: 1 },
  fill: { flex: 1, justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  createHeader: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  infoBanner: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: PALETTE.tint,
  },
  infoText: { flex: 1, fontSize: TYPE.label, lineHeight: leading(TYPE.label), color: SLATE[700] },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendKey: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendKeyText: { fontSize: TYPE.caption, fontWeight: '800' },
  legendText: { fontSize: TYPE.caption, color: SLATE[500], fontWeight: '600' },

  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickLabel: { flex: 1, fontSize: TYPE.label, fontWeight: '700', color: SLATE[500] },
  quickBtn: {
    width: 34,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBtnText: { fontSize: TYPE.body, fontWeight: '800' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  rowIndex: { minWidth: 20, fontSize: TYPE.label, fontWeight: '700', color: SLATE[500] },
  rowName: { flex: 1, fontSize: TYPE.heading, fontWeight: '600', color: SLATE[800] },
  levelRow: { flexDirection: 'row', gap: 5 },
  levelBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[50],
  },
  levelBtnText: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[500] },
  pressed: { opacity: 0.72 },

  viewScroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  levelCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  levelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderLeftWidth: 4,
  },
  levelCardTitle: { fontSize: TYPE.heading, fontWeight: '800' },
  countBadge: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
  },
  countBadgeText: { color: '#ffffff', fontSize: TYPE.label, fontWeight: '800' },
  emptyBand: {
    fontSize: TYPE.label,
    color: SLATE[500],
    fontStyle: 'italic',
    padding: SPACING.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  memberText: { flex: 1 },
  memberName: { fontSize: TYPE.heading, fontWeight: '600', color: SLATE[800] },
  memberEmail: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 1 },
  memberActions: { flexDirection: 'row', gap: 4 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[50],
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
    ...SHADOWS.md,
  },
  footerCount: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[600] },
  saveBtn: {
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: PALETTE.primaryDark,
  },
  saveBtnDisabled: { backgroundColor: SLATE[300] },
  saveText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: SPACING.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: SLATE[300],
    marginBottom: SPACING.sm,
  },
  sheetTitle: {
    fontSize: TYPE.heading,
    fontWeight: '700',
    color: SLATE[800],
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  sheetOptionPressed: { backgroundColor: SLATE[50] },
  sheetDot: { width: 10, height: 10, borderRadius: 5 },
  sheetOptionText: { flex: 1, fontSize: TYPE.heading, color: SLATE[700] },
});
