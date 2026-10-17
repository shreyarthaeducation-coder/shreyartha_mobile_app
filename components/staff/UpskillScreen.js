import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DONE, PORTALS, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { Card, EmptyState, FormSheet, ScreenScaffold, useToast } from '../ui';
import RichText from '../RichText';
import useStaffResource from '../../hooks/useStaffResource';
import UnderstandingTest from '../student/skillsedge/UnderstandingTest';
import {
  MODULE_TYPE,
  fetchCompletedModules,
  fetchHiddenNodes,
  fetchLearningObjectives,
  fetchModule,
  fetchModules,
  fetchSubSkillAssessment,
  fetchSubSkills,
  fetchUpskillChapters,
  fetchUpskillQuestions,
  moduleAttachments,
  moduleKind,
  toggleUpskillModuleComplete,
  visible,
} from '../../services/teacher/upskillService';

/**
 * Native Upskill Your Self — the Teacher Skills Edge reader.
 *
 * Chapter cards → sub-skill chips (Learning Objectives | Assessment) → objective accordion →
 * modules → module sheet (Content | Test Your Understanding, Mark Complete).
 *
 * Works like the student Skills Edge (18 Oct 2026): a module has a Video, an Image and a PDF; tests
 * reuse the student `UnderstandingTest` with the teacher endpoints and are marked on the phone,
 * never saved. Mark Complete is saved per staff member.
 */

const PALETTE = PORTALS.school;

const KIND_ICON = {
  [MODULE_TYPE.PDF]: 'document-text-outline',
  [MODULE_TYPE.VIDEO]: 'videocam-outline',
  [MODULE_TYPE.IMAGE]: 'image-outline',
  [MODULE_TYPE.LINK]: 'link-outline',
  [MODULE_TYPE.TEXT]: 'reader-outline',
};

const openUrl = (url) => url && Linking.openURL(encodeURI(url)).catch(() => {});

