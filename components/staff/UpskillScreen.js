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
import { PORTALS, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { Card, EmptyState, FormSheet, ScreenScaffold, useToast } from '../ui';
import RichText from '../RichText';
import useStaffResource from '../../hooks/useStaffResource';
import {
  MODULE_TYPE,
  fetchHiddenNodes,
  fetchLearningObjectives,
  fetchModule,
  fetchModules,
  fetchSubSkills,
  fetchUpskillChapters,
  moduleKind,
  visible,
} from '../../services/teacher/upskillService';

/**
 * Native Upskill Your Self — the Teacher Skills Edge reader.
 *
 * Chapter cards → sub-skill chips → objective accordion → modules → module detail.
 * Read-only; there is no progress tracking in this feature.
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

  const { toast, showToast } = useToast();

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
    const kind = moduleKind(mod);
    const url = mod.s3Url;

    return (
      <>
        {mod.textContent ? <RichText html={mod.textContent} /> : null}

        {kind === MODULE_TYPE.IMAGE && url ? (
          <Image source={{ uri: url }} style={styles.image} resizeMode="contain" />
        ) : null}

        {kind === MODULE_TYPE.VIDEO && url ? (
          <Pressable
            onPress={() => openUrl(url)}
            style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="play-circle-outline" size={20} color="#ffffff" />
            <Text style={styles.mediaText}>Play video</Text>
          </Pressable>
        ) : null}

        {kind === MODULE_TYPE.PDF && url ? (
          <Pressable
            onPress={() => openUrl(url)}
            style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="document-text-outline" size={20} color="#ffffff" />
            <Text style={styles.mediaText}>Open PDF</Text>
          </Pressable>
        ) : null}

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

        {!mod.textContent && !url && !mod.linkUrl ? (
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
        {objectivesLoading ? (
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
        {moduleLoading ? (
          <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
        ) : moduleDetail ? (
          renderModuleBody(moduleDetail)
        ) : null}
      </FormSheet>
    </ScreenScaffold>
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

  pressed: { opacity: 0.72 },
});
