import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '../../services/apiService';
import { studentService } from '../../services/studentService';
import { STUDENT } from '../../constants/theme';

const GREEN_ACCENT = '#16a34a';

const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});
const compactText = (value, fallback = '—') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};
const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const toPercent = (value) => {
  const number = toNumber(value);
  if (number == null) return null;
  if (number >= 0 && number <= 1) return Math.round(number * 100);
  return Math.max(0, Math.min(100, Math.round(number)));
};
const resolveMediaUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${API_BASE_URL}${raw}`;
  return `${API_BASE_URL}/${raw.replace(/^\/+/, '')}`;
};

function ProgressBar({ value }) {
  const pct = toPercent(value) ?? 0;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardAccent} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function SectionState({ loading, error, empty, emptyText = 'No data available yet', children }) {
  if (loading) {
    return (
      <View style={styles.sectionStateWrap}>
        <ActivityIndicator size="small" color={GREEN_ACCENT} />
      </View>
    );
  }
  if (error) {
    return <Text style={styles.sectionErrorText}>{error}</Text>;
  }
  if (empty) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }
  return children;
}

export default function MyAnalyticsScreen() {
  const router = useRouter();

  const [profileSection, setProfileSection] = useState({ loading: true, error: '', data: null });
  const [syllabusSection, setSyllabusSection] = useState({ loading: true, error: '', data: null });
  const [myProgressSection, setMyProgressSection] = useState({ loading: true, error: '', data: null });
  const [competitiveSection, setCompetitiveSection] = useState({ loading: true, error: '', data: null });
  const [psychometricSection, setPsychometricSection] = useState({ loading: true, error: '', data: null });
  const [learningGapsSection, setLearningGapsSection] = useState({ loading: true, error: '', data: null });
  const [codingProSection, setCodingProSection] = useState({ loading: true, error: '', data: null });
  const [skillsEdgeSection, setSkillsEdgeSection] = useState({ loading: true, error: '', data: null });

  const [expandedProgress, setExpandedProgress] = useState({});
  const [expandedSkills, setExpandedSkills] = useState({});
  const [selectedExamTab, setSelectedExamTab] = useState('');

  const fetchSection = useCallback(async (name, setter, fetcher) => {
    setter((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const response = await fetcher();
      setter({ loading: false, error: '', data: unwrap(response) });
    } catch (err) {
      const message = err?.message || 'Unable to load this section right now.';
      console.error(`My Analytics ${name} fetch failed:`, err);
      setter({ loading: false, error: message, data: null });
    }
  }, []);

  const loadAllSections = useCallback(async () => {
    await Promise.all([
      fetchSection('profile', setProfileSection, studentService.getMyAnalyticsStudentAnalytics),
      fetchSection('syllabus', setSyllabusSection, studentService.getMyAnalyticsSyllabusCompletion),
      fetchSection('my-progress', setMyProgressSection, studentService.getMyAnalyticsProgress),
      fetchSection('competitive-exam', setCompetitiveSection, studentService.getMyAnalyticsCompetitiveExam),
      fetchSection('psychometric', setPsychometricSection, studentService.getMyAnalyticsPsychometric),
      fetchSection('learning-gaps', setLearningGapsSection, studentService.getMyAnalyticsLearningGaps),
      fetchSection('coding-pro', setCodingProSection, studentService.getMyAnalyticsCodingPro),
      fetchSection('skills-edge', setSkillsEdgeSection, studentService.getMyAnalyticsSkillsEdge),
    ]);
  }, [fetchSection]);

  useEffect(() => {
    loadAllSections();
  }, [loadAllSections]);

  const profileData = useMemo(() => {
    const data = unwrap(profileSection.data);
    return {
      fullName: data.fullName || data.name || data.studentName || 'Student',
      currentClass: data.currentClass || data.className || data.class || '',
      schoolName: data.schoolName || data.school?.name || data.school || '',
      stream: data.stream || '',
      profilePictureUrl: resolveMediaUrl(
        data.profilePictureUrl || data.pictureUrl || data.avatarUri || data.avatar,
      ),
    };
  }, [profileSection.data]);

  const profileInitials = useMemo(() => {
    const parts = compactText(profileData.fullName, '').split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'ST';
  }, [profileData.fullName]);

  const syllabusData = useMemo(() => {
    const data = unwrap(syllabusSection.data);
    const subjects = arr(data.subjects || data.subjectWiseCompletion || data.subjectWise || data.breakdown).map((item, index) => {
      const row = unwrap(item);
      return {
        id: String(row.subjectId || row.id || row.subjectName || index),
        subjectName: row.subjectName || row.name || row.subject || `Subject ${index + 1}`,
        completionPercent: toPercent(row.completionPercent ?? row.percentage ?? row.progress) ?? 0,
      };
    });

    return {
      overallCompletionPercent: toPercent(
        data.overallCompletionPercent
        ?? data.overallCompletionPercentage
        ?? data.overallCompletion
        ?? data.percentage,
      ) ?? 0,
      totalTopics: toNumber(data.totalTopics),
      completedTopics: toNumber(data.completedTopics),
      notCompletedTopics: toNumber(data.notCompletedTopics ?? data.pendingTopics),
      totalSubjects: toNumber(data.totalSubjects) ?? subjects.length,
      totalChapters: toNumber(data.totalChapters),
      subjects,
    };
  }, [syllabusSection.data]);

  const myProgressModules = useMemo(() => {
    const data = unwrap(myProgressSection.data);
    return arr(data.modules || data.myProgress || data.progress || data.items).map((item, index) => {
      const row = unwrap(item);
      return {
        id: String(row.moduleId || row.id || row.moduleName || row.title || index),
        moduleName: row.moduleName || row.title || row.name || `Module ${index + 1}`,
        progressPercent: toPercent(row.progressPercent ?? row.percentage ?? row.progress ?? row.completionPercent) ?? 0,
        completedCount: toNumber(row.completedCount ?? row.completedTopics ?? row.completed),
        totalCount: toNumber(row.totalCount ?? row.totalTopics ?? row.total),
        description: row.description || row.status || '',
      };
    });
  }, [myProgressSection.data]);

  const competitiveData = useMemo(() => {
    const data = unwrap(competitiveSection.data);
    const exams = arr(data.exams || data.examAnalytics || data.analytics || data.tabs).map((item, index) => {
      const row = unwrap(item);
      return {
        id: String(row.examId || row.id || row.examName || row.name || index),
        examName: row.examName || row.name || row.title || `Exam ${index + 1}`,
        score: row.score ?? row.marks ?? row.totalScore ?? '—',
        accuracyPercent: toPercent(row.accuracyPercent ?? row.accuracy ?? row.percentage),
        recentAttempts: arr(row.recentAttempts || row.attempts || row.recent || row.latestAttempts),
      };
    });
    return {
      hasExam: data.hasExam,
      exams,
    };
  }, [competitiveSection.data]);

  useEffect(() => {
    if (!selectedExamTab && competitiveData.exams.length > 0) {
      setSelectedExamTab(competitiveData.exams[0].id);
    }
  }, [competitiveData.exams, selectedExamTab]);

  const selectedExam = competitiveData.exams.find((exam) => exam.id === selectedExamTab) || competitiveData.exams[0];

  const psychometricDimensions = useMemo(() => {
    const data = unwrap(psychometricSection.data);
    return arr(data.dimensions || data.scores || data.summary || data.results).map((item, index) => {
      const row = unwrap(item);
      return {
        id: String(row.id || row.dimension || row.name || index),
        label: row.dimension || row.label || row.name || `Dimension ${index + 1}`,
        score: toPercent(row.score ?? row.percentage ?? row.value ?? row.progress),
      };
    }).filter((item) => item.label);
  }, [psychometricSection.data]);

  const learningGaps = useMemo(() => {
    const data = unwrap(learningGapsSection.data);
    return arr(data.learningGaps || data.gaps || data.items || data).map((item, index) => {
      const row = unwrap(item);
      return {
        id: String(row.id || row.topicId || row.subject || index),
        title: row.topicName || row.gap || row.title || row.subject || `Gap ${index + 1}`,
        detail: row.suggestion || row.description || row.reason || '',
      };
    });
  }, [learningGapsSection.data]);

  const codingProProgress = useMemo(() => {
    const data = unwrap(codingProSection.data);
    return arr(data.modules || data.topics || data.progress || data.items || data.streams).map((item, index) => {
      const row = unwrap(item);
      return {
        id: String(row.id || row.moduleId || row.topicId || row.name || index),
        name: row.moduleName || row.topicName || row.name || row.title || `Track ${index + 1}`,
        progressPercent: toPercent(row.progressPercent ?? row.percentage ?? row.progress ?? row.completionPercent),
      };
    });
  }, [codingProSection.data]);

  const skillsEdge = useMemo(() => {
    const data = unwrap(skillsEdgeSection.data);
    return arr(data.selectedSkills || data.skills || data.skillProgress || data.items).map((item, index) => {
      const row = unwrap(item);
      const modules = arr(row.modules || row.moduleProgress || row.chapters || row.items).map((module, moduleIndex) => {
        const moduleRow = unwrap(module);
        return {
          id: String(moduleRow.id || moduleRow.moduleId || moduleRow.name || moduleIndex),
          moduleName: moduleRow.moduleName || moduleRow.name || moduleRow.title || `Module ${moduleIndex + 1}`,
          progressPercent: toPercent(moduleRow.progressPercent ?? moduleRow.percentage ?? moduleRow.progress),
        };
      });
      return {
        id: String(row.skillId || row.id || row.skillName || row.name || index),
        skillName: row.skillName || row.name || row.title || `Skill ${index + 1}`,
        progressPercent: toPercent(row.progressPercent ?? row.percentage ?? row.progress),
        modules,
      };
    });
  }, [skillsEdgeSection.data]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/student')}>
          <Text style={styles.headerButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Analytics</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SectionCard title="Student Profile">
          <SectionState loading={profileSection.loading} error={profileSection.error} empty={!profileSection.data} emptyText="Student profile not available yet.">
            <View style={styles.profileRow}>
              <View style={styles.profileAvatarWrap}>
                {profileData.profilePictureUrl ? (
                  <Image source={{ uri: profileData.profilePictureUrl }} style={styles.profileAvatar} />
                ) : (
                  <View style={styles.profileAvatarFallback}>
                    <Text style={styles.profileAvatarFallbackText}>{profileInitials}</Text>
                  </View>
                )}
              </View>
              <View style={styles.profileMetaWrap}>
                <Text style={styles.profileName}>{compactText(profileData.fullName, 'Student')}</Text>
                <Text style={styles.profileMeta}>Class: {compactText(profileData.currentClass)}</Text>
                <Text style={styles.profileMeta}>School: {compactText(profileData.schoolName)}</Text>
                <Text style={styles.profileMeta}>Stream: {compactText(profileData.stream)}</Text>
              </View>
            </View>
          </SectionState>
        </SectionCard>

        <SectionCard title="Overall Syllabus Completion">
          <SectionState loading={syllabusSection.loading} error={syllabusSection.error} empty={!syllabusSection.data} emptyText="Syllabus completion data not available yet.">
            <Text style={styles.primaryPercent}>{`${syllabusData.overallCompletionPercent}%`}</Text>
            <ProgressBar value={syllabusData.overallCompletionPercent} />
            <View style={styles.metricGrid}>
              <View style={styles.metricChip}><Text style={styles.metricValue}>{compactText(syllabusData.totalTopics, '0')}</Text><Text style={styles.metricLabel}>Total Topics</Text></View>
              <View style={styles.metricChip}><Text style={styles.metricValue}>{compactText(syllabusData.completedTopics, '0')}</Text><Text style={styles.metricLabel}>Completed</Text></View>
              <View style={styles.metricChip}><Text style={styles.metricValue}>{compactText(syllabusData.notCompletedTopics, '0')}</Text><Text style={styles.metricLabel}>Not Completed</Text></View>
              <View style={styles.metricChip}><Text style={styles.metricValue}>{compactText(syllabusData.totalSubjects, '0')}</Text><Text style={styles.metricLabel}>Total Subjects</Text></View>
              <View style={styles.metricChip}><Text style={styles.metricValue}>{compactText(syllabusData.totalChapters, '0')}</Text><Text style={styles.metricLabel}>Total Chapters</Text></View>
            </View>
          </SectionState>
        </SectionCard>

        <SectionCard title="Per-subject Syllabus Breakdown">
          <SectionState
            loading={syllabusSection.loading}
            error={syllabusSection.error}
            empty={!syllabusData.subjects.length}
            emptyText="No subject-wise syllabus progress available yet."
          >
            {syllabusData.subjects.map((subject) => (
              <View key={subject.id} style={styles.rowCard}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{subject.subjectName}</Text>
                  <Text style={styles.rowValue}>{`${subject.completionPercent}%`}</Text>
                </View>
                <ProgressBar value={subject.completionPercent} />
              </View>
            ))}
          </SectionState>
        </SectionCard>

        <SectionCard title="My Progress">
          <SectionState
            loading={myProgressSection.loading}
            error={myProgressSection.error}
            empty={!myProgressModules.length}
            emptyText="No module progress available yet."
          >
            {myProgressModules.map((module) => {
              const isOpen = Boolean(expandedProgress[module.id]);
              return (
                <View key={module.id} style={styles.rowCard}>
                  <TouchableOpacity
                    style={styles.rowHeader}
                    onPress={() => setExpandedProgress((prev) => ({ ...prev, [module.id]: !prev[module.id] }))}
                  >
                    <Text style={styles.rowTitle}>{module.moduleName}</Text>
                    <Text style={styles.rowValue}>{`${module.progressPercent}%`}</Text>
                  </TouchableOpacity>
                  <ProgressBar value={module.progressPercent} />
                  {isOpen ? (
                    <View style={styles.rowDetails}>
                      {module.description ? <Text style={styles.rowMeta}>{module.description}</Text> : null}
                      {(module.completedCount != null || module.totalCount != null) ? (
                        <Text style={styles.rowMeta}>
                          {compactText(module.completedCount, '0')} / {compactText(module.totalCount, '0')} completed
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </SectionState>
        </SectionCard>

        <SectionCard title="Competitive Exam Analytics">
          <SectionState loading={competitiveSection.loading} error={competitiveSection.error} empty={!competitiveSection.data} emptyText="Competitive exam analytics not available yet.">
            {competitiveData.hasExam === false ? (
              <Text style={styles.emptyText}>No competitive exam data found for your profile.</Text>
            ) : competitiveData.exams.length ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.examTabsRow}>
                  {competitiveData.exams.map((exam) => {
                    const isActive = selectedExam?.id === exam.id;
                    return (
                      <TouchableOpacity
                        key={exam.id}
                        style={[styles.examTab, isActive && styles.examTabActive]}
                        onPress={() => setSelectedExamTab(exam.id)}
                      >
                        <Text style={[styles.examTabText, isActive && styles.examTabTextActive]}>{exam.examName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {selectedExam ? (
                  <View style={styles.rowCard}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowTitle}>{selectedExam.examName}</Text>
                      <Text style={styles.rowValue}>{compactText(selectedExam.score)}</Text>
                    </View>
                    {selectedExam.accuracyPercent != null ? (
                      <>
                        <Text style={styles.rowMeta}>{`Accuracy: ${selectedExam.accuracyPercent}%`}</Text>
                        <ProgressBar value={selectedExam.accuracyPercent} />
                      </>
                    ) : null}

                    <Text style={styles.sectionSubTitle}>Recent Attempts</Text>
                    {selectedExam.recentAttempts.length ? selectedExam.recentAttempts.map((attempt, index) => {
                      const row = unwrap(attempt);
                      const label = row.testName || row.name || row.date || `Attempt ${index + 1}`;
                      const value = row.score ?? row.marks ?? row.rank ?? row.result;
                      return (
                        <View key={`${selectedExam.id}-${index}`} style={styles.attemptRow}>
                          <Text style={styles.attemptLabel}>{label}</Text>
                          <Text style={styles.attemptValue}>{compactText(value)}</Text>
                        </View>
                      );
                    }) : <Text style={styles.emptyText}>No recent attempts available.</Text>}
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.emptyText}>No competitive exam data available yet.</Text>
            )}
          </SectionState>
        </SectionCard>

        <SectionCard title="Psychometric Summary">
          <SectionState
            loading={psychometricSection.loading}
            error={psychometricSection.error}
            empty={!psychometricDimensions.length}
            emptyText="Psychometric scores are not available yet."
          >
            {psychometricDimensions.map((dimension) => (
              <View key={dimension.id} style={styles.rowCard}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{dimension.label}</Text>
                  <Text style={styles.rowValue}>{dimension.score != null ? `${dimension.score}%` : '—'}</Text>
                </View>
                {dimension.score != null ? <ProgressBar value={dimension.score} /> : null}
              </View>
            ))}
          </SectionState>
        </SectionCard>

        <SectionCard title="Learning Gaps">
          <SectionState
            loading={learningGapsSection.loading}
            error={learningGapsSection.error}
            empty={!learningGaps.length}
            emptyText="No learning gaps found."
          >
            {learningGaps.map((gap) => (
              <View key={gap.id} style={styles.rowCard}>
                <Text style={styles.rowTitle}>{gap.title}</Text>
                {gap.detail ? <Text style={styles.rowMeta}>{gap.detail}</Text> : null}
              </View>
            ))}
          </SectionState>
        </SectionCard>

        <SectionCard title="Coding Pro Progress">
          <SectionState
            loading={codingProSection.loading}
            error={codingProSection.error}
            empty={!codingProProgress.length}
            emptyText="Coding Pro progress is not available yet."
          >
            {codingProProgress.map((entry) => (
              <View key={entry.id} style={styles.rowCard}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{entry.name}</Text>
                  <Text style={styles.rowValue}>{entry.progressPercent != null ? `${entry.progressPercent}%` : '—'}</Text>
                </View>
                {entry.progressPercent != null ? <ProgressBar value={entry.progressPercent} /> : null}
              </View>
            ))}
          </SectionState>
        </SectionCard>

        <SectionCard title="Skills Edge Module Progress">
          <SectionState
            loading={skillsEdgeSection.loading}
            error={skillsEdgeSection.error}
            empty={!skillsEdge.length}
            emptyText="Skills Edge selections are not available yet."
          >
            {skillsEdge.map((skill) => {
              const isOpen = Boolean(expandedSkills[skill.id]);
              return (
                <View key={skill.id} style={styles.rowCard}>
                  <TouchableOpacity
                    style={styles.rowHeader}
                    onPress={() => setExpandedSkills((prev) => ({ ...prev, [skill.id]: !prev[skill.id] }))}
                  >
                    <Text style={styles.rowTitle}>{skill.skillName}</Text>
                    <Text style={styles.rowValue}>{skill.progressPercent != null ? `${skill.progressPercent}%` : '—'}</Text>
                  </TouchableOpacity>
                  {skill.progressPercent != null ? <ProgressBar value={skill.progressPercent} /> : null}

                  {isOpen ? (
                    <View style={styles.skillModulesWrap}>
                      {skill.modules.length ? skill.modules.map((module) => (
                        <View key={`${skill.id}-${module.id}`} style={styles.skillModuleRow}>
                          <Text style={styles.skillModuleName}>{module.moduleName}</Text>
                          <Text style={styles.skillModuleValue}>{module.progressPercent != null ? `${module.progressPercent}%` : '—'}</Text>
                        </View>
                      )) : <Text style={styles.emptyText}>No module-level progress available.</Text>}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </SectionState>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,0.95)',
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  headerButtonText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 96, gap: 14 },
  card: {
    backgroundColor: 'rgba(17,24,39,0.98)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: STUDENT.border,
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardAccent: { width: 4, height: 20, borderRadius: 999, backgroundColor: GREEN_ACCENT },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  sectionStateWrap: { paddingVertical: 12, alignItems: 'center' },
  sectionErrorText: {
    color: '#fecaca',
    backgroundColor: 'rgba(127, 29, 29, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  emptyText: { color: STUDENT.textMuted, fontSize: 13, lineHeight: 18 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileAvatarWrap: {
    width: 86,
    height: 86,
    borderRadius: 43,
    padding: 3,
    backgroundColor: 'rgba(22,163,74,0.25)',
  },
  profileAvatar: { width: '100%', height: '100%', borderRadius: 40 },
  profileAvatarFallback: {
    flex: 1,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21,128,61,0.7)',
  },
  profileAvatarFallbackText: { color: '#fff', fontSize: 26, fontWeight: '900' },
  profileMetaWrap: { flex: 1, gap: 4 },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  profileMeta: { color: STUDENT.textSecondary, fontSize: 13 },
  primaryPercent: { color: '#dcfce7', fontSize: 24, fontWeight: '900' },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: GREEN_ACCENT },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricChip: {
    minWidth: '30%',
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.22)',
    backgroundColor: 'rgba(5,46,22,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricValue: { color: '#fff', fontSize: 16, fontWeight: '800' },
  metricLabel: { color: STUDENT.textSecondary, fontSize: 11, marginTop: 2 },
  rowCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10,15,30,0.72)',
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  rowValue: { color: '#dcfce7', fontSize: 13, fontWeight: '800' },
  rowDetails: { gap: 4 },
  rowMeta: { color: STUDENT.textSecondary, fontSize: 12, lineHeight: 17 },
  examTabsRow: { gap: 8, paddingBottom: 8 },
  examTab: {
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.25)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(5,46,22,0.35)',
  },
  examTabActive: { backgroundColor: 'rgba(22,163,74,0.5)', borderColor: GREEN_ACCENT },
  examTabText: { color: '#bbf7d0', fontWeight: '700', fontSize: 12 },
  examTabTextActive: { color: '#fff' },
  sectionSubTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 4 },
  attemptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  attemptLabel: { color: STUDENT.textSecondary, flex: 1, fontSize: 12 },
  attemptValue: { color: '#fff', fontWeight: '700', fontSize: 12 },
  skillModulesWrap: { gap: 8, marginTop: 4 },
  skillModuleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  skillModuleName: { color: STUDENT.textSecondary, fontSize: 12, flex: 1 },
  skillModuleValue: { color: '#dcfce7', fontSize: 12, fontWeight: '700' },
});
