import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BAND, FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { EmptyState, useToast } from '../../ui';
import RichText from '../../RichText';
import StudentScaffold from '../StudentScaffold';
import { StudentCard, StudentCardTitle, StudentNote } from '../StudentCard';
import AiActionBar from '../ai/AiActionBar';
import LimitedAccessNote from '../LimitedAccessNote';
import RecordYourVoice from './RecordYourVoice';
import UnderstandingTest from '../skillsedge/UnderstandingTest';
import useStudentAccess from '../../../hooks/useStudentAccess';
import { ACCESS } from '../../../services/student/accessService';
import {
  LANGUAGE_SKILLS,
  fetchPersonalized,
  fetchStudentClass,
  fetchTopicContent,
  fetchTree,
  fetchUnderstandingQuestions,
  resolveLanguageClass,
} from '../../../services/student/languageProService';

/**
 * Language Pro resources — ONE screen serving both of the website's resource pages.
 *
 * `source` picks which, exactly as `academiciq/ResourcesScreen` does for Academic IQ:
 *
 *   'school'        `/api/languagepro/tree` — the full syllabus, narrowed to the student's class.
 *                   Titled "College Resources" for a college student, "School Resources" otherwise.
 *   'personalized'  `/api/languagepro/personalized` — the level-matched subset, plus a strip
 *                   showing the student's level in each of the four skills.
 *
 * ── DO NOT CALL `/api/languagepro/school` ────────────────────────────────────
 * It exists and it is DEAD: its body calls the same personalized service, and the comment in
 * `LanguageProStudentController` admits the unfiltered override was never implemented. Calling it
 * for School Resources would quietly serve the FILTERED payload. The web uses `/tree` here and so
 * do we.
 *
 * ── THE STEP-DOWN IS THE SERVER'S JOB ────────────────────────────────────────
 * The web walks down a class per weakness (`average` → −1, `beginner` → −2) in the browser. The
 * backend already does this and returns `curriculums` (current class) plus
 * `previousClassCurriculums`. Re-deriving it here would double-apply it.
 */

const isPersonalized = (source) => source === 'personalized';

