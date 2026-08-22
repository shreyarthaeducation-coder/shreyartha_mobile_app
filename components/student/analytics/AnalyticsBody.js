import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BAND, FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { ProgressBar } from '../../ui';
import PsychometricSummary from '../psychometric/PsychometricSummary';
import {
  GAP_LEVELS,
  NO_PROGRESS_REMARK,
  PENDING_REFLECTION,
  REFLECTION_BADGE,
  completedPercentOf,
  getProgressRemark,
  mockStatusStyle,
  progressPercent,
  progressPercentOf,
  progressStars,
  progressTopicIcon,
  statusStyle,
  syllabusPercent,
  syllabusStars,
  weakMocksOf,
} from '../../../constants/analytics';
import {
  codingStreams,
  competitiveOf,
  hasPsychometricResults,
} from '../../../services/student/analyticsService';

/**
 * The analytics sections, with NO page chrome and NO fetching.
 *
 * Shared by the student panel and the parent portal. It is the same data by construction: every
 * parent endpoint resolves the linked child and calls the very same service method, so both return
 * an identical `StudentAnalyticsResponse`.
 *
 * ── THE CARDS ARE INJECTED, AND THAT IS NOT OPTIONAL ─────────────────────────
 * `StudentCard` paints a translucent white tuned for the student panel's photographic background;
 * on the parent's opaque slate page it is nearly invisible. Each portal passes its own pair. **Do
 * not add a default** — it would produce a screen that renders, holds the right data, and cannot be
 * read, which is exactly the failure that mis-themed the whole student panel for two phases.
 *
 * ── ONE SPINE, MANY OPTIONAL ENRICHMENTS ─────────────────────────────────────
 * `analytics` renders the page; each entry in `parts` refines one section and may fail. A free
 * student legitimately 403s on several, so every section reads the spine first and shows LESS —
 * never nothing. If this ever blanks for a free student, that guarantee is broken.
 *
 * ── HIDDEN NODES ARE THE PARENT'S PROBLEM TOO ────────────────────────────────
 * The syllabus and progress trees below render admin-authored subjects, chapters and topics. The
 * parent portal filters hidden nodes OUTSIDE this component, so without `filterNodes` it would show
 * a parent content an admin has hidden. Each portal passes its own filter; the default is identity,
 * which is right for the student (whose own screens gate at the tree, not here).
 *
 * @param {Function} [props.filterNodes] (entityType, list) => list
 */

const STAR_MAX = 5;

function Stars({ rating }) {
  const styles = useStyles();
  const value = Math.max(0, Math.min(STAR_MAX, Number(rating) || 0));
  return (
    <View style={styles.stars}>
      {Array.from({ length: STAR_MAX }, (_, i) => (
        <Ionicons
          key={i}
          name={i < value ? 'star' : 'star-outline'}
          size={13}
          color={i < value ? BAND.fair : SLATE[300]}
        />
      ))}
    </View>
  );
}

function Unavailable({ forbidden }) {
  const styles = useStyles();
  return (
    <Text style={styles.unavailable}>
      {forbidden
        ? 'Not included in your current plan.'
        : 'Nothing recorded yet — it will appear here once you start.'}
    </Text>
  );
}

/** A tappable header that reveals its children. Used by every expandable row on this screen. */
function Expander({ label, open, onPress, right, children, styles }) {
  return (
    <>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.expRow, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.expLabel}>{label}</Text>
        {right}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={SLATE[400]} />
      </Pressable>
      {open ? <View style={styles.expBody}>{children}</View> : null}
    </>
  );
}

