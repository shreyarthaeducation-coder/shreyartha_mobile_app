import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { Card, EmptyState, ScreenScaffold, useToast } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import RichText from '../RichText';
import {
  TEACHER_SECTIONS,
  fetchChapters,
  fetchTeacherProfile,
  fetchTeacherTopicContent,
  sectionHasContent,
  subjectsFrom,
  unlinkedFrom,
} from '../../services/teacher/schoolResourcesService';

/**
 * School Resources — the website's TeacherSchoolResources (22 Oct 2026), for teachers and vice
 * principals: the e-book the school's students read, for the subjects this teacher is assigned to,
 * with each topic's Lesson Plan and without the Handwritten Notes. Read-only; the admin writes it.
 *
 * Three levels on one screen — subjects, then chapters and their topics, then a topic — and the
 * phone's Back steps up one level at a time before it leaves the screen.
 */
export default function SchoolResourcesScreen({ homeRoute }) {
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [openChapter, setOpenChapter] = useState(null);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [topic, setTopic] = useState(null);
  const [content, setContent] = useState(null);
  const [tab, setTab] = useState(TEACHER_SECTIONS[0].key);

  const loadProfile = useCallback(() => {
    setError('');
    fetchTeacherProfile()
      .then(setProfile)
      .catch((e) => setError(e?.message || 'Your subjects could not be loaded.'));
  }, []);

  useEffect(loadProfile, [loadProfile]);

  const subjects = useMemo(() => subjectsFrom(profile?.assignedClasses), [profile]);
  const unlinked = useMemo(() => unlinkedFrom(profile?.assignedClasses), [profile]);

  const openSubject = async (s) => {
    setSubject(s);
    setChapters([]);
    setOpenChapter(null);
    setChaptersLoading(true);
    try {
      const list = await fetchChapters(s.id);
      setChapters(list);
      if (list.length === 1) setOpenChapter(list[0].id);
    } catch (e) {
      showToast(e?.message || 'The chapters could not be loaded.', 'error');
    } finally {
      setChaptersLoading(false);
    }
  };

  const openTopic = async (t) => {
    setTopic(t);
    setContent(null);
    setTab(TEACHER_SECTIONS[0].key);
    try {
      const c = await fetchTeacherTopicContent(t.id);
      setContent(c || {});
      // Open on the first section that has something in it, as a reader would.
      const first = TEACHER_SECTIONS.find((s) => sectionHasContent(c, s.key));
      if (first) setTab(first.key);
    } catch (e) {
      setContent({});
      showToast(e?.message || 'This topic could not be loaded.', 'error');
    }
  };

  // Back climbs one level — topic → chapters → subjects — before it leaves the screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (topic) {
        setTopic(null);
        return true;
      }
      if (subject) {
        setSubject(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [topic, subject]);

  const openUrl = (url) => {
    if (url) Linking.openURL(url).catch(() => showToast('Could not open that link.', 'error'));
  };

  const crumbs = (
    <View style={styles.crumbs}>
      {subject ? (
        <Pressable
          onPress={() => (topic ? setTopic(null) : setSubject(null))}
          hitSlop={6}
          style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={18} color={PALETTE.primaryDark} />
          <Text style={[styles.backText, { color: PALETTE.primaryDark }]}>
            {topic ? 'Chapters' : 'Subjects'}
          </Text>
        </Pressable>
      ) : null}
      {subject ? (
        <Text style={styles.crumbText} numberOfLines={1}>
          Class {subject.className} · {subject.subjectName}
        </Text>
      ) : null}
    </View>
  );

  let body;
  if (!profile) {
    body = null;
  } else if (topic) {
    const section = TEACHER_SECTIONS.find((s) => s.key === tab);
    const video = section?.media ? content?.[`${tab}VideoUrl`] : null;
    const image = section?.media ? content?.[`${tab}ImageUrl`] : null;
    const pdf = section?.media ? content?.[`${tab}PdfUrl`] : null;
    body = (
      <>
        {crumbs}
        <Text style={styles.topicTitle}>{content?.topicName || topic.displayName || topic.name}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TEACHER_SECTIONS.map((s) => {
            const active = s.key === tab;
            const has = sectionHasContent(content, s.key);
            return (
              <Pressable
                key={s.key}
                onPress={() => setTab(s.key)}
                style={[
                  styles.tab,
                  active && { backgroundColor: PALETTE.primaryDark, borderColor: PALETTE.primaryDark },
                  !has && !active && styles.tabEmpty,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Card>
          {content == null ? (
            <ActivityIndicator color={PALETTE.primary} style={styles.loader} />
          ) : content[tab] ? (
            <RichText html={content[tab]} />
          ) : (
            <Text style={styles.empty}>Nothing has been added under this heading yet.</Text>
          )}
          {[
            [video, 'videocam-outline', 'Watch the video'],
            [image, 'image-outline', 'View the picture'],
            [pdf, 'document-text-outline', `Open the ${section?.label} PDF`],
          ]
            .filter(([url]) => url)
            .map(([url, icon, label]) => (
              <Pressable
                key={label}
                onPress={() => openUrl(url)}
                style={({ pressed }) => [styles.media, { borderColor: PALETTE.primary }, pressed && styles.pressed]}
                accessibilityRole="link"
              >
                <Ionicons name={icon} size={17} color={PALETTE.primaryDark} />
                <Text style={[styles.mediaText, { color: PALETTE.primaryDark }]}>{label}</Text>
              </Pressable>
            ))}
        </Card>
      </>
    );
  } else if (subject) {
    body = (
      <>
        {crumbs}
        {chaptersLoading ? <ActivityIndicator color={PALETTE.primary} style={styles.loader} /> : null}
        {!chaptersLoading && chapters.length === 0 ? (
          <EmptyState icon="book-outline" title="No chapters yet" message="No chapters in this subject yet." />
        ) : null}
        {chapters.map((ch) => {
          const open = openChapter === ch.id;
          const topics = ch.topics || [];
          return (
            <Card key={ch.id}>
              <Pressable
                onPress={() => setOpenChapter(open ? null : ch.id)}
                style={styles.chapterHead}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
              >
                <Text style={styles.chapterName}>{ch.name}</Text>
                <Text style={styles.count}>{topics.length}</Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={SLATE[500]} />
              </Pressable>
              {open
                ? topics.length
                  ? topics.map((t) => (
                      <Pressable
                        key={t.id}
                        onPress={() => openTopic(t)}
                        style={({ pressed }) => [styles.topicRow, pressed && styles.pressed]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.topicName}>{t.displayName || t.name}</Text>
                        <Ionicons name="chevron-forward" size={16} color={SLATE[400]} />
                      </Pressable>
                    ))
                  : [<Text key="none" style={styles.empty}>No topics yet.</Text>]
                : null}
            </Card>
          );
        })}
      </>
    );
  } else {
    body = (
      <>
        <Text style={styles.blurb}>The topics your students read, with each topic&apos;s Lesson Plan.</Text>
        {subjects.length === 0 ? (
          <EmptyState
            icon="library-outline"
            title="No subjects yet"
            message="None of the subjects you are assigned to is linked to the syllabus yet."
          />
        ) : (
          subjects.map((s) => (
            <Pressable key={s.id} onPress={() => openSubject(s)} accessibilityRole="button">
              {({ pressed }) => (
                <Card style={pressed ? styles.pressed : null}>
                  <View style={styles.subjectRow}>
                    <View style={styles.flex}>
                      <Text style={styles.subjectName}>
                        Class {s.className} · {s.subjectName}
                      </Text>
                      <Text style={styles.count}>{s.sections.join(', ')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={SLATE[400]} />
                  </View>
                </Card>
              )}
            </Pressable>
          ))
        )}
        {unlinked.length ? (
          <Text style={styles.note}>Not linked to the syllabus, so nothing to show: {unlinked.join('; ')}.</Text>
        ) : null}
      </>
    );
  }

  return (
    <ScreenScaffold
      title="School Resources"
      fallbackRoute={homeRoute}
      loading={!profile && !error}
      error={error}
      onRetry={loadProfile}
      toast={toast}
      contentStyle={styles.content}
    >
      {body}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: SPACING.sm },
  loader: { marginVertical: SPACING.md },
  blurb: { fontSize: TYPE.body, color: SLATE[600] },
  note: { fontSize: TYPE.caption, color: SLATE[500] },
  crumbs: { gap: 2 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: TYPE.label, fontWeight: '700' },
  crumbText: { fontSize: TYPE.label, color: SLATE[600] },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  subjectName: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[900] },
  count: { fontSize: TYPE.caption, color: SLATE[500] },
  chapterHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  chapterName: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
    marginTop: 6,
  },
  topicName: { flex: 1, fontSize: TYPE.body, color: SLATE[800] },
  topicTitle: { fontSize: TYPE.title, fontWeight: '700', color: SLATE[900] },
  tabs: { gap: 6, paddingVertical: 4 },
  tab: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: SLATE[200], backgroundColor: '#ffffff' },
  tabEmpty: { opacity: 0.55 },
  tabText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700] },
  tabTextActive: { color: '#ffffff' },
  empty: { fontSize: TYPE.body, color: SLATE[500], paddingVertical: SPACING.sm },
  media: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: SPACING.sm,
  },
  mediaText: { fontSize: TYPE.label, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
