import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { EmptyState, Select, useToast } from '../ui';
import AiActionBar from './ai/AiActionBar';
import RichText from '../RichText';
import StudentScaffold from './StudentScaffold';
import { StudentCard, StudentCardTitle } from './StudentCard';
import LimitedAccessNote from './LimitedAccessNote';
import useStudentAccess from '../../hooks/useStudentAccess';
import { ACCESS } from '../../services/student/accessService';
import { fetchCareerPreferences } from '../../services/student/careerService';
import {
  COLLEGE_TYPES,
  LO_TYPES,
  SKILL_MATCH_OPTIONS,
  fetchAbroadColleges,
  fetchCountries,
  fetchIndiaColleges,
  fetchScholarships,
  fetchSkillMatchQuestions,
  fetchStates,
  fetchTopicContent,
  skillMatchMessage,
  skillMatchScore,
} from '../../services/student/subjectCareerService';

/**
 * Subject & Career — "from classroom to career".
 *
 * THIS SCREEN HAS NO CONTENT TREE. It lists the student's own saved career preferences (the three
 * priority slots written by Profile → Career) and shows the admin's content for whichever one is
 * tapped. No preferences is a normal state with a route out, not an empty tree.
 *
 * The web is a two-pane desktop layout — preference rail on the left, tab content on the right.
 * On a phone the rail becomes a horizontal chip row above the tabs.
 *
 * Jyora and Shreya Speak are wired (`AiActionBar`). No Doubt Resolution — the website has no
 * doubt entry on this screen either.
 */

