import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  FEEDBACK,
  GROUP_LEVELS,
  PORTALS,
  SHADOWS,
  SLATE,
  SPACING,
  groupLevelMeta,
} from '../../constants/theme';
import {
  CalendarGrid,
  DateTimeField,
  EMPTY_SCHOOL_SCOPE,
  EMPTY_SCOPE,
  EmptyState,
  FormSheet,
  MonthNavigator,
  SchoolClassPicker,
  ScopePicker,
  ScreenScaffold,
  SegmentedTabs,
  Select,
  TextField,
  useToast,
} from '../ui';
import ResourceViewerScreen from './ai/ResourceViewerScreen';
import useStaffResource from '../../hooks/useStaffResource';
import {
  RESOURCE_TYPE,
  buildResourcePayload,
  createResource,
  createShreya01Resource,
  deleteResource,
  deleteShreya01Resource,
  fetchShreya01Resources,
  fetchShreya01Submissions,
  fetchChapters,
  fetchGroupedStudentIds,
  fetchSectionResources,
  fetchSubmissions,
  fetchTopicCompletions,
  resourceClassesLoader,
  toggleTopicCompletion,
  updateResource,
} from '../../services/teacher/resourceService';
import { formatFileSize, pickAttachment } from '../../utils/filePicker';
import {
  formatLongDate,
  formatLongDateTime,
  parseLocalDateTime,
  toIsoDate,
  todayIso,
} from '../../utils/dates';

/**
 * Native Homework + My Teaching Resources.
 *
 * The web serves both sidebar entries from ONE component (AssignHomework.js, 1549 lines) via a
 * `group` prop, each with two sub-tabs. Same structure here:
 *
 *   group="homework"  → Assign Homework · Submitted Homeworks   (resourceType HOMEWORK)
 *   group="resources" → My Resources    · Mark Completed        (resourceType RESOURCE)
 *
 * DEPARTURES FROM THE WEB, both decided with the user:
 *  - Homework is a **due-date list**, not a month calendar. The calendar is still there behind the
 *    📅 button, because seeing the month's spread is genuinely useful — it just isn't the thing you
 *    want between you and "what did I set for Friday".
 *  - The chapter → topic tree is an **accordion**, not the web's three-column master-detail, which
 *    has nowhere to go on a phone.
 *
 * Also unlike the web: one section-wide fetch grouped client-side, instead of a call per topic.
 *
 * Portal A only. The Shreyartha equivalent mixes /api/shreya01/ and /api/teacher/ namespaces and
 * its upload takes flat @RequestParams rather than a JSON part.
 */

const PALETTE = PORTALS.school;

const TABS = {
  homework: [
    { value: 'assign', label: 'Assign', icon: 'create-outline' },
    { value: 'submitted', label: 'Submitted', icon: 'checkbox-outline' },
  ],
  resources: [
    { value: 'resources', label: 'My Resources', icon: 'folder-open-outline' },
    { value: 'completion', label: 'Mark Completed', icon: 'checkmark-done-outline' },
  ],
  // The vice principal's single sidebar entry is labelled "Assign Home Work, My Resources", so it
  // gets both pairs behind one tile. The `value` strings are the same ones the two sets above use
  // — every fetch/upload/delete path is keyed on them, so nothing below this map changes.
  all: [
    { value: 'assign', label: 'Assign', icon: 'create-outline' },
    { value: 'submitted', label: 'Submitted', icon: 'checkbox-outline' },
    { value: 'resources', label: 'My Resources', icon: 'folder-open-outline' },
    { value: 'completion', label: 'Mark Completed', icon: 'checkmark-done-outline' },
  ],
};

const FILE_ICON = {
  PDF: 'document-text-outline',
  IMAGE: 'image-outline',
  VIDEO: 'videocam-outline',
  OTHER: 'attach-outline',
};

const openFile = (fileUrl) => {
  if (!fileUrl) return;
  // The backend stores the S3 URL unencoded, so a filename with a space produces a URL that
  // Linking rejects outright.
  Linking.openURL(encodeURI(fileUrl)).catch(() => {});
};

function Fill({ children }) {
  return <View style={styles.fill}>{children}</View>;
}