/** The four-skill level strip. Personalized only — it is the reason that page is filtered. */
function SkillLevels({ allSkills, styles }) {
  const levels = LANGUAGE_SKILLS.map((skill) => ({
    skill,
    level: allSkills?.[skill] || 'Not Set',
  }));
  return (
    <StudentCard>
      <StudentCardTitle>Your English level</StudentCardTitle>
      <View style={styles.skillRow}>
        {levels.map(({ skill, level }) => (
          <View key={skill} style={styles.skillCell}>
            <Text style={styles.skillName}>{skill}</Text>
            <Text style={[styles.skillLevel, styles[`level${level.replace(/\s/g, '')}`]]}>
              {level}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.skillNote}>
        These resources are chosen for the skills you are still building.
      </Text>
    </StudentCard>
  );
}

export default function LanguageProResources({ source = 'school' }) {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const gate = useStudentAccess('LANGUAGE_PRO');
  const personalized = isPersonalized(source);

  const [curriculums, setCurriculums] = useState([]);
  const [studentClass, setStudentClass] = useState(null);
  const [isCollege, setIsCollege] = useState(false);
  const [skills, setSkills] = useState(null);
  const [proficient, setProficient] = useState(false);

  const [curriculum, setCurriculum] = useState(null);
  const [matchedClass, setMatchedClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [openChapter, setOpenChapter] = useState(null);
  const [topic, setTopic] = useState(null);
  const [content, setContent] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [mode, setMode] = useState('content'); // content | speak | test

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const [dataRes, classRes] = await Promise.allSettled([
      personalized ? fetchPersonalized() : fetchTree(),
      fetchStudentClass(),
    ]);

    if (dataRes.status !== 'fulfilled') {
      setError('Failed to load Language Pro.');
      setLoading(false);
      return;
    }

    if (personalized) {
      const p = dataRes.value;
      // Current-class matches first, then the step-down set the server already resolved.
      setCurriculums([...p.curriculums, ...p.previousClassCurriculums]);
      setSkills(p.allSkills);
      setProficient(p.fullyProficient);
    } else {
      setCurriculums(dataRes.value);
    }

    const who = classRes.status === 'fulfilled' ? classRes.value : null;
    setStudentClass(who?.className ?? null);
    setIsCollege(!!who?.isCollege);
    setLoading(false);
  }, [personalized]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * School / College Resources open straight on the content, exactly as the website does.
   *
   * The website takes `tree[0]`, sets it, and never renders its name
   * (LanguageProSchoolResources.js:87-88). This screen started with `curriculum === null` and so
   * fell through to a curriculum PICKER that the web has no equivalent of. That picker was the
   * only thing printing the board name — which is how an admin-authored curriculum row called
   * "ICSE+CBSE" reached the screen. The string is data, not source, so the fix is to stop
   * rendering the step rather than to filter the text.
   *
   * Personalized deliberately keeps its list: those curriculums are the class-step-down set the
   * server has already narrowed, and collapsing them to the first would hide exactly the content
   * that page exists to show. It gets class-named rows instead — see renderCurriculums.
   *
   * Waits for `gate.loading` and selects from `gate.visible(...)` rather than the raw array: the
   * picker used to be where the hidden-node filter and the LOCKED check were applied, so
   * auto-selecting the raw first element would open a curriculum the student cannot access.
   */
  useEffect(() => {
    if (personalized || gate.loading || curriculum || curriculums.length === 0) return;
    const first = gate.visible('CURRICULUM', curriculums)[0];
    if (!first || gate.level('CURRICULUM', first.id) === ACCESS.LOCKED) return;
    setCurriculum(first);
    setMatchedClass(resolveLanguageClass(first, studentClass, isCollege));
  }, [personalized, gate, curriculum, curriculums, studentClass, isCollege]);

  const openCurriculum = (c) => {
    if (gate.level('CURRICULUM', c.id) === ACCESS.LOCKED) {
      showToast('Upgrade your plan to access this curriculum.', 'error');
      return;
    }
    setCurriculum(c);
    setTopic(null);
    setOpenChapter(null);
    // College → classes[0]; school → a real name match or NOTHING. The blind `|| classes[0]`
    // fallback that used to be here is the same defect that showed a Class 6 student the Class 9
    // Coding Pro syllabus.
    //
    // Personalized is the exception: the server has ALREADY narrowed these curriculums to the
    // right class (including stepping down a class or two), so matching again against the
    // student's own class would discard exactly the content this page exists to show.
    setMatchedClass(
      personalized
        ? (c.classes || [])[0] || null
        : resolveLanguageClass(c, studentClass, isCollege),
    );
  };

  const openTopic = async (t, chapter) => {
    if (gate.level('TOPIC', t.id) === ACCESS.LOCKED) {
      showToast('Upgrade your plan to open this topic.', 'error');
      return;
    }
    setTopic({ ...t, chapterName: chapter.name, chapterId: chapter.id });
    setMode('content');
    setContent(null);
    setContentLoading(true);
    try {
      setContent(await fetchTopicContent(t.id));
    } catch {
      setContent({});
    } finally {
      setContentLoading(false);
    }
  };

  const chapters = gate.visible('CHAPTER', matchedClass?.chapters || []);

  // The line the student reads aloud. Falls back through the content shapes the topic can carry.
  const referenceText =
    content?.readingText || content?.passage || content?.content || topic?.name || '';

  /* ── Topic ───────────────────────────────────────────────────────────── */

  const renderTopic = () => (
    <>
      <View style={styles.modeRow}>
        {[
          { key: 'content', label: 'Read' },
          { key: 'speak', label: 'Speak' },
          { key: 'test', label: 'Test' },
        ].map((m) => {
          const on = mode === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              style={({ pressed }) => [styles.mode, on && styles.modeOn, pressed && styles.pressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.modeText, on && styles.modeTextOn]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'speak' ? (
        <RecordYourVoice
          key={`rv-${topic.id}`}
          topicId={topic.id}
          referenceText={referenceText}
          showToast={showToast}
        />
      ) : mode === 'test' ? (
        <UnderstandingTest
          key={`u-${topic.chapterId}`}
          // Keyed by CHAPTER, not topic — that is what this endpoint takes.
          moduleId={topic.chapterId}
          loadQuestions={fetchUnderstandingQuestions}
          showToast={showToast}
          topicName={topic.name}
          subjectName="Language Pro"
          chapterName={topic.chapterName}
        />
      ) : contentLoading ? (
        <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />
      ) : (
        <StudentCard>
          <StudentCardTitle>{topic.name}</StudentCardTitle>

          {/* The web hardcodes `subjectName="Language Pro"` and `contentLabel="Topic Content"` at
              both LanguagePro call sites. */}
          <AiActionBar
            contentLabel="Topic Content"
            context={{
              boardName: curriculum?.name || '',
              className: matchedClass?.name || '',
              subjectName: 'Language Pro',
              chapterName: topic.chapterName,
              topicName: topic.name,
              contentLabel: 'Topic Content',
              contentHtml: referenceText || '',
            }}
          />

          {referenceText ? (
            <RichText html={referenceText} />
          ) : (
            <StudentNote>No content has been added for this topic yet.</StudentNote>
          )}
        </StudentCard>
      )}
    </>
  );

  /* ── Tree ────────────────────────────────────────────────────────────── */

  const renderChapters = () => {
    // Two distinct empty states: "we could not find your class" sends the student to their
    // profile, "no chapters" sends them to waiting. Personalized never shows the first, because
    // its classes come pre-resolved from the server.
    if (!matchedClass && !personalized) {
      return (
        <StudentCard>
          <StudentNote>
            No content found for your class ({studentClass || 'unknown'}).
          </StudentNote>
          <Text style={styles.emptyHint}>
            Check that the class on your profile matches how your school has named it.
          </Text>
        </StudentCard>
      );
    }
    if (chapters.length === 0) {
      return (
        <StudentCard>
          <StudentNote>
            No Language Pro content for {matchedClass?.name || 'your class'} yet.
          </StudentNote>
        </StudentCard>
      );
    }
    return chapters.map((chapter) => {
      const open = openChapter === chapter.id;
      const topics = gate.visible('TOPIC', chapter.topics || []);
      return (
        <StudentCard key={chapter.id}>
          <Pressable
            onPress={() => setOpenChapter(open ? null : chapter.id)}
            style={({ pressed }) => [styles.rowHead, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
          >
            <Text style={styles.chapterName}>{chapter.name}</Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={palette.deep} />
          </Pressable>
          {open
            ? topics.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => openTopic(t, chapter)}
                  style={({ pressed }) => [styles.topic, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={13} color={palette.deep} />
                  <Text style={styles.topicName}>{t.name}</Text>
                </Pressable>
              ))
            : null}
        </StudentCard>
      );
    });
  };

  const renderCurriculums = () => {
    const visible = gate.visible('CURRICULUM', curriculums);

    if (personalized && proficient) {
      return (
        <EmptyState
          icon="ribbon-outline"
          title="You're proficient in every skill"
          message="Nothing extra has been set aside for you. Use School Resources to keep practising."
        />
      );
    }
    if (visible.length === 0) {
      return (
        <EmptyState
          icon="language-outline"
          title={personalized ? 'Nothing personalised yet' : 'No curriculums yet'}
          message={
            personalized
              ? 'Once your English level is recorded, matching resources will appear here.'
              : 'No Language Pro curriculums have been published yet.'
          }
        />
      );
    }
    return visible.map((c) => {
      const locked = gate.level('CURRICULUM', c.id) === ACCESS.LOCKED;
      // Labelled by the CLASS it holds, never by `c.name`.
      //
      // `c.name` is the curriculum row's admin-authored board name — values like "ICSE+CBSE" —
      // and the website prints it nowhere: School Resources auto-selects tree[0] silently, and
      // Personalized renders skill cards. This list still has to exist (it is the class-step-down
      // set the server resolved) but what distinguishes one row from another here is the class,
      // which is also the only part the student can act on.
      const label = (c.classes || [])[0]?.name || 'Recommended resources';
      return (
        <Pressable
          key={c.id}
          onPress={() => openCurriculum(c)}
          style={({ pressed }) => [pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <StudentCard>
            <View style={styles.rowHead}>
              <View style={styles.iconWrap}>
                <Ionicons
                  name={locked ? 'lock-closed' : 'library-outline'}
                  size={19}
                  color={locked ? SLATE[400] : palette.deep}
                />
              </View>
              <View style={styles.linkText}>
                <Text style={styles.linkTitle}>{label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={palette.deep} />
            </View>
          </StudentCard>
        </Pressable>
      );
    });
  };

  const title = personalized
    ? 'Personalized Resources'
    : isCollege
      ? 'College Resources'
      : 'School Resources';

  return (
    <StudentScaffold
      title={title}
      loading={loading || gate.loading}
      error={error}
      onRetry={load}
      toast={toast}
    >
      {gate.limited && !gate.loading ? <LimitedAccessNote /> : null}

      {/* The crumb is only a back control once there is somewhere in-screen to go back TO. With
          the picker gone from School/College Resources, clearing `curriculum` there would drop the
          student on an empty step that no longer renders — so at the top level the crumb is plain
          text and the header's own back button leaves the screen.

          `curriculum.name` is deliberately absent from the trail: it is the board name, and the
          website shows it in neither mode. Class › chapter › topic is what the web's own heading
          hierarchy gives. */}
      {curriculum ? (
        (() => {
          const trail = [matchedClass?.name, topic?.chapterName, topic?.name]
            .filter(Boolean)
            .join(' › ');
          const canGoBack = !!topic || personalized;
          if (!canGoBack) {
            return trail ? (
              <View style={styles.crumb}>
                <Text style={styles.crumbText} numberOfLines={1}>
                  {trail}
                </Text>
              </View>
            ) : null;
          }
          return (
            <Pressable
              onPress={() => {
                if (topic) {
                  setTopic(null);
                  return;
                }
                setCurriculum(null);
                setMatchedClass(null);
              }}
              style={({ pressed }) => [styles.crumb, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={14} color={palette.onDark} />
              <Text style={styles.crumbText} numberOfLines={1}>
                {trail}
              </Text>
            </Pressable>
          );
        })()
      ) : null}

      {!curriculum && personalized && skills ? <SkillLevels allSkills={skills} styles={styles} /> : null}

      {topic ? renderTopic() : curriculum ? renderChapters() : renderCurriculums()}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },
  emptyHint: { fontSize: TYPE.label, color: SLATE[400], lineHeight: 18, marginTop: 6 },

  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: p.glass,
    borderWidth: 1,
    borderColor: p.glassBorder,
    marginBottom: SPACING.md,
  },
  crumbText: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: p.onDark },

  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  linkText: { flex: 1 },
  linkTitle: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },

  chapterName: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingLeft: 4 },
  topicName: { flex: 1, fontSize: TYPE.label, color: SLATE[600] },

  modeRow: { flexDirection: 'row', gap: 7, marginBottom: SPACING.md },
  mode: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: p.headerBorder,
  },
  modeOn: { backgroundColor: p.primary, borderColor: p.primary },
  modeText: { fontSize: TYPE.label, fontWeight: '600', color: p.onDark },
  modeTextOn: { color: p.onPrimary },

  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACING.sm },
  skillCell: {
    flexGrow: 1,
    flexBasis: '46%',
    padding: 10,
    borderRadius: 11,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  skillName: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[600] },
  skillLevel: { fontSize: TYPE.body, fontWeight: '800', marginTop: 3, color: SLATE[500] },
  levelBeginner: { color: FEEDBACK.errorText },
  levelAverage: { color: BAND.fair },
  levelProficient: { color: FEEDBACK.successText },
  levelNotSet: { color: SLATE[400] },
  skillNote: { fontSize: TYPE.caption, color: SLATE[500], lineHeight: 17, marginTop: SPACING.sm },

  pressed: { opacity: 0.78 },
}));