export default function SubjectCareerScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const { toast, showToast } = useToast();
  const gate = useStudentAccess('SUBJECT_CAREER');

  const [prefs, setPrefs] = useState([]);
  const [states, setStates] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [topicId, setTopicId] = useState(null);
  const [tab, setTab] = useState(LO_TYPES[0].key);

  const [content, setContent] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [scholarships, setScholarships] = useState([]);
  const [contentLoading, setContentLoading] = useState(false);

  const [stateId, setStateId] = useState('');
  const [collegeType, setCollegeType] = useState('GOVERNMENT');
  const [countryId, setCountryId] = useState('');
  const [indiaColleges, setIndiaColleges] = useState([]);
  const [abroadColleges, setAbroadColleges] = useState([]);
  const [collegesLoading, setCollegesLoading] = useState(false);

  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  /** The three reads are independent; the two lookups failing must not cost the preference list. */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [prefRes, stateRes, countryRes] = await Promise.allSettled([
      fetchCareerPreferences(),
      fetchStates(),
      fetchCountries(),
    ]);

    if (prefRes.status === 'fulfilled') {
      setPrefs(Array.isArray(prefRes.value) ? prefRes.value : []);
    } else {
      setError('Could not load your career choices.');
    }
    setStates(stateRes.status === 'fulfilled' ? stateRes.value : []);
    setCountries(countryRes.status === 'fulfilled' ? countryRes.value : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * A preference is gated by all three of its levels, most restrictive winning — locking a
   * chapter has to lock the topics beneath it.
   */
  const prefLevel = useCallback(
    (pref) =>
      gate.levelOf([
        ['CURRICULUM', pref.curriculumId],
        ['CHAPTER', pref.chapterId],
        ['TOPIC', pref.topicId],
      ]),
    [gate],
  );

  const visiblePrefs = prefs.filter(
    (pref) =>
      !gate.isHidden('CURRICULUM', pref.curriculumId) &&
      !gate.isHidden('CHAPTER', pref.chapterId) &&
      !gate.isHidden('TOPIC', pref.topicId) &&
      prefLevel(pref) !== ACCESS.HIDDEN,
  );
  const hasLocked = visiblePrefs.some((pref) => prefLevel(pref) === ACCESS.LOCKED);

  /** The three per-topic reads, each guarded — an empty tab beats a dead screen. */
  const loadTopicContent = async (id) => {
    const [c, q, s] = await Promise.allSettled([
      fetchTopicContent(id),
      fetchSkillMatchQuestions(id),
      fetchScholarships(id),
    ]);
    return {
      content: c.status === 'fulfilled' ? c.value || {} : {},
      questions: q.status === 'fulfilled' ? q.value : [],
      scholarships: s.status === 'fulfilled' ? s.value : [],
    };
  };

  const openPreference = async (pref) => {
    if (prefLevel(pref) === ACCESS.LOCKED) {
      showToast('Upgrade your plan to open this career.', 'error');
      return;
    }
    setTopicId(String(pref.topicId));
    setTab(LO_TYPES[0].key);

    // Everything below belongs to the previous topic — clearing it here rather than letting the
    // fetches overwrite piecemeal stops one topic's colleges showing under another's name.
    setContent(null);
    setQuestions([]);
    setScholarships([]);
    setIndiaColleges([]);
    setAbroadColleges([]);
    setStateId('');
    setCountryId('');
    setAnswers({});
    setShowResults(false);

    setContentLoading(true);
    const res = await loadTopicContent(pref.topicId);
    setContent(res.content);
    setQuestions(res.questions);
    setScholarships(res.scholarships);
    setContentLoading(false);
  };

  // India colleges need BOTH a state and a type; abroad needs only a country.
  useEffect(() => {
    if (!topicId || !stateId) {
      setIndiaColleges([]);
      return;
    }
    let alive = true;
    setCollegesLoading(true);
    fetchIndiaColleges(topicId, stateId, collegeType)
      .then((list) => alive && setIndiaColleges(list))
      .catch(() => alive && setIndiaColleges([]))
      .finally(() => alive && setCollegesLoading(false));
    return () => {
      alive = false;
    };
  }, [topicId, stateId, collegeType]);

  useEffect(() => {
    if (!topicId || !countryId) {
      setAbroadColleges([]);
      return;
    }
    let alive = true;
    setCollegesLoading(true);
    fetchAbroadColleges(topicId, countryId)
      .then((list) => alive && setAbroadColleges(list))
      .catch(() => alive && setAbroadColleges([]))
      .finally(() => alive && setCollegesLoading(false));
    return () => {
      alive = false;
    };
  }, [topicId, countryId]);

  const answeredCount = Object.keys(answers).length;
  const score = skillMatchScore(questions, answers);

  const openUrl = (url) => {
    if (url) Linking.openURL(url).catch(() => showToast('Could not open that link.', 'error'));
  };

  // Derived rather than a second piece of state: `topicId` already identifies the open career, and
  // a parallel `activePref` state would be one more thing to keep in step with it.
  const activePref = prefs.find((p) => String(p.topicId) === topicId) || null;

  /* ── Tab bodies ──────────────────────────────────────────────────────── */

  const renderAbout = () => (
    <StudentCard>
      <StudentCardTitle>About Courses / Eligibility / Future Job Options</StudentCardTitle>

      {/* Jyora + Shreya Speak. The web's call site hardcodes this contentLabel and falls back to
          "Subject & Career" when the preference carries no curriculum name. No Doubt Resolution —
          the website has no doubt entry on this screen either. */}
      <AiActionBar
        contentLabel="About Courses / Career Options"
        context={{
          subjectName: activePref?.curriculumName || 'Subject & Career',
          chapterName: activePref?.chapterName || '',
          topicName: activePref?.topicName || '',
          contentLabel: 'About Courses / Career Options',
          contentHtml: content?.aboutCourses || '',
        }}
      />

      {content?.aboutCourses ? (
        <RichText html={content.aboutCourses} />
      ) : (
        <Text style={styles.empty}>No course details have been added for this career yet.</Text>
      )}

      {content?.aboutCoursesVideoUrl ? (
        <Pressable
          onPress={() => openUrl(content.aboutCoursesVideoUrl)}
          style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed]}
        >
          <Ionicons name="videocam-outline" size={17} color={palette.deep} />
          <Text style={styles.mediaText}>Watch the video</Text>
        </Pressable>
      ) : null}
      {content?.aboutCoursesImageUrl ? (
        <Pressable
          onPress={() => openUrl(content.aboutCoursesImageUrl)}
          style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed]}
        >
          <Ionicons name="image-outline" size={17} color={palette.deep} />
          <Text style={styles.mediaText}>View the image</Text>
        </Pressable>
      ) : null}
      {/* Opened externally rather than embedded: react-native-pdf needs the dev client here. */}
      {content?.aboutCoursesPdfUrl ? (
        <Pressable
          onPress={() => openUrl(content.aboutCoursesPdfUrl)}
          style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed]}
        >
          <Ionicons name="document-text-outline" size={17} color={palette.deep} />
          <Text style={styles.mediaText}>Open the PDF</Text>
        </Pressable>
      ) : null}
    </StudentCard>
  );

  const renderSkillMatch = () => (
    <>
      <StudentCard>
        <StudentCardTitle>Skill Match Meter</StudentCardTitle>
        <View style={styles.legend}>
          {SKILL_MATCH_OPTIONS.map((o) => (
            <Text key={o.value} style={styles.legendItem}>
              {o.icon} {o.value} = {o.points} {o.points === 1 ? 'point' : 'points'}
            </Text>
          ))}
        </View>
        {questions.length > 0 ? (
          <>
            <Text style={styles.progressText}>
              Progress: {answeredCount} / {questions.length} answered
            </Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` },
                ]}
              />
            </View>
          </>
        ) : (
          <Text style={styles.empty}>No skill match questions available yet.</Text>
        )}
      </StudentCard>

      {showResults ? (
        <StudentCard>
          <Text style={styles.resultIcon}>🎯</Text>
          <Text style={styles.resultTitle}>Your Skill Match Score</Text>
          <Text style={styles.resultScore}>
            {score.totalScore}
            <Text style={styles.resultMax}> / {score.maxScore}</Text>
          </Text>
          <Text style={styles.resultPct}>{score.percentage}% Match</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${score.percentage}%` }]} />
          </View>
          <Text style={styles.resultMsg}>{skillMatchMessage(score.percentage)}</Text>
          <Pressable
            onPress={() => {
              setAnswers({});
              setShowResults(false);
            }}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>🔄 Retake Assessment</Text>
          </Pressable>
        </StudentCard>
      ) : null}

      {questions.map((q, index) => (
        <StudentCard key={q.id}>
          <Text style={styles.qNum}>Question {index + 1}</Text>
          <RichText html={q.questionText} />
          <View style={styles.optionRow}>
            {SKILL_MATCH_OPTIONS.map((o) => {
              const on = answers[q.id] === o.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: o.value }))}
                  disabled={showResults}
                  style={({ pressed }) => [
                    styles.option,
                    on && styles.optionOn,
                    showResults && !on && styles.optionOff,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.optionText, on && styles.optionTextOn]}>
                    {o.icon} {o.value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </StudentCard>
      ))}

      {questions.length > 0 && !showResults ? (
        <Pressable
          onPress={() => {
            if (answeredCount < questions.length) {
              showToast('Please answer all questions before submitting.', 'error');
              return;
            }
            setShowResults(true);
          }}
          style={({ pressed }) => [
            styles.primaryBtn,
            answeredCount < questions.length && styles.primaryOff,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>📊 Calculate My Score</Text>
        </Pressable>
      ) : null}
    </>
  );

  const renderCollegeList = (list, emptyWhenUnfiltered, emptyWhenFiltered, filtered) => {
    if (collegesLoading) {
      return <ActivityIndicator color={palette.primary} style={styles.loader} />;
    }
    if (!filtered) return <Text style={styles.empty}>{emptyWhenUnfiltered}</Text>;
    if (list.length === 0) return <Text style={styles.empty}>{emptyWhenFiltered}</Text>;
    return list.map((c) => (
      <StudentCard key={c.id}>
        <Text style={styles.itemName}>{c.collegeName}</Text>
        <View style={styles.linkRow}>
          {c.websiteLink ? (
            <Pressable
              onPress={() => openUrl(c.websiteLink)}
              style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
            >
              <Ionicons name="globe-outline" size={15} color={palette.deep} />
              <Text style={styles.linkText}>Website</Text>
            </Pressable>
          ) : null}
          {c.videoUrl ? (
            <Pressable
              onPress={() => openUrl(c.videoUrl)}
              style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
            >
              <Ionicons name="play-circle-outline" size={15} color={palette.deep} />
              <Text style={styles.linkText}>Watch</Text>
            </Pressable>
          ) : null}
          {!c.websiteLink && !c.videoUrl ? <Text style={styles.muted}>No links added.</Text> : null}
        </View>
      </StudentCard>
    ));
  };

  const renderIndia = () => (
    <>
      <StudentCard>
        <StudentCardTitle>Colleges in India</StudentCardTitle>
        <Select
          label="Select State"
          value={stateId}
          options={[
            { value: '', label: '-- Select State --' },
            ...states.map((s) => ({ value: String(s.id), label: s.name })),
          ]}
          onChange={setStateId}
          searchable={states.length > 12}
        />
        <View style={styles.typeRow}>
          {COLLEGE_TYPES.map((t) => {
            const on = collegeType === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setCollegeType(t.value)}
                style={({ pressed }) => [styles.type, on && styles.typeOn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.typeText, on && styles.typeTextOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </StudentCard>
      {renderCollegeList(
        indiaColleges,
        'Select a state to view colleges.',
        'No colleges found for the selected criteria.',
        !!stateId,
      )}
    </>
  );

  const renderAbroad = () => (
    <>
      <StudentCard>
        <StudentCardTitle>Colleges Abroad</StudentCardTitle>
        <Select
          label="Select Country"
          value={countryId}
          options={[
            { value: '', label: '-- Select Country --' },
            ...countries.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
          onChange={setCountryId}
          searchable={countries.length > 12}
        />
      </StudentCard>
      {renderCollegeList(
        abroadColleges,
        'Select a country to view colleges.',
        'No colleges found for the selected country.',
        !!countryId,
      )}
    </>
  );

  const renderScholarships = () =>
    scholarships.length === 0 ? (
      <StudentCard>
        <StudentCardTitle>Scholarship Details</StudentCardTitle>
        <Text style={styles.empty}>No scholarship details available yet.</Text>
      </StudentCard>
    ) : (
      scholarships.map((s) => (
        <StudentCard key={s.id}>
          <Text style={styles.itemName}>{s.scholarshipName}</Text>
          <View style={styles.linkRow}>
            {s.applyLink ? (
              <Pressable
                onPress={() => openUrl(s.applyLink)}
                style={({ pressed }) => [styles.linkBtn, styles.applyBtn, pressed && styles.pressed]}
              >
                <Ionicons name="open-outline" size={15} color={palette.onPrimary} />
                <Text style={[styles.linkText, styles.applyText]}>Apply Now</Text>
              </Pressable>
            ) : null}
            {s.videoUrl ? (
              <Pressable
                onPress={() => openUrl(s.videoUrl)}
                style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
              >
                <Ionicons name="play-circle-outline" size={15} color={palette.deep} />
                <Text style={styles.linkText}>Watch</Text>
              </Pressable>
            ) : null}
          </View>
        </StudentCard>
      ))
    );

  const renderTab = () => {
    if (contentLoading) return <ActivityIndicator color={palette.primary} style={styles.loader} />;
    switch (tab) {
      case 'about':
        return renderAbout();
      case 'skillMatch':
        return renderSkillMatch();
      case 'india':
        return renderIndia();
      case 'abroad':
        return renderAbroad();
      case 'scholarship':
        return renderScholarships();
      default:
        return null;
    }
  };

  /* ── Screen ──────────────────────────────────────────────────────────── */

  return (
    <StudentScaffold
      title="Subject & Career"
      loading={loading || gate.loading}
      error={error}
      onRetry={load}
      toast={toast}
    >
      {hasLocked ? <LimitedAccessNote /> : null}

      {visiblePrefs.length === 0 ? (
        <EmptyState
          icon="compass-outline"
          title="No career choices yet"
          message="Pick up to three career preferences in your profile, then come back here to explore each one."
          actionLabel="Go to Profile"
          onAction={() => router.push('/student/profile')}
        />
      ) : (
        <>
          <Text style={styles.railLabel}>My Career Choices</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {visiblePrefs.map((pref) => {
              const locked = prefLevel(pref) === ACCESS.LOCKED;
              const on = topicId === String(pref.topicId);
              return (
                <Pressable
                  key={pref.priority}
                  onPress={() => openPreference(pref)}
                  style={({ pressed }) => [
                    styles.pref,
                    on && styles.prefOn,
                    locked && styles.prefLocked,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: locked }}
                >
                  <View style={styles.prefTop}>
                    {locked ? (
                      <Ionicons name="lock-closed" size={11} color={SLATE[500]} />
                    ) : (
                      <Text style={[styles.prefBadge, on && styles.prefBadgeOn]}>#{pref.priority}</Text>
                    )}
                    <Text style={[styles.prefName, on && styles.prefNameOn]} numberOfLines={1}>
                      {pref.topicName}
                    </Text>
                  </View>
                  <Text style={[styles.prefSub, on && styles.prefSubOn]} numberOfLines={1}>
                    {pref.chapterName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {!topicId ? (
            <EmptyState
              icon="hand-left-outline"
              title="Pick a career choice"
              message="Tap one of your career choices above to see courses, colleges and scholarships for it."
            />
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabRow}
              >
                {LO_TYPES.map((t) => {
                  const on = tab === t.key;
                  return (
                    <Pressable
                      key={t.key}
                      onPress={() => setTab(t.key)}
                      style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.short}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {renderTab()}
            </>
          )}
        </>
      )}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },
  empty: { fontSize: TYPE.body, color: SLATE[500], lineHeight: leading(TYPE.body), paddingVertical: SPACING.sm },
  muted: { fontSize: TYPE.label, color: SLATE[500] },

  railLabel: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: SLATE[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 7,
  },
  rail: { gap: 8, paddingBottom: SPACING.md, paddingRight: SPACING.md },
  pref: {
    minWidth: 168,
    maxWidth: 230,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: p.card,
    borderWidth: 1,
    borderColor: p.cardBorder,
  },
  prefOn: { backgroundColor: p.primary, borderColor: p.primary },
  prefLocked: { opacity: 0.6 },
  prefTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prefBadge: { fontSize: TYPE.micro, fontWeight: '800', color: p.deep },
  prefBadgeOn: { color: p.onPrimary },
  prefName: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  prefNameOn: { color: p.onPrimary },
  prefSub: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2 },
  prefSubOn: { color: p.onPrimary },

  tabRow: { gap: 7, paddingBottom: SPACING.md, paddingRight: SPACING.md },
  tab: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: p.headerBorder,
  },
  tabOn: { backgroundColor: p.primary, borderColor: p.primary },
  tabText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[600] },
  tabTextOn: { color: p.onPrimary },

  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: SPACING.sm,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: p.tint,
  },
  mediaText: { fontSize: TYPE.label, fontWeight: '600', color: p.deep },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: SPACING.sm },
  legendItem: { fontSize: TYPE.caption, fontWeight: '600', color: SLATE[600] },
  progressText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[600], marginBottom: 6 },
  track: { height: 8, borderRadius: 4, backgroundColor: SLATE[200], overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: p.primaryDark },

  qNum: { fontSize: TYPE.caption, fontWeight: '800', color: p.deep, marginBottom: 4 },
  optionRow: { flexDirection: 'row', gap: 7, marginTop: SPACING.sm },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  optionOn: { backgroundColor: p.primaryDark, borderColor: p.primaryDark },
  optionOff: { opacity: 0.5 },
  optionText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700] },
  optionTextOn: { color: '#ffffff' },

  resultIcon: { fontSize: 30, textAlign: 'center' },
  resultTitle: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800], textAlign: 'center' },
  resultScore: {
    fontSize: TYPE.display,
    fontWeight: '800',
    color: p.primaryDark,
    textAlign: 'center',
    marginTop: 4,
  },
  resultMax: { fontSize: TYPE.heading, fontWeight: '600', color: SLATE[500] },
  resultPct: {
    fontSize: TYPE.body,
    fontWeight: '700',
    color: p.deep,
    textAlign: 'center',
    marginBottom: 8,
  },
  resultMsg: {
    fontSize: TYPE.label,
    color: SLATE[600],
    textAlign: 'center',
    lineHeight: leading(TYPE.label),
    marginTop: SPACING.sm,
  },

  itemName: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  linkText: { fontSize: TYPE.label, fontWeight: '600', color: p.deep },
  applyBtn: { backgroundColor: p.primary },
  applyText: { color: p.onPrimary },

  typeRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm },
  type: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  typeOn: { backgroundColor: p.primaryDark, borderColor: p.primaryDark },
  typeText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[700] },
  typeTextOn: { color: '#ffffff' },

  primaryBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.lg,
  },
  primaryOff: { backgroundColor: SLATE[400] },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  secondaryBtn: {
    alignSelf: 'center',
    marginTop: SPACING.md,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  secondaryText: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },

  pressed: { opacity: 0.78 },
}));