function Chip({ icon, label, tone }) {
  if (!label) return null;
  return (
    <View style={[styles.chip, tone && { backgroundColor: tone.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={tone?.color || SLATE[500]} /> : null}
      <Text style={[styles.chipText, tone && { color: tone.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Whether Shreyartha AI can render this file at all. PDFs and images are the two things
 * TeacherResourceViewer draws on the web, and the same two here — a video or a .docx still gets
 * the plain Open action and nothing else.
 */
const canTeachWithAi = (item) =>
  !!item?.fileUrl && (item.fileType === 'PDF' || item.fileType === 'IMAGE');

/** One homework or resource card. `actions` lets the two tabs differ without forking the card. */
function ResourceCard({ item, subtitle, onEdit, onDelete, onTeachWithAi, children }) {
  const level = groupLevelMeta(item.targetGroupLevel);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.cardActions}>
          {onTeachWithAi && canTeachWithAi(item) ? (
            <Pressable
              onPress={() => onTeachWithAi(item)}
              hitSlop={6}
              style={({ pressed }) => [styles.iconBtn, styles.aiBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.title} in Shreyartha AI`}
            >
              <Ionicons name="sparkles" size={16} color="#ffffff" />
            </Pressable>
          ) : null}
          {item.fileUrl ? (
            <Pressable
              onPress={() => openFile(item.fileUrl)}
              hitSlop={6}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.fileName || 'attachment'}`}
            >
              <Ionicons name="open-outline" size={17} color={PALETTE.primaryDark} />
            </Pressable>
          ) : null}
          {onEdit ? (
            <Pressable
              onPress={onEdit}
              hitSlop={6}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.title}`}
            >
              <Ionicons name="pencil" size={16} color={SLATE[600]} />
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable
              onPress={onDelete}
              hitSlop={6}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.title}`}
            >
              <Ionicons name="trash-outline" size={16} color={FEEDBACK.errorText} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.chipRow}>
        {item.chapterName || item.topicName ? (
          <Chip
            icon="library-outline"
            label={[item.chapterName, item.topicName].filter(Boolean).join(' · ')}
          />
        ) : null}
        {item.fileType ? (
          <Chip icon={FILE_ICON[item.fileType] || FILE_ICON.OTHER} label={item.fileType} />
        ) : null}
        {level ? <Chip icon="people-outline" label={level.label} tone={level} /> : null}
      </View>

      {children}
    </View>
  );
}

/** Collapsible row used by both accordion tabs. */
function AccordionRow({ open, title, meta, depth = 0, onPress, children }) {
  return (
    <View style={depth === 0 ? styles.chapterBlock : styles.topicBlock}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          depth === 0 ? styles.chapterHeader : styles.topicHeader,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={depth === 0 ? PALETTE.primaryDark : SLATE[500]}
        />
        <Text
          style={[styles.accordionTitle, depth > 0 && styles.accordionTitleTopic]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {meta ? <Text style={styles.accordionMeta}>{meta}</Text> : null}
      </Pressable>
      {open ? children : null}
    </View>
  );
}

export default function TeacherResourcesScreen({
  group = 'homework',
  homeRoute = '/teacher',
  // 'schoolClass' is the Shreyartha teacher: School -> Class -> Subject, listed per TYPE rather
  // than per section, flat-field upload, and NO update route. See resourceService's Portal B block.
  scopeKind = 'classSection',
  schoolsEndpoint,
}) {
  const tabs = TABS[group] || TABS.homework;
  const schoolScoped = scopeKind === 'schoolClass';

  const [scope, setScope] = useState(schoolScoped ? EMPTY_SCHOOL_SCOPE : EMPTY_SCOPE);
  const [tab, setTab] = useState(tabs[0].value);
  const [openChapters, setOpenChapters] = useState({});
  const [openTopics, setOpenTopics] = useState({});
  const [expandedHomework, setExpandedHomework] = useState(null);
  const [submissions, setSubmissions] = useState({}); // homeworkId -> { loading, error, rows }
  // The resource currently open in Shreyartha AI. Null closes the viewer.
  const [viewerResource, setViewerResource] = useState(null);
  const [togglingTopic, setTogglingTopic] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [dateFilter, setDateFilter] = useState(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const { toast, showToast } = useToast();

  // The same component backs two sidebar entries and is NOT remounted between them, so the tab has
  // to be reset when `group` changes — exactly as the web does.
  useEffect(() => {
    setTab((TABS[group] || TABS.homework)[0].value);
  }, [group]);

  // Which of the two resource TYPEs this screen is currently working with.
  //
  // For the two single-pair groups the answer is fixed by the sidebar entry. For `all` — the vice
  // principal's one tile carrying both pairs — it has to follow the ACTIVE TAB instead, because
  // Assign/Submitted are HOMEWORK rows and My Resources/Mark Completed are RESOURCE rows. Getting
  // this wrong is silent: the list simply comes back with the other type's rows, and an upload
  // from the Assign tab would be stored as a resource and vanish from the homework list forever
  // (`type` is a case-sensitive exact match server-side, with no update route to fix it).
  const isHomeworkGroup =
    group === 'all' ? tab === 'assign' || tab === 'submitted' : group === 'homework';
  const resourceType = isHomeworkGroup ? RESOURCE_TYPE.HOMEWORK : RESOURCE_TYPE.RESOURCE;

  const hasSubject = !!(scope.sectionId && scope.subjectId);
  const hasCurriculum = hasSubject && !!scope.academicIqSubjectId;

  // ── data ──────────────────────────────────────────────────────────────────
  const itemsFetcher = useCallback(
    (signal) =>
      schoolScoped
        ? fetchShreya01Resources({ classId: scope.classId, type: resourceType }, signal)
        : fetchSectionResources(
        { sectionId: scope.sectionId, subjectId: scope.subjectId, type: resourceType },
        signal,
      ),
    [schoolScoped, scope.classId, scope.sectionId, scope.subjectId, resourceType],
  );
  const {
    data: items,
    loading: itemsLoading,
    error: itemsError,
    refreshing,
    reload: reloadItems,
    refresh: refreshItems,
    revalidate: revalidateItems,
  } = useStaffResource(itemsFetcher, { enabled: hasSubject, initialData: [] });

  const chaptersFetcher = useCallback(
    (signal) => fetchChapters(scope.academicIqSubjectId, signal),
    [scope.academicIqSubjectId],
  );
  const {
    data: chapters,
    loading: chaptersLoading,
    error: chaptersError,
    reload: reloadChapters,
  } = useStaffResource(chaptersFetcher, { enabled: hasCurriculum, initialData: [] });

  const completionsFetcher = useCallback(
    (signal) =>
      fetchTopicCompletions({ sectionId: scope.sectionId, subjectId: scope.subjectId }, signal),
    [scope.sectionId, scope.subjectId],
  );
  const { data: completions, revalidate: revalidateCompletions } = useStaffResource(
    completionsFetcher,
    { enabled: hasSubject && tab === 'completion', initialData: [] },
  );

  const groupsFetcher = useCallback(
    (signal) =>
      fetchGroupedStudentIds(
        {
          className: scope.className,
          sectionName: scope.sectionName,
          subjectName: scope.subjectName,
        },
        signal,
      ),
    [scope.className, scope.sectionName, scope.subjectName],
  );
  // Portal A only: `/groups/grouped-ids` is keyed by class/section/SUBJECT names, and Portal B's
  // groups carry no subject at all (Shreya01GroupController is class-level), so there is nothing to
  // ask for. The target-group picker is hidden there rather than fed an empty map.
  const { data: groupedIds } = useStaffResource(groupsFetcher, {
    enabled: !schoolScoped && hasSubject && isHomeworkGroup,
    initialData: {},
  });

  const itemList = useMemo(() => (hasSubject ? items || [] : []), [items, hasSubject]);
  const chapterList = chapters || [];
  const completionList = completions || [];

  // ── derived ───────────────────────────────────────────────────────────────
  const byTopic = useMemo(() => {
    const map = {};
    itemList.forEach((item) => {
      const key = item.topicId ?? 'none';
      (map[key] = map[key] || []).push(item);
    });
    return map;
  }, [itemList]);

  const dueDatesWithWork = useMemo(() => {
    const set = new Set();
    itemList.forEach((item) => {
      const due = parseLocalDateTime(item.dueDate);
      if (due) set.add(toIsoDate(due));
    });
    return set;
  }, [itemList]);

  /** Homework split into Upcoming / Past by due date, each sorted so the nearest work is first. */
  const sections = useMemo(() => {
    const today = todayIso();
    const filtered = dateFilter
      ? itemList.filter((item) => {
          const due = parseLocalDateTime(item.dueDate);
          return due && toIsoDate(due) === dateFilter;
        })
      : itemList;

    const keyOf = (item) => {
      const due = parseLocalDateTime(item.dueDate);
      return due ? toIsoDate(due) : null;
    };

    const upcoming = [];
    const past = [];
    filtered.forEach((item) => {
      const key = keyOf(item);
      if (!key || key >= today) upcoming.push(item);
      else past.push(item);
    });

    upcoming.sort((a, b) => (keyOf(a) || '9999').localeCompare(keyOf(b) || '9999'));
    past.sort((a, b) => (keyOf(b) || '').localeCompare(keyOf(a) || ''));

    return [
      { title: dateFilter ? formatLongDate(dateFilter) : 'Upcoming', data: upcoming },
      { title: 'Past', data: past },
    ].filter((s) => s.data.length > 0);
  }, [itemList, dateFilter]);

  const completionByTopic = useMemo(() => {
    const map = {};
    completionList.forEach((row) => {
      map[row.topicId] = row;
    });
    return map;
  }, [completionList]);

  const groupOptions = useMemo(() => {
    const counts = groupedIds || {};
    const anyGroups = Object.values(counts).some((ids) => Array.isArray(ids) && ids.length > 0);
    return [
      { value: '', label: anyGroups ? 'All students' : 'All students (no groups set up)' },
      ...(anyGroups
        ? GROUP_LEVELS.map((level) => ({
            value: level.key,
            label: `${level.label} (${(counts[level.key] || []).length})`,
          }))
        : []),
    ];
  }, [groupedIds]);

  // ── upload sheet ──────────────────────────────────────────────────────────
  const openCreate = (presetDueDate) => {
    setEditing(null);
    setForm({
      title: '',
      description: '',
      chapterId: null,
      topicId: null,
      dueDate: presetDueDate || null,
      targetGroupLevel: '',
      file: null,
    });
    setSheetOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title || '',
      description: item.description || '',
      chapterId: item.chapterId ?? null,
      topicId: item.topicId ?? null,
      dueDate: item.dueDate || null,
      targetGroupLevel: item.targetGroupLevel || '',
      file: null,
    });
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditing(null);
    setForm(null);
  };

  const patchForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const sheetChapter = chapterList.find((c) => c.id === form?.chapterId) || null;
  const sheetTopics = sheetChapter?.topics || [];

  const attachFile = async () => {
    try {
      const file = await pickAttachment();
      if (file) patchForm({ file });
    } catch (e) {
      showToast(e?.message || 'Could not open the file picker.', 'error');
    }
  };

  const submitSheet = async () => {
    if (!form?.title.trim()) {
      showToast('Please enter a title.', 'error');
      return;
    }
    // Required for BOTH groups: the accordion buckets by topicId, and the server accepts a null
    // one happily — the row would just never appear anywhere again.
    if (!form.topicId) {
      showToast('Please choose a chapter and topic.', 'error');
      return;
    }

    setSaving(true);
    try {
      // Always the full payload: the server overwrites title/description/chapterId/topicId
      // unconditionally on update, so anything omitted would be nulled.
      const payload = buildResourcePayload({
        resourceType,
        title: form.title,
        description: form.description,
        scope,
        chapterId: form.chapterId,
        topicId: form.topicId,
        dueDate: form.dueDate,
        targetGroupLevel: form.targetGroupLevel,
      });

      if (schoolScoped) {
        // No update route in Portal B; the edit affordance is hidden, so this is always a create.
        await createShreya01Resource(
          {
            classId: scope.classId,
            title: payload.title,
            description: payload.description,
            resourceType: payload.resourceType,
            dueDate: payload.dueDate,
            sectionId: scope.sectionId,
            subjectId: scope.subjectId,
          },
          form.file || undefined,
        );
      } else if (editing) {
        await updateResource(editing.id, payload, form.file || undefined);
      } else {
        await createResource(payload, form.file || undefined);
      }

      showToast(editing ? 'Saved.' : `${isHomeworkGroup ? 'Homework' : 'Resource'} added.`, 'success');
      closeSheet();
      await revalidateItems();
    } catch (e) {
      showToast(e?.message || 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item) => {
    Alert.alert('Delete this item?', `"${item.title}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await (schoolScoped ? deleteShreya01Resource(item.id) : deleteResource(item.id));
            showToast('Deleted.', 'success');
            await revalidateItems();
          } catch (e) {
            showToast(e?.message || 'Could not delete.', 'error');
          }
        },
      },
    ]);
  };

  // ── submissions ───────────────────────────────────────────────────────────
  const toggleHomework = async (item) => {
    if (expandedHomework === item.id) {
      setExpandedHomework(null);
      return;
    }
    setExpandedHomework(item.id);
    // Cached: the web re-fetches every time a day is tapped, in parallel, with no cancellation.
    if (submissions[item.id]?.rows) return;

    setSubmissions((prev) => ({ ...prev, [item.id]: { loading: true } }));
    try {
      const rows = await (schoolScoped ? fetchShreya01Submissions(item.id) : fetchSubmissions(item.id));
      setSubmissions((prev) => ({ ...prev, [item.id]: { rows } }));
    } catch (e) {
      setSubmissions((prev) => ({
        ...prev,
        [item.id]: { error: e?.message || 'Could not load submissions.' },
      }));
    }
  };

  // ── completion ────────────────────────────────────────────────────────────
  const flipCompletion = async (chapterId, topicId) => {
    // The endpoint is a TOGGLE, not a set — a second call undoes the first. Blocking on
    // `togglingTopic` is what stops an impatient double-tap silently reverting.
    if (togglingTopic) return;
    setTogglingTopic(topicId);
    try {
      await toggleTopicCompletion({
        sectionId: scope.sectionId,
        subjectId: scope.subjectId,
        chapterId,
        topicId,
      });
      await revalidateCompletions();
    } catch (e) {
      showToast(e?.message || 'Could not update the topic.', 'error');
    } finally {
      setTogglingTopic(null);
    }
  };

  // ── renderers ─────────────────────────────────────────────────────────────
  const scopePrompt = () => (
    <Fill>
      <EmptyState
        icon="school-outline"
        title="Choose a class and subject"
        message="Pick an academic year, class, section and subject to get started."
      />
    </Fill>
  );

  const curriculumPrompt = () => (
    <Fill>
      <EmptyState
        icon="unlink-outline"
        title="Not linked to curriculum content"
        message="This subject has no Academic IQ link, so its chapters and topics can't be loaded. Ask your school admin to link it."
      />
    </Fill>
  );

  const renderAccordion = (renderTopicBody, topicMeta) => {
    if (!hasSubject) return scopePrompt();
    if (!hasCurriculum) return curriculumPrompt();
    if (chaptersLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PALETTE.primary} />
        </View>
      );
    }
    if (chaptersError && chapterList.length === 0) {
      return (
        <Fill>
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load chapters"
            message={chaptersError}
            actionLabel="Try again"
            onAction={reloadChapters}
          />
        </Fill>
      );
    }
    if (chapterList.length === 0) {
      return (
        <Fill>
          <EmptyState
            icon="library-outline"
            title="No chapters for this subject"
            message="The curriculum for this subject has no chapters yet."
          />
        </Fill>
      );
    }

    return (
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.accordionContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshItems}
            tintColor={PALETTE.primary}
            colors={[PALETTE.primary]}
          />
        }
      >
        {chapterList.map((chapter) => (
          <AccordionRow
            key={chapter.id}
            open={!!openChapters[chapter.id]}
            title={chapter.name}
            meta={`${chapter.topics?.length ?? chapter.topicCount ?? 0} topics`}
            onPress={() =>
              setOpenChapters((prev) => ({ ...prev, [chapter.id]: !prev[chapter.id] }))
            }
          >
            {(chapter.topics || []).map((topic) => (
              <AccordionRow
                key={topic.id}
                depth={1}
                open={!!openTopics[topic.id]}
                // displayName is the school-admin alias falling back to the real name.
                title={topic.displayName || topic.name}
                meta={topicMeta(topic, chapter)}
                onPress={() => setOpenTopics((prev) => ({ ...prev, [topic.id]: !prev[topic.id] }))}
              >
                {renderTopicBody(topic, chapter)}
              </AccordionRow>
            ))}
          </AccordionRow>
        ))}
      </ScrollView>
    );
  };

  const renderList = ({ withSubmissions }) => {
    if (!hasSubject) return scopePrompt();
    if (itemsLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PALETTE.primary} />
        </View>
      );
    }
    if (itemsError && itemList.length === 0) {
      return (
        <Fill>
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load homework"
            message={itemsError}
            actionLabel="Try again"
            onAction={reloadItems}
          />
        </Fill>
      );
    }

    const rows = [];
    sections.forEach((section) => {
      rows.push({ type: 'header', key: `h-${section.title}`, title: section.title });
      section.data.forEach((item) => rows.push({ type: 'item', key: `i-${item.id}`, item }));
    });

    return (
      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={rows.length ? styles.listContent : styles.listContentEmpty}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshItems}
            tintColor={PALETTE.primary}
            colors={[PALETTE.primary]}
          />
        }
        ListEmptyComponent={
          <Fill>
            <EmptyState
              icon="document-text-outline"
              title={dateFilter ? 'Nothing due that day' : 'No homework yet'}
              message={
                dateFilter
                  ? 'Try another date, or clear the filter to see everything.'
                  : 'Tap + to set your first homework for this class.'
              }
              actionLabel={dateFilter ? 'Clear filter' : undefined}
              onAction={dateFilter ? () => setDateFilter(null) : undefined}
            />
          </Fill>
        }
        renderItem={({ item: row }) => {
          if (row.type === 'header') {
            return <Text style={styles.sectionHeader}>{row.title}</Text>;
          }
          const item = row.item;
          const due = parseLocalDateTime(item.dueDate);
          const subtitle = due
            ? `Due ${formatLongDateTime(item.dueDate)}`
            : `Added ${formatLongDate((item.createdAt || '').slice(0, 10))}`;

          if (!withSubmissions) {
            return (
              <ResourceCard
                item={item}
                subtitle={subtitle}
                onEdit={schoolScoped ? undefined : () => openEdit(item)}
                onDelete={() => confirmDelete(item)}
                onTeachWithAi={setViewerResource}
              />
            );
          }

          const state = submissions[item.id];
          const open = expandedHomework === item.id;
          return (
            <ResourceCard item={item} subtitle={subtitle} onTeachWithAi={setViewerResource}>
              <Pressable
                onPress={() => toggleHomework(item)}
                style={({ pressed }) => [styles.subToggle, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
              >
                <Ionicons
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color={PALETTE.primaryDark}
                />
                <Text style={styles.subToggleText}>
                  {open ? 'Hide submissions' : 'View submissions'}
                </Text>
                {state?.rows ? (
                  <Text style={styles.subCount}>
                    {state.rows.filter((s) => s.turnedIn).length}/{state.rows.length} in
                  </Text>
                ) : null}
              </Pressable>

              {open ? (
                <View style={styles.subList}>
                  {state?.loading ? (
                    <ActivityIndicator size="small" color={PALETTE.primary} />
                  ) : state?.error ? (
                    <Text style={styles.subError}>{state.error}</Text>
                  ) : (state?.rows || []).length === 0 ? (
                    <Text style={styles.subEmpty}>No submissions yet.</Text>
                  ) : (
                    state.rows.map((sub) => {
                      const tone = !sub.turnedIn
                        ? { color: SLATE[500], label: 'Not submitted' }
                        : sub.late
                          ? { color: FEEDBACK.warningText, label: 'Late' }
                          : { color: FEEDBACK.successText, label: 'Submitted' };
                      return (
                        <View key={sub.id} style={styles.subRow}>
                          <View style={styles.subText}>
                            <Text style={styles.subName} numberOfLines={1}>
                              {sub.studentName || 'Student'}
                            </Text>
                            <Text style={[styles.subStatus, { color: tone.color }]}>
                              {tone.label}
                              {sub.submittedAt ? ` · ${formatLongDateTime(sub.submittedAt)}` : ''}
                            </Text>
                          </View>
                          {sub.fileUrl ? (
                            <Pressable
                              onPress={() => openFile(sub.fileUrl)}
                              hitSlop={6}
                              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                              accessibilityRole="button"
                              accessibilityLabel={`Open ${sub.studentName}'s file`}
                            >
                              <Ionicons name="open-outline" size={16} color={PALETTE.primaryDark} />
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </View>
              ) : null}
            </ResourceCard>
          );
        }}
      />
    );
  };

  const renderBody = () => {
    if (tab === 'assign') return renderList({ withSubmissions: false });
    if (tab === 'submitted') return renderList({ withSubmissions: true });

    if (tab === 'resources') {
      return renderAccordion(
        (topic) => {
          const list = byTopic[topic.id] || [];
          if (list.length === 0) {
            return <Text style={styles.topicEmpty}>No resources for this topic yet.</Text>;
          }
          return list.map((item) => (
            <ResourceCard
              key={item.id}
              item={item}
              onEdit={schoolScoped ? undefined : () => openEdit(item)}
              onDelete={() => confirmDelete(item)}
              onTeachWithAi={setViewerResource}
            />
          ));
        },
        (topic) => {
          const count = (byTopic[topic.id] || []).length;
          return count ? `${count}` : '—';
        },
      );
    }

    return renderAccordion(
      (topic, chapter) => {
        const record = completionByTopic[topic.id];
        const done = !!record?.completed;
        return (
          <View style={styles.completionRow}>
            <View style={styles.completionText}>
              <Text style={styles.completionLabel}>
                {done ? 'Marked complete' : 'Not marked complete'}
              </Text>
              {done && record?.completedAt ? (
                <Text style={styles.completionDate}>
                  {formatLongDate((record.completedAt || '').slice(0, 10))}
                </Text>
              ) : null}
            </View>
            <Switch
              value={done}
              // Disabled while ANY toggle is mid-flight — the endpoint flips state, so a second
              // call would quietly undo the first.
              disabled={!!togglingTopic}
              onValueChange={() => flipCompletion(chapter.id, topic.id)}
              trackColor={{ true: PALETTE.accent, false: SLATE[300] }}
              thumbColor={done ? PALETTE.primaryDark : '#ffffff'}
            />
          </View>
        );
      },
      (topic) => (completionByTopic[topic.id]?.completed ? '✓' : ''),
    );
  };

  // Both create paths need a chapter and topic, which only exist when the subject is linked to
  // curriculum content — so without that link there is nothing the button could usefully do.
  const showAddButton = hasCurriculum && (tab === 'assign' || tab === 'resources');

  // `all` keeps the VP sidebar's own wording; a tab-derived title would flip as tabs change.
  const screenTitle =
    group === 'all'
      ? 'Assign Home Work, My Resources'
      : isHomeworkGroup
        ? 'Homework'
        : 'My Teaching Resources';

  return (
    <ScreenScaffold
      title={screenTitle}
      fallbackRoute={homeRoute}
      scroll={false}
      toast={toast}
    >
      <View style={styles.header}>
        {schoolScoped ? (
          <SchoolClassPicker
            endpoint={schoolsEndpoint}
            value={scope}
            onChange={setScope}
            includeSubject
            style={styles.schoolPicker}
          />
        ) : (
          <ScopePicker
            loadClasses={resourceClassesLoader}
            value={scope}
            onChange={setScope}
            includeSubject
          />
        )}
        {/* Four equal-width tabs truncate to nothing useful on a 360dp phone, so the VP's
            combined row scrolls instead. The two-tab rows are untouched. */}
        <SegmentedTabs options={tabs} value={tab} onChange={setTab} scrollable={tabs.length > 3} />

        {tab === 'assign' && hasSubject ? (
          <View style={styles.toolbar}>
            <Text style={styles.toolbarText} numberOfLines={1}>
              {dateFilter ? formatLongDate(dateFilter) : `${itemList.length} item${itemList.length === 1 ? '' : 's'}`}
            </Text>
            {dateFilter ? (
              <Pressable
                onPress={() => setDateFilter(null)}
                hitSlop={6}
                style={({ pressed }) => [styles.toolbarBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Clear date filter"
              >
                <Ionicons name="close" size={16} color={SLATE[600]} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setCalendarOpen(true)}
              hitSlop={6}
              style={({ pressed }) => [styles.toolbarBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Browse by month"
            >
              <Ionicons name="calendar-outline" size={17} color={SLATE[600]} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {renderBody()}

      {showAddButton ? (
        <Pressable
          onPress={() => openCreate(dateFilter ? `${dateFilter}T09:00:00` : null)}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={isHomeworkGroup ? 'Add homework' : 'Add resource'}
        >
          <Ionicons name="add" size={26} color="#ffffff" />
        </Pressable>
      ) : null}

      {/* Month browser — the web's calendar, demoted to an optional view. */}
      <Modal
        visible={calendarOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setCalendarOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <MonthNavigator
              year={calendarMonth.year}
              month={calendarMonth.month}
              onChange={setCalendarMonth}
            />
            <View style={styles.sheetGrid}>
              <CalendarGrid
                dates={monthDates(calendarMonth)}
                selectedDate={dateFilter}
                onDayPress={(date) => {
                  setDateFilter(date);
                  setCalendarOpen(false);
                }}
                getDay={(date) => ({
                  dot: dueDatesWithWork.has(date) ? PALETTE.primary : undefined,
                  bold: date === todayIso(),
                })}
              />
            </View>
            <Text style={styles.sheetHint}>
              Dots mark days with homework due. Tap a day to filter the list.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <FormSheet
        visible={sheetOpen}
        title={editing ? 'Edit' : isHomeworkGroup ? 'New homework' : 'New resource'}
        subtitle={
          scope.className
            ? `Class ${scope.className}${scope.sectionName ? `-${scope.sectionName}` : ''} · ${scope.subjectName}`
            : undefined
        }
        onClose={closeSheet}
        onSubmit={submitSheet}
        submitting={saving}
        submitLabel={editing ? 'Save' : 'Upload'}
      >
        {form ? (
          <>
            <TextField
              label="Title"
              required
              value={form.title}
              onChangeText={(title) => patchForm({ title })}
              placeholder={isHomeworkGroup ? 'e.g. Polynomials worksheet' : 'e.g. Chapter 3 notes'}
            />
            <TextField
              label="Description"
              value={form.description}
              onChangeText={(description) => patchForm({ description })}
              placeholder="Optional instructions"
              multiline
              inputStyle={styles.multiline}
            />

            {/* Chapter and topic are required for both groups — see submitSheet. */}
            <Select
              label="Chapter"
              value={form.chapterId}
              options={chapterList.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(chapterId) => patchForm({ chapterId, topicId: null })}
              placeholder={hasCurriculum ? 'Choose a chapter' : 'Not linked to curriculum'}
              disabled={!hasCurriculum}
            />
            <Select
              label="Topic"
              value={form.topicId}
              options={sheetTopics.map((t) => ({
                value: t.id,
                label: t.displayName || t.name,
              }))}
              onChange={(topicId) => patchForm({ topicId })}
              placeholder={form.chapterId ? 'Choose a topic' : 'Choose a chapter first'}
              disabled={!form.chapterId}
            />

            {/* Due date and audience are homework concepts; the web force-shows them in edit mode
                too, and since PUT ignores resourceType that stays harmless. */}
            {isHomeworkGroup || editing ? (
              <>
                <DateTimeField
                  label="Due date"
                  value={form.dueDate}
                  onChange={(dueDate) => patchForm({ dueDate })}
                  // No clear button: the API only writes dueDate when non-null, so clearing it
                  // here would appear to work and silently keep the old value.
                  helper={
                    editing && form.dueDate
                      ? 'A due date cannot be removed once set, only changed.'
                      : undefined
                  }
                />
                {/* Portal B has no subject-keyed groups, so /groups/grouped-ids has nothing to
                    resolve and every band would show an empty count. */}
                {schoolScoped ? null : (
                  <Select
                    label="Assign to"
                    value={form.targetGroupLevel}
                    options={groupOptions}
                    onChange={(targetGroupLevel) => patchForm({ targetGroupLevel })}
                  />
                )}
              </>
            ) : null}

            <Text style={styles.fileLabel}>Attachment</Text>
            <Pressable
              onPress={attachFile}
              style={({ pressed }) => [styles.fileBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="attach-outline" size={18} color={PALETTE.primaryDark} />
              <Text style={styles.fileText} numberOfLines={1}>
                {form.file
                  ? `${form.file.name}${form.file.size ? ` · ${formatFileSize(form.file.size)}` : ''}`
                  : editing?.fileName
                    ? `Replace ${editing.fileName}`
                    : 'Choose an image or PDF'}
              </Text>
              {form.file ? (
                <Pressable
                  onPress={() => patchForm({ file: null })}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove attachment"
                >
                  <Ionicons name="close" size={17} color={SLATE[500]} />
                </Pressable>
              ) : null}
            </Pressable>
            {editing?.fileName && !form.file ? (
              <Text style={styles.fileHint}>Leaving this empty keeps the current file.</Text>
            ) : null}
          </>
        ) : null}
      </FormSheet>

      {/* Shreyartha AI. chapterName/topicName come off the resource itself rather than the
          picker's current selection — the web passes the latter, which can describe a different
          topic than the resource being opened. */}
      {viewerResource ? (
        <ResourceViewerScreen
          resource={viewerResource}
          chapterName={viewerResource.chapterName || ''}
          topicName={viewerResource.topicName || ''}
          onClose={() => setViewerResource(null)}
        />
      ) : null}
    </ScreenScaffold>
  );
}

/** Every day of a month as ISO strings — CalendarGrid is driven by a date list, not a cursor. */
function monthDates({ year, month }) {
  const days = new Date(year, month, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return Array.from({ length: days }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`);
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
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolbarText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: SLATE[500] },
  toolbarBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[100],
  },

  list: { flex: 1 },
  fill: { flex: 1, justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: SPACING.md, paddingBottom: 96 },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  accordionContent: { padding: SPACING.md, paddingBottom: 96 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  cardTop: { flexDirection: 'row', gap: SPACING.sm },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: SLATE[800] },
  cardSubtitle: { fontSize: 12.5, color: PALETTE.primaryDark, fontWeight: '600', marginTop: 2 },
  cardDesc: { fontSize: 13, color: SLATE[600], lineHeight: 18, marginTop: 5 },
  cardActions: { flexDirection: 'row', gap: 4 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[50],
  },
  // Filled rather than ghosted: this is the one action on the card that does something new.
  aiBtn: { backgroundColor: PALETTE.primaryDark },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: SLATE[100],
    maxWidth: '100%',
  },
  chipText: { fontSize: 11.5, fontWeight: '600', color: SLATE[500], flexShrink: 1 },

  subToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  subToggleText: { flex: 1, fontSize: 13, fontWeight: '700', color: PALETTE.primaryDark },
  subCount: { fontSize: 12, fontWeight: '700', color: SLATE[500] },
  subList: { marginTop: SPACING.sm, gap: 2 },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  subText: { flex: 1 },
  subName: { fontSize: 13.5, fontWeight: '600', color: SLATE[800] },
  subStatus: { fontSize: 11.5, fontWeight: '600', marginTop: 1 },
  subEmpty: { fontSize: 12.5, color: SLATE[400], fontStyle: 'italic' },
  subError: { fontSize: 12.5, color: FEEDBACK.errorText },

  chapterBlock: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: SPACING.md,
  },
  topicBlock: { borderTopWidth: 1, borderTopColor: SLATE[100], backgroundColor: SLATE[50] },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingLeft: SPACING.lg,
    paddingRight: SPACING.md,
  },
  accordionTitle: { flex: 1, fontSize: 14.5, fontWeight: '700', color: SLATE[800] },
  accordionTitleTopic: { fontSize: 13.5, fontWeight: '600', color: SLATE[700] },
  accordionMeta: { fontSize: 12, fontWeight: '700', color: SLATE[400] },
  topicEmpty: {
    fontSize: 12.5,
    color: SLATE[400],
    fontStyle: 'italic',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },

  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingLeft: SPACING.lg,
    paddingRight: SPACING.md,
    paddingBottom: SPACING.md,
  },
  completionText: { flex: 1 },
  completionLabel: { fontSize: 13, fontWeight: '600', color: SLATE[700] },
  completionDate: { fontSize: 11.5, color: SLATE[500], marginTop: 1 },

  fab: {
    position: 'absolute',
    right: SPACING.md,
    bottom: SPACING.lg,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.primaryDark,
    ...SHADOWS.lg,
  },
  pressed: { opacity: 0.72 },

  multiline: { height: 88, textAlignVertical: 'top' },
  fileLabel: { fontSize: 13, fontWeight: '600', color: SLATE[700], marginBottom: 6 },
  fileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: SLATE[200],
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  fileText: { flex: 1, fontSize: 14, color: SLATE[700] },
  fileHint: { marginTop: 5, fontSize: 12, color: SLATE[500] },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: SLATE[300],
    marginBottom: SPACING.md,
  },
  sheetGrid: { marginTop: SPACING.md },
  sheetHint: { fontSize: 12, color: SLATE[500], textAlign: 'center', marginTop: SPACING.sm },
});