export default function UpskillScreen({ homeRoute = '/teacher' }) {
  const [chapter, setChapter] = useState(null);
  const [subSkill, setSubSkill] = useState(null);
  const [openObjective, setOpenObjective] = useState(null);
  const [moduleTarget, setModuleTarget] = useState(null);
  const [moduleDetail, setModuleDetail] = useState(null);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleTab, setModuleTab] = useState('content');
  const [subSkillTab, setSubSkillTab] = useState('objectives');
  const [done, setDone] = useState(new Set());

  const { toast, showToast } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    fetchCompletedModules(controller.signal)
      .then((ids) => setDone(new Set(ids)))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const toggleComplete = async (moduleId) => {
    try {
      const res = await toggleUpskillModuleComplete(moduleId);
      setDone((prev) => {
        const next = new Set(prev);
        if (res?.completed) next.add(moduleId);
        else next.delete(moduleId);
        return next;
      });
    } catch (e) {
      showToast(e?.message || 'Could not update Mark Complete.', 'error');
    }
  };

  const hiddenFetcher = useCallback((signal) => fetchHiddenNodes(signal), []);
  const { data: hidden } = useStaffResource(hiddenFetcher, { initialData: null });

  const chaptersFetcher = useCallback((signal) => fetchUpskillChapters(signal), []);
  const { data: chapters, loading, error, refreshing, reload, refresh } = useStaffResource(
    chaptersFetcher,
    { initialData: [] },
  );

  const subSkillsFetcher = useCallback(
    (signal) => fetchSubSkills(chapter.id, signal),
    [chapter?.id],
  );
  const { data: subSkills, loading: subSkillsLoading } = useStaffResource(subSkillsFetcher, {
    enabled: !!chapter?.id,
    initialData: [],
  });

  const objectivesFetcher = useCallback(
    (signal) => fetchLearningObjectives(subSkill.id, signal),
    [subSkill?.id],
  );
  const { data: objectives, loading: objectivesLoading } = useStaffResource(objectivesFetcher, {
    enabled: !!subSkill?.id,
    initialData: [],
  });

  const modulesFetcher = useCallback(
    (signal) => fetchModules(openObjective, signal),
    [openObjective],
  );
  const { data: modules, loading: modulesLoading } = useStaffResource(modulesFetcher, {
    enabled: !!openObjective,
    initialData: [],
  });

  const chapterList = visible(hidden, 'CHAPTER', chapters);
  const subSkillList = visible(hidden, 'SUB_SKILL', subSkills);
  const objectiveList = visible(hidden, 'LEARNING_OBJECTIVE', objectives);

  // The first sub-skill opens automatically, as on the web — a chapter with one sub-skill would
  // otherwise show an empty pane.
  useEffect(() => {
    if (!subSkill && subSkillList.length > 0) setSubSkill(subSkillList[0]);
  }, [subSkillList, subSkill]);

  /**
   * Always fetch the detail before rendering media: only that response carries a presigned S3 URL,
   * and it expires after an hour. The list row's URL is unsigned and 403s.
   */
  const openModule = useCallback(
    async (module) => {
      setModuleTab('content');
      setModuleTarget(module);
      setModuleDetail(null);
      setModuleLoading(true);
      try {
        setModuleDetail(await fetchModule(module.id));
      } catch (e) {
        showToast(e?.message || 'Could not load this module.', 'error');
        // Fall back to the list row so text-only modules still read; media may 403.
        setModuleDetail(module);
      } finally {
        setModuleLoading(false);
      }
    },
    [showToast],
  );

  const renderModuleBody = (mod) => {
    // Video, Image and PDF side by side, as students have them; an old single file stands in.
    const attachments = moduleAttachments(mod);

    return (
      <>
        {mod.textContent ? <RichText html={mod.textContent} /> : null}

        {attachments.map(({ kind, url }) =>
          kind === MODULE_TYPE.IMAGE ? (
            <Image key={kind} source={{ uri: url }} style={styles.image} resizeMode="contain" />
          ) : (
            <Pressable
              key={kind}
              onPress={() => openUrl(url)}
              style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons
                name={kind === MODULE_TYPE.VIDEO ? 'play-circle-outline' : 'document-text-outline'}
                size={20}
                color="#ffffff"
              />
              <Text style={styles.mediaText}>{kind === MODULE_TYPE.VIDEO ? 'Play video' : 'Open PDF'}</Text>
            </Pressable>
          ),
        )}

        {/* The web never renders linkUrl, so a LINK module there just says "coming soon". */}
        {mod.linkUrl ? (
          <Pressable
            onPress={() => openUrl(mod.linkUrl)}
            style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="open-outline" size={18} color={PALETTE.primaryDark} />
            <Text style={styles.linkText} numberOfLines={1}>
              {mod.linkUrl}
            </Text>
          </Pressable>
        ) : null}

        {!mod.textContent && attachments.length === 0 && !mod.linkUrl ? (
          <Text style={styles.empty}>This module has no content yet.</Text>
        ) : null}
      </>
    );
  };

  // ── chapter list ──────────────────────────────────────────────────────────
  if (!chapter) {
    return (
      <ScreenScaffold
        title="Upskill Your Self"
        fallbackRoute={homeRoute}
        loading={loading}
        error={chapterList.length === 0 ? error : ''}
        onRetry={reload}
        refreshing={refreshing}
        onRefresh={refresh}
        toast={toast}
      >
        {chapterList.length === 0 ? (
          <EmptyState
            icon="school-outline"
            title="No chapters yet"
            message="Your school's teacher development content will appear here."
          />
        ) : (
          chapterList.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                setChapter(c);
                setSubSkill(null);
                setOpenObjective(null);
                setSubSkillTab('objectives');
              }}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Card>
                <View style={styles.chapterRow}>
                  <View style={styles.chapterText}>
                    <Text style={styles.chapterName}>{c.name}</Text>
                    {c.description ? (
                      <Text style={styles.chapterDesc} numberOfLines={3}>
                        {c.description}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={SLATE[400]} />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScreenScaffold>
    );
  }

  // ── inside a chapter ──────────────────────────────────────────────────────
  return (
    <ScreenScaffold
      title={chapter.name}
      // Back inside the screen returns to the chapter list rather than leaving the tab.
      fallbackRoute={homeRoute}
      scroll={false}
      toast={toast}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            setChapter(null);
            setSubSkill(null);
            setOpenObjective(null);
          }}
          style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={17} color={PALETTE.primaryDark} />
          <Text style={styles.backText}>All chapters</Text>
        </Pressable>

        {subSkillsLoading ? (
          <ActivityIndicator size="small" color={PALETTE.primary} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {subSkillList.map((s) => {
              const active = subSkill?.id === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    setSubSkill(s);
                    setOpenObjective(null);
                    setSubSkillTab('objectives');
                  }}
                  style={({ pressed }) => [
                    styles.chip,
                    active && { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && { color: PALETTE.primaryDark }]}>
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {subSkill ? (
          <TabRow
            tabs={[
              { key: 'objectives', label: 'Learning Objectives' },
              { key: 'assessment', label: 'Assessment' },
            ]}
            value={subSkillTab}
            onChange={setSubSkillTab}
          />
        ) : null}

        {subSkill && subSkillTab === 'assessment' ? (
          // Keyed on the sub-skill so switching starts a fresh attempt.
          <UnderstandingTest
            key={`assessment-${subSkill.id}`}
            moduleId={subSkill.id}
            loadQuestions={fetchSubSkillAssessment}
            showToast={showToast}
            aiTools={false}
          />
        ) : objectivesLoading ? (
          <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
        ) : objectiveList.length === 0 ? (
          <EmptyState
            icon="list-outline"
            title="Nothing here yet"
            message="This sub-skill has no learning objectives."
          />
        ) : (
          objectiveList.map((lo) => {
            const open = openObjective === lo.id;
            return (
              <Card key={lo.id}>
                <Pressable
                  onPress={() => setOpenObjective(open ? null : lo.id)}
                  style={({ pressed }) => [styles.loRow, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                >
                  <Text style={styles.loText}>{lo.text}</Text>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={19}
                    color={SLATE[500]}
                  />
                </Pressable>

                {open ? (
                  modulesLoading ? (
                    <ActivityIndicator size="small" color={PALETTE.primary} style={styles.loader} />
                  ) : (modules || []).length === 0 ? (
                    <Text style={styles.empty}>No modules for this objective yet.</Text>
                  ) : (
                    (modules || []).map((mod, index) => {
                      const kind = moduleKind(mod);
                      return (
                        <Pressable
                          key={mod.id}
                          onPress={() => openModule(mod)}
                          style={({ pressed }) => [styles.moduleRow, pressed && styles.pressed]}
                          accessibilityRole="button"
                        >
                          <Ionicons
                            name={KIND_ICON[kind] || 'reader-outline'}
                            size={19}
                            color={PALETTE.primaryDark}
                          />
                          <Text style={styles.moduleTitle} numberOfLines={2}>
                            {mod.title || `Module ${mod.moduleOrder || index + 1}`}
                          </Text>
                          {done.has(mod.id) ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={DONE}
                              accessibilityLabel="Completed"
                            />
                          ) : null}
                          <Ionicons name="chevron-forward" size={17} color={SLATE[400]} />
                        </Pressable>
                      );
                    })
                  )
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>

      <FormSheet
        visible={!!moduleTarget}
        title={moduleTarget?.title || 'Module'}
        subtitle={subSkill?.name}
        onClose={() => {
          setModuleTarget(null);
          setModuleDetail(null);
        }}
        fullHeight
      >
        {moduleTarget ? (
          <TabRow
            tabs={[
              { key: 'content', label: 'Content' },
              { key: 'understanding', label: 'Test Your Understanding' },
            ]}
            value={moduleTab}
            onChange={setModuleTab}
          />
        ) : null}

        {moduleTarget && moduleTab === 'understanding' ? (
          // Keyed on the module so switching modules restarts the test.
          <UnderstandingTest
            key={`tyu-${moduleTarget.id}`}
            moduleId={moduleTarget.id}
            loadQuestions={fetchUpskillQuestions}
            showToast={showToast}
            aiTools={false}
          />
        ) : moduleLoading ? (
          <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
        ) : moduleDetail ? (
          <>
            {renderModuleBody(moduleDetail)}
            <Pressable
              onPress={() => toggleComplete(moduleTarget.id)}
              style={({ pressed }) => [
                styles.completeBtn,
                done.has(moduleTarget.id) && styles.completeOn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Ionicons
                name={done.has(moduleTarget.id) ? 'checkmark-circle' : 'ellipse-outline'}
                size={19}
                color="#ffffff"
              />
              <Text style={styles.completeText}>
                {done.has(moduleTarget.id) ? 'Completed' : 'Mark as complete'}
              </Text>
            </Pressable>
          </>
        ) : null}
      </FormSheet>
    </ScreenScaffold>
  );
}

/** Two pill tabs, as the student Skills Edge draws them. */
function TabRow({ tabs, value, onChange }) {
  return (
    <View style={styles.tabRow}>
      {tabs.map((t) => {
        const on = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: SLATE[200],
    gap: SPACING.sm,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { fontSize: TYPE.body, fontWeight: '700', color: PALETTE.primaryDark },
  chipRow: { gap: SPACING.sm, paddingRight: SPACING.md },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  chipText: { fontSize: TYPE.body, fontWeight: '600', color: SLATE[600] },

  list: { flex: 1 },
  listContent: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  loader: { marginVertical: SPACING.lg },
  empty: { fontSize: TYPE.label, color: SLATE[500], fontStyle: 'italic', paddingVertical: 8 },

  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  chapterText: { flex: 1 },
  chapterName: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  chapterDesc: { fontSize: TYPE.label, color: SLATE[500], marginTop: 3, lineHeight: leading(TYPE.label) },

  loRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  loText: { flex: 1, fontSize: TYPE.heading, fontWeight: '600', color: SLATE[800], lineHeight: leading(TYPE.heading) },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  moduleTitle: { flex: 1, fontSize: TYPE.heading, color: SLATE[700], fontWeight: '600' },

  image: { width: '100%', height: 220, borderRadius: 12, marginTop: SPACING.md },
  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: SPACING.md,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: PALETTE.primaryDark,
  },
  mediaText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: SPACING.md,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  linkText: { flex: 1, fontSize: TYPE.body, color: PALETTE.primaryDark, fontWeight: '600' },

  tabRow: { flexDirection: 'row', gap: 7, marginBottom: SPACING.md },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  tabOn: { backgroundColor: PALETTE.primary, borderColor: PALETTE.primary },
  tabText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[600] },
  tabTextOn: { color: PALETTE.onPrimary },

  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.lg,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: PALETTE.primary,
  },
  completeOn: { backgroundColor: DONE },
  completeText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },

  pressed: { opacity: 0.72 },
});