function StatStrip({ stats, styles }) {
  return (
    <View style={styles.strip}>
      {stats.map(([value, label, color]) => (
        <View key={label} style={styles.stat}>
          <Text style={[styles.statValue, color && { color }]}>{value ?? 0}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function AnalyticsBody({
  analytics,
  parts = {},
  Card,
  CardTitle,
  showPsychometric = true,
  onOpenPsychometric,
  onOpenCareer,
  filterNodes = (type, list) => list,
  openExam,
  onToggleExam,
  mockTests = {},
}) {
  const styles = useStyles();
  const palette = usePalette();

  // Expand state lives HERE, not in the callers. `openExam`/`mockTests` are caller-held for
  // historical reasons and adding more of those would mean updating two screens in lockstep.
  const [section, setSection] = useState('');
  const [openSubject, setOpenSubject] = useState('');
  const [openChapter, setOpenChapter] = useState('');
  const [openGap, setOpenGap] = useState('');
  const [openSkill, setOpenSkill] = useState('');
  const [statementOpen, setStatementOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);

  const part = (key) => parts[key] || { data: null, error: null, forbidden: false };

  const academic = analytics?.academicIQ;
  const syllabus = part('syllabus').data;
  const progress = part('progress').data;
  const gaps = part('learningGaps').data;
  const iqHistory = part('iqHistory').data;
  const competitive = competitiveOf(part('competitive').data) || analytics?.competitiveExam;
  const streams = codingStreams(part('coding').data, analytics);
  const skillsProfile = part('skillsProfile').data;
  const skillsProgress = part('skillsProgress').data;
  const skillsTree = part('skillsTree').data;
  const psychResults = part('psychResults').data;
  const lang = analytics?.languageLab;

  const syllabusPct = syllabusPercent(syllabus, academic);
  const progressPct = progressPercent(progress, academic);

  const toggle = (setter, current) => (next) => setter(current === next ? '' : next);

  /* ── Subject → chapter → topic accordion, shared by both trees ─────────── */

  const renderTree = (subjects, kind) =>
    filterNodes('SUBJECT', subjects || []).map((s) => {
      const key = `${kind}-${s.subjectName}`;
      const open = openSubject === key;
      const style = statusStyle(s.status);
      const pct = Math.round(kind === 'progress' ? s.progressPercent || 0 : s.completionPercent || 0);
      return (
        <View key={key}>
          <Expander
            styles={styles}
            label={s.subjectName}
            open={open}
            onPress={() => {
              toggle(setOpenSubject, openSubject)(key);
              setOpenChapter('');
            }}
            right={
              <Text style={[styles.badge, { backgroundColor: style.bg, color: style.fg }]}>
                {kind === 'progress'
                  ? `${s.reflectedTopics ?? 0}/${s.coveredTopics ?? 0} topics • ${pct}%`
                  : `${s.completedTopics ?? 0}/${s.totalTopics ?? 0} (${pct}%)`}
              </Text>
            }
          >
            {filterNodes('CHAPTER', s.chapters || []).map((c) => {
              const ck = `${key}-${c.chapterName}`;
              const cOpen = openChapter === ck;
              const cDone = kind === 'progress' ? c.completed : c.status === 'COMPLETED';
              return (
                <View key={ck}>
                  <Expander
                    styles={styles}
                    label={`${cDone ? '✅ ' : ''}${c.chapterName}`}
                    open={cOpen}
                    onPress={() => toggle(setOpenChapter, openChapter)(ck)}
                    right={
                      <Text style={styles.count}>
                        {kind === 'progress'
                          ? `${c.reflectedTopics ?? 0}/${c.coveredTopics ?? 0}`
                          : `${c.completedTopics ?? 0}/${c.totalTopics ?? 0}`}
                      </Text>
                    }
                  >
                    {filterNodes('TOPIC', c.topics || []).map((t) => (
                      <View key={t.topicName} style={styles.topicRow}>
                        {/* Syllabus topics use the plain `completed` boolean; progress topics use
                            the three-way reflected/covered/neither. A topic carries no `status`. */}
                        <Text style={styles.topicIcon}>
                          {kind === 'progress'
                            ? progressTopicIcon(t)
                            : t.completed
                              ? '✅'
                              : '⬜'}
                        </Text>
                        <Text style={styles.topicName}>{t.topicName}</Text>
                        {kind === 'progress' && t.reflectedByStudent && t.reflectionLevel ? (
                          <Text
                            style={[
                              styles.levelPill,
                              { backgroundColor: REFLECTION_BADGE[t.reflectionLevel] || SLATE[400] },
                            ]}
                          >
                            {t.reflectionLevel}
                          </Text>
                        ) : null}
                        {kind === 'progress' && t.coveredByTeacher && !t.reflectedByStudent ? (
                          <Text style={styles.pending}>{PENDING_REFLECTION}</Text>
                        ) : null}
                      </View>
                    ))}
                  </Expander>
                </View>
              );
            })}
          </Expander>
        </View>
      );
    });

  /* ── Competitive exam ─────────────────────────────────────────────────── */

  const examTabs = competitive?.examTabs || competitive?.tabs || [];
  const selectedTab = selectedExam
    ? examTabs.find((t) => String(t.examId) === String(selectedExam))
    : null;
  const cePct = completedPercentOf(competitive, selectedTab);
  const ceProgress = progressPercentOf(competitive, selectedTab);
  const weakMocks = weakMocksOf(competitive, selectedTab);

  const pickExam = (exam) => {
    // Selecting filters the whole section AND expands its papers; re-tapping clears both, which is
    // what the web's "Show All" also does.
    const next = String(selectedExam) === String(exam.id) ? null : exam.id;
    setSelectedExam(next);
    if (next) onToggleExam?.(exam);
    else if (openExam) onToggleExam?.(exam);
  };

  return (
    <>
      {/* ── Who ─────────────────────────────────────────────────────────── */}
      <Card style={styles.identity}>
        {analytics?.profilePicture ? (
          <Image source={{ uri: analytics.profilePicture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarBlank]}>
            <Ionicons name="person" size={26} color={palette.deep} />
          </View>
        )}
        <View style={styles.identityText}>
          <Text style={styles.name}>{analytics?.fullName || 'Student'}</Text>
          <Text style={styles.meta}>
            {[analytics?.currentClass && `Class ${analytics.currentClass}`, analytics?.stream]
              .filter(Boolean)
              .join(' · ') || '—'}
          </Text>
          {analytics?.careerInterest ? (
            <Text style={styles.meta}>Interest: {analytics.careerInterest}</Text>
          ) : null}
        </View>
      </Card>

      {/* ── Career choices ──────────────────────────────────────────────── */}
      <Card>
        <CardTitle>🎯 Career Choices</CardTitle>
        {(analytics?.careerPreferences || []).length > 0 ? (
          analytics.careerPreferences.map((p) => (
            <Pressable
              key={p.priority}
              onPress={() => onOpenCareer?.(p)}
              disabled={!onOpenCareer}
              style={({ pressed }) => [styles.careerRow, pressed && styles.pressed]}
              accessibilityRole={onOpenCareer ? 'button' : 'text'}
            >
              <Text style={styles.priority}>#{p.priority}</Text>
              <View style={styles.careerText}>
                <Text style={styles.careerName}>{p.topicName}</Text>
                {p.chapterName ? <Text style={styles.careerPath}>{p.chapterName}</Text> : null}
              </View>
              {onOpenCareer ? (
                <Ionicons name="chevron-forward" size={15} color={palette.deep} />
              ) : null}
            </Pressable>
          ))
        ) : (
          <Text style={styles.body}>Not set — update in Profile.</Text>
        )}
      </Card>

      {analytics?.personalStatement ? (
        <Card>
          <CardTitle>My Personal Statement</CardTitle>
          {/* The web renders this unclamped. An SOP runs to several hundred words and would push
              every section below it off a phone screen, so it collapses — the full text is one tap
              away, which keeps this chrome rather than a data divergence. */}
          <Text style={styles.body} numberOfLines={statementOpen ? undefined : 4}>
            {analytics.personalStatement}
          </Text>
          <Pressable
            onPress={() => setStatementOpen((v) => !v)}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>{statementOpen ? 'Show less' : 'Read more'}</Text>
          </Pressable>
        </Card>
      ) : null}

      {/* ── Psychometric ─────────────────────────────────────────────────── */}
      {showPsychometric ? (
        <Card>
          <CardTitle>🧠 Psychometric Assessment</CardTitle>
          {hasPsychometricResults(psychResults) ? (
            <>
              <PsychometricSummary results={psychResults} />
              <Pressable
                onPress={onOpenPsychometric}
                style={({ pressed }) => [styles.link, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.linkText}>Open Psychometric Assessment</Text>
                <Ionicons name="chevron-forward" size={14} color={palette.deep} />
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.body}>You haven&apos;t completed the assessment yet.</Text>
              <Pressable
                onPress={onOpenPsychometric}
                style={({ pressed }) => [styles.link, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.linkText}>Take the assessment</Text>
                <Ionicons name="chevron-forward" size={14} color={palette.deep} />
              </Pressable>
            </>
          )}
        </Card>
      ) : null}

      {/* ── Academic IQ ─────────────────────────────────────────────────── */}
      <Card>
        <CardTitle>📚 Academic IQ</CardTitle>
        {academic || syllabus || progress ? (
          <>
            {/* Syllabus Completion — stars 90/70/50/30, computed here, not taken from the server. */}
            <Expander
              styles={styles}
              label="Syllabus Completion"
              open={section === 'syllabus'}
              onPress={() => toggle(setSection, section)('syllabus')}
              right={<Stars rating={syllabusStars(syllabusPct)} />}
            >
              <StatStrip
                styles={styles}
                stats={[
                  [syllabus?.totalSubjects, 'Subjects'],
                  [syllabus?.totalChapters, 'Chapters'],
                  [syllabus?.totalTopics, 'Total Topics'],
                  [syllabus?.completedTopics, '✅ Completed', '#4caf50'],
                  [syllabus?.notCompletedTopics, '⬜ Remaining', '#ff9800'],
                ]}
              />
              {renderTree(syllabus?.subjects, 'syllabus')}
            </Expander>
            <ProgressBar value={syllabusPct} color="#4caf50" style={styles.bar} />

            {/* My Personalized Resources — the Academic IQ change log. Both services already fetch
                it; until now neither rendered it. */}
            <Expander
              styles={styles}
              label="My Personalized Resources"
              open={section === 'history'}
              onPress={() => toggle(setSection, section)('history')}
            >
              {(iqHistory || []).length > 0 ? (
                iqHistory.map((h, i) => (
                  <View key={h.id ?? i} style={styles.historyRow}>
                    <Text style={styles.historyTitle}>
                      {i === 0 ? 'Initial Save' : `Edit #${i}`}
                      {h.savedAt ? ` · ${new Date(h.savedAt).toLocaleDateString()}` : ''}
                    </Text>
                    {[
                      ['Curriculum', h.curriculumName],
                      ['Class', h.className],
                      ['Subjects', (h.subjects || []).join(', ')],
                      ['Chapters', (h.chapters || []).join(', ')],
                      ['Topics', (h.topics || []).join(', ')],
                      ['Competitive Exam', h.competitiveExamName],
                    ]
                      .filter(([, v]) => v)
                      .map(([label, v]) => (
                        <Text key={label} style={styles.historyLine}>
                          {label}: {v}
                        </Text>
                      ))}
                  </View>
                ))
              ) : (
                <Text style={styles.body}>No changes recorded yet.</Text>
              )}
            </Expander>

            {/* My Progress — stars 80/60/40/20. A DIFFERENT ladder from the syllabus one. */}
            <Expander
              styles={styles}
              label="My Progress"
              open={section === 'progress'}
              onPress={() => toggle(setSection, section)('progress')}
              right={
                <View style={styles.rightGroup}>
                  <Stars rating={progressStars(progressPct)} />
                  {academic?.learningGapsCount ? (
                    <Text style={styles.warn}>{'⚠️'.repeat(Math.min(academic.learningGapsCount, 5))}</Text>
                  ) : null}
                </View>
              }
            >
              <StatStrip
                styles={styles}
                stats={[
                  [progress?.totalCoveredTopics, 'Covered by Teacher'],
                  [progress?.studentReflectedTopics, 'Reflected by You', '#4caf50'],
                  [progress?.totalSubjects, 'Subjects'],
                  [progress?.totalChapters, 'Chapters'],
                ]}
              />
              {renderTree(progress?.subjects, 'progress')}
            </Expander>
            <ProgressBar value={progressPct} color="#2196f3" style={styles.bar} />
          </>
        ) : (
          <Unavailable forbidden={part('syllabus').forbidden} />
        )}
      </Card>

      {/* ── My Learning Gaps ────────────────────────────────────────────── */}
      <Card>
        <CardTitle>My Learning Gaps</CardTitle>
        <View style={styles.gapRow}>
          {GAP_LEVELS.map((g) => (
            <Pressable
              key={g.key}
              onPress={() => toggle(setOpenGap, openGap)(g.key)}
              style={({ pressed }) => [styles.gapChip, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ expanded: openGap === g.key }}
            >
              <View style={[styles.dot, { backgroundColor: g.color }]} />
              <Text style={styles.gapLabel}>{g.label}</Text>
              <Text style={styles.gapCount}>{gaps?.learningGaps?.[g.key] ?? 0}</Text>
            </Pressable>
          ))}
        </View>

        {GAP_LEVELS.filter((g) => openGap === g.key).map((g) => {
          const topics = gaps?.topicsByLevel?.[g.key] || gaps?.[g.key] || [];
          return (
            <View key={g.key} style={[styles.gapPanel, { borderLeftColor: g.color }]}>
              <Text style={[styles.gapTemplate, { color: g.color }]}>{g.template}</Text>
              {topics.length > 0 ? (
                topics.map((t, i) => (
                  <Text key={`${t.topicName}-${i}`} style={styles.gapTopic}>
                    {i + 1}- {t.topicName}
                    {/* The path shows only when BOTH names exist, as on the web. */}
                    {t.subjectName && t.chapterName
                      ? ` (${t.subjectName} › ${t.chapterName})`
                      : ''}
                  </Text>
                ))
              ) : (
                <Text style={styles.body}>No topics at this level yet.</Text>
              )}
            </View>
          );
        })}
      </Card>

      {/* ── Competitive Exam ────────────────────────────────────────────── */}
      <Card>
        <CardTitle>🏆 Competitive Exam</CardTitle>
        {competitive ? (
          <>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Target:</Text>
              <Text style={styles.metricValue}>
                {competitive.targetExam || competitive.examName || 'Competitive Exam'}
              </Text>
            </View>

            {(competitive.entranceExams || []).length > 0 ? (
              <View style={styles.examRow}>
                {competitive.entranceExams.map((e) => {
                  const on = String(selectedExam) === String(e.id);
                  return (
                    <Pressable
                      key={e.id}
                      onPress={() => pickExam(e)}
                      style={({ pressed }) => [
                        styles.examChip,
                        on && styles.examChipOn,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.examChipText, on && styles.examChipTextOn]}>{e.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {selectedTab ? (
              <View style={styles.showingRow}>
                <Text style={styles.showing}>Showing: {selectedTab.examName}</Text>
                <Pressable
                  onPress={() => setSelectedExam(null)}
                  style={({ pressed }) => [pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.linkText}>Show All</Text>
                </Pressable>
              </View>
            ) : null}

            <ProgressBar value={cePct} label="Completed" showValue style={styles.bar} />
            <ProgressBar
              value={ceProgress ?? 0}
              label="My Progress"
              showValue={ceProgress != null}
              style={styles.bar}
            />
            <Text style={styles.remark}>
              {ceProgress != null ? getProgressRemark(ceProgress) : NO_PROGRESS_REMARK}
            </Text>

            {weakMocks.length > 0 ? (
              <View style={styles.weakBox}>
                <Text style={styles.weakTitle}>Needs Attention — Lowest Mock Test Scores</Text>
                {weakMocks.map((m) => (
                  <View key={m.paperId ?? m.paperName} style={styles.weakRow}>
                    <Text style={styles.weakName} numberOfLines={1}>
                      {m.paperName}
                    </Text>
                    <Text style={styles.weakScore}>
                      {m.scoredMarks}/{m.totalMarks} ({m.scorePercent}%)
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Mock Tests — the paper grid, colour-coded. GREY covers "not attempted" AND anything
                unrecognised, which is the web's default too. */}
            {selectedExam ? (
              <>
                <Text style={styles.subTitle}>Mock Tests</Text>
                {mockTests[selectedExam] === undefined ? (
                  <Text style={styles.body}>Loading mock tests…</Text>
                ) : mockTests[selectedExam] === null ? (
                  <Text style={styles.body}>Could not load mock tests for this exam.</Text>
                ) : (
                  <View style={styles.paperGrid}>
                    {(mockTests[selectedExam]?.mockTestSubjects || [])
                      .flatMap((s) => s.mockTests || [])
                      .map((mt) => {
                        const c = mockStatusStyle(mt.status);
                        return (
                          <View
                            key={mt.paperId ?? mt.paperName}
                            style={[styles.paper, { backgroundColor: c.bg, borderColor: c.border }]}
                          >
                            <Text style={[styles.paperName, { color: c.fg }]} numberOfLines={2}>
                              {mt.paperName}
                            </Text>
                          </View>
                        );
                      })}
                  </View>
                )}
              </>
            ) : null}
          </>
        ) : (
          <Unavailable forbidden={part('competitive').forbidden} />
        )}
      </Card>

      {/* ── Language ─────────────────────────────────────────────────────── */}
      <Card>
        <CardTitle>🌐 Language</CardTitle>
        {lang?.skillLevels && Object.keys(lang.skillLevels).length ? (
          Object.entries(lang.skillLevels).map(([skill, level]) => (
            <View key={skill} style={styles.metricRow}>
              <Text style={styles.metricLabel}>{skill}</Text>
              <Text style={styles.metricValue}>{level}</Text>
            </View>
          ))
        ) : (
          <Unavailable />
        )}
      </Card>

      {/* ── Coding Pro ──────────────────────────────────────────────────── */}
      <Card>
        <CardTitle>🤖 Coding Pro</CardTitle>
        {streams.map((s) => (
          <View key={s.key} style={styles.stream}>
            <View style={styles.streamTop}>
              <Text style={styles.metricLabel}>{s.name}</Text>
              {s.completed !== null ? (
                <Text style={styles.metricValue}>
                  {s.completed}/{s.total}
                </Text>
              ) : (
                <Stars rating={s.rating} />
              )}
            </View>
            <ProgressBar value={s.percent} color={s.color} />
          </View>
        ))}
      </Card>

      {/* ── Skills Edge ─────────────────────────────────────────────────── */}
      <Card>
        <CardTitle>⚡ Skills Edge</CardTitle>
        {(skillsProfile?.importantSkills || []).length ? (
          <>
            {/* FOCUS TOPICS, not a repeat of the skill names below.
                The chip row that used to sit here listed the same skills the rows already label —
                that was the reported redundancy. The web's top row is the student's chosen TOPICS,
                each with its own progress, resolved against the Skills Edge tree. Rendered only
                when that tree is present, so the parent portal (which does not fetch it) simply
                shows the rows without pills rather than blanking. */}
            {skillsTree && skillsProfile?.selectedTopics ? (
              <View style={styles.chips}>
                {Object.entries(skillsProfile.selectedTopics).flatMap(([skillName, ids]) =>
                  (ids || []).map((id) => {
                    const node = (skillsTree || []).find(
                      (n) => (n?.name || n?.title) === skillName,
                    );
                    const topic = (node?.topics || []).find((t) => String(t.id) === String(id));
                    const name = topic?.name || `Topic ${id}`;
                    const prog = skillsProgress?.[skillName]?.chapters?.[name];
                    return (
                      <View key={`${skillName}-${id}`} style={styles.chip}>
                        <Text style={styles.chipText}>{name}</Text>
                        {prog ? (
                          <Text style={styles.chipBadge}>
                            {prog.completed ?? 0}/{prog.total ?? 0}
                          </Text>
                        ) : null}
                      </View>
                    );
                  }),
                )}
              </View>
            ) : null}

            {skillsProgress && typeof skillsProgress === 'object'
              ? Object.entries(skillsProgress)
                  .filter(([, v]) => v && typeof v === 'object')
                  .map(([name, v]) => (
                    <View key={name} style={styles.stream}>
                      <Expander
                        styles={styles}
                        label={name}
                        open={openSkill === name}
                        onPress={() => toggle(setOpenSkill, openSkill)(name)}
                        right={
                          <Text style={styles.metricValue}>
                            {v.completed ?? 0}/{v.total ?? 0}
                          </Text>
                        }
                      >
                        {Object.entries(v.chapters || {}).map(([ch, cv]) => (
                          <View key={ch} style={styles.stream}>
                            <View style={styles.streamTop}>
                              <Text style={styles.metricLabel}>
                                {cv.completed === cv.total && cv.total > 0 ? '✓ ' : ''}
                                {ch}
                              </Text>
                              <Text style={styles.metricValue}>
                                {cv.completed ?? 0}/{cv.total ?? 0}
                              </Text>
                            </View>
                            <ProgressBar value={cv.percentage ?? 0} />
                          </View>
                        ))}
                      </Expander>
                      <ProgressBar value={v.percentage ?? 0} />
                    </View>
                  ))
              : null}
          </>
        ) : (
          <Unavailable forbidden={part('skillsProfile').forbidden} />
        )}
      </Card>

      {/* THE READINESS INDEX IS DELIBERATELY ABSENT.
          `StudentAnalyticsService` returns it as a hardcoded placeholder — High / Medium / High /
          High, byte-identical for every student, marked "placeholder" in the Java. It read as a
          real assessment. The website still shows it; removing it here is a deliberate divergence,
          at the user's request. Do not restore it without a real computation behind it. */}
    </>
  );
}

const useStyles = makeStyles((p) => ({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: p.tint },
  avatarBlank: { alignItems: 'center', justifyContent: 'center' },
  identityText: { flex: 1 },
  name: { fontSize: TYPE.title, fontWeight: '800', color: SLATE[800] },
  meta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },
  body: { fontSize: TYPE.body, color: SLATE[600], lineHeight: 19 },
  unavailable: { fontSize: TYPE.label, color: SLATE[400], fontStyle: 'italic', lineHeight: 18 },

  careerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  priority: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    color: p.onPrimary,
    backgroundColor: p.primary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  careerText: { flex: 1 },
  careerName: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  careerPath: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 1 },

  link: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: SPACING.sm },
  linkText: { fontSize: TYPE.label, fontWeight: '700', color: p.deep, marginTop: 4 },

  expRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
  },
  expLabel: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[700] },
  expBody: { paddingLeft: 8, paddingBottom: SPACING.sm },
  rightGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warn: { fontSize: TYPE.micro },
  bar: { marginBottom: SPACING.sm },

  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
  stat: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: SLATE[100],
  },
  statValue: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[800] },
  statLabel: { fontSize: TYPE.micro, color: SLATE[500], marginTop: 1, textAlign: 'center' },

  badge: {
    fontSize: TYPE.micro,
    fontWeight: '700',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  count: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[500] },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5 },
  topicIcon: { fontSize: TYPE.label },
  topicName: { flex: 1, fontSize: TYPE.label, color: SLATE[600] },
  levelPill: {
    fontSize: TYPE.micro,
    fontWeight: '800',
    color: '#ffffff',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  pending: { fontSize: TYPE.micro, fontStyle: 'italic', color: '#ff9800' },

  historyRow: { paddingVertical: 7, borderTopWidth: 1, borderTopColor: SLATE[200] },
  historyTitle: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[700] },
  historyLine: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2 },

  gapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: SPACING.sm },
  gapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: SLATE[100],
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  gapLabel: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[700] },
  gapCount: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[800] },
  gapPanel: {
    borderLeftWidth: 4,
    backgroundColor: SLATE[50],
    borderRadius: 10,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  gapTemplate: { fontSize: TYPE.label, fontStyle: 'italic', fontWeight: '600', marginBottom: 5 },
  gapTopic: { fontSize: TYPE.label, color: SLATE[600], lineHeight: 18, marginTop: 2 },

  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 5,
  },
  metricLabel: { flex: 1, fontSize: TYPE.label, color: SLATE[600] },
  metricValue: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[800] },
  subTitle: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    marginTop: SPACING.md,
    marginBottom: 6,
  },

  examRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: SPACING.sm },
  examChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  examChipOn: { backgroundColor: p.tint, borderColor: p.primary },
  examChipText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[600] },
  examChipTextOn: { color: p.deep, fontWeight: '700' },
  showingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  showing: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700] },
  remark: { fontSize: TYPE.label, color: SLATE[600], lineHeight: 19, marginTop: 4 },

  weakBox: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: FEEDBACK.errorBorder,
    borderRadius: 10,
    padding: SPACING.sm,
    marginTop: SPACING.md,
  },
  weakTitle: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    color: FEEDBACK.errorText,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  weakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  weakName: { flex: 1, fontSize: TYPE.label, color: SLATE[700] },
  weakScore: { fontSize: TYPE.label, fontWeight: '800', color: FEEDBACK.errorText },

  paperGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  paper: {
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: 1,
    borderRadius: 10,
    padding: SPACING.sm,
  },
  paperName: { fontSize: TYPE.caption, fontWeight: '600' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: SPACING.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  chipText: { fontSize: TYPE.caption, fontWeight: '600', color: p.deep },
  chipBadge: {
    fontSize: TYPE.micro,
    fontWeight: '800',
    color: p.deep,
    backgroundColor: '#ffffff',
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },

  stream: { marginTop: SPACING.sm },
  streamTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stars: { flexDirection: 'row', gap: 1 },
  pressed: { opacity: 0.78 },
}));
