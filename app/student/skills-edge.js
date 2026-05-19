import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STUDENT } from '../../constants/theme';
import { studentService } from '../../services/studentService';
import { api } from '../../services/apiService';

const HERO_TITLE = 'Skills Edge';
const HERO_TAGLINE = 'Build your future, one skill at a time';
const HERO_COPY = 'Skills Edge prepares students with practical 21st-century capabilities through hands-on learning, projects, and real-world modules.';

const SKILL_CARD_COLORS = ['#F59E0B', '#EF4444', '#22C55E', '#3B82F6', '#14B8A6', '#0EA5E9', '#06B6D4', '#10B981'];

const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});
const nodeLabel = (node, fallback = '') => String(node?.name || node?.title || node?.label || fallback || '').trim();
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const asText = (value) => String(value ?? '').trim();

async function requestWithFallbacks(candidates) {
  let lastError;
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await candidate();
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return null;
}

function extractSkills(tree) {
  const root = arr(tree?.skills || tree?.nodes || tree?.children || tree);
  const leaves = [];
  const walk = (nodes) => {
    arr(nodes).forEach((node) => {
      const children = arr(node?.skills || node?.children || node?.items || node?.categories);
      if (children.length > 0) {
        walk(children);
        return;
      }
      const label = nodeLabel(node);
      if (!label) return;
      leaves.push({
        id: node?.id || node?.skillId || label,
        emoji: node?.emoji || node?.icon || '✨',
        name: label,
        description: node?.description || node?.summary || node?.tagline || '',
        color: node?.color || node?.bgColor || node?.backgroundColor || '',
        chapters: arr(node?.chapters || node?.children || node?.items),
        raw: node,
      });
    });
  };
  walk(root);
  return leaves;
}

function extractChapterPayload(chapterData, chapterNode) {
  const merged = { ...unwrap(chapterNode), ...unwrap(chapterData) };
  const objectives = arr(
    merged?.learningObjectives
    || merged?.objectives
    || merged?.outcomes
    || merged?.goals,
  ).map((item, index) => {
    if (typeof item === 'string') return { id: `obj-${index}`, title: item, detail: '' };
    return {
      id: item?.id || item?.objectiveId || `obj-${index}`,
      title: item?.title || item?.name || item?.objective || item?.text || `Objective ${index + 1}`,
      detail: item?.detail || item?.description || item?.content || item?.explanation || '',
    };
  });
  const modules = arr(merged?.modules || merged?.lessons || merged?.contentModules || merged?.items).map((item, index) => ({
    id: item?.id || item?.moduleId || `module-${index}`,
    title: item?.title || item?.name || `Module ${index + 1}`,
    description: item?.description || item?.summary || item?.subtitle || '',
    attachments: arr(item?.attachments || item?.resources || item?.files || item?.media),
    content: item?.content || item?.text || item?.body || item?.html || '',
    raw: item,
  }));
  return { objectives, modules, merged };
}

function attachmentType(item) {
  const type = normalize(item?.type || item?.kind || item?.mediaType || item?.mimeType || '');
  const url = String(item?.url || item?.link || item?.src || item?.fileUrl || '').toLowerCase();
  if (type.includes('video') || url.match(/\.(mp4|mov|webm|m3u8)$/)) return '🎬';
  if (type.includes('image') || url.match(/\.(png|jpg|jpeg|gif|webp)$/)) return '🖼️';
  if (type.includes('pdf') || url.endsWith('.pdf')) return '📄';
  return '📝';
}

function SkillCard({ skill, index, onPress }) {
  const backgroundColor = skill.color || SKILL_CARD_COLORS[index % SKILL_CARD_COLORS.length];
  return (
    <TouchableOpacity style={[styles.skillCard, { backgroundColor }]} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.skillEmoji}>{skill.emoji}</Text>
      <Text style={styles.skillName}>{skill.name}</Text>
    </TouchableOpacity>
  );
}

export default function SkillsEdgeScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [skills, setSkills] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [expandedObjectiveId, setExpandedObjectiveId] = useState(null);
  const [modules, setModules] = useState([]);
  const [moduleModal, setModuleModal] = useState(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentQuestions, setAssessmentQuestions] = useState([]);
  const [assessmentState, setAssessmentState] = useState({ index: 0, answers: {}, submitted: false });
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectData, setProjectData] = useState(null);
  const [detailView, setDetailView] = useState('chapter');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await studentService.getSkillsEdgeTree();
      const parsed = extractSkills(unwrap(data));
      setSkills(parsed);
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load Skills Edge catalog.');
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chapters = useMemo(() => arr(selectedSkill?.chapters || selectedSkill?.raw?.chapters), [selectedSkill]);
  const activeChapter = useMemo(
    () => chapters.find((chapter) => String(chapter?.id || nodeLabel(chapter)) === String(activeChapterId)) || null,
    [chapters, activeChapterId],
  );

  const loadChapter = useCallback(async (chapterNode) => {
    const chapterId = chapterNode?.id || chapterNode?.chapterId || nodeLabel(chapterNode);
    if (!chapterId) return;
    setActiveChapterId(chapterId);
    setExpandedObjectiveId(null);
    setDetailView('chapter');
    setChapterLoading(true);
    setAssessmentQuestions([]);
    setProjectData(null);
    try {
      const chapterData = await requestWithFallbacks([
        () => studentService.getSkillChapterDetail(chapterId),
        () => api.get(`/api/skillsedge/chapter/${encodeURIComponent(chapterId)}`),
        () => api.get(`/api/students/skillsedge/chapters/${encodeURIComponent(chapterId)}`),
      ]);
      const parsed = extractChapterPayload(chapterData, chapterNode);
      setObjectives(parsed.objectives);
      setModules(parsed.modules);
    } catch {
      const parsed = extractChapterPayload({}, chapterNode);
      setObjectives(parsed.objectives);
      setModules(parsed.modules);
    } finally {
      setChapterLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedSkill) return;
    const firstChapter = chapters[0];
    if (firstChapter) {
      loadChapter(firstChapter);
    } else {
      setActiveChapterId(null);
      setObjectives([]);
      setModules([]);
    }
  }, [selectedSkill, chapters, loadChapter]);

  const openModule = useCallback(async (module) => {
    const moduleId = module?.id || module?.raw?.moduleId;
    try {
      if (!moduleId) {
        setModuleModal(module);
        return;
      }
      const data = await requestWithFallbacks([
        () => studentService.getSkillModuleDetail(moduleId),
        () => api.get(`/api/skillsedge/module/${encodeURIComponent(moduleId)}`),
        () => api.get(`/api/students/skillsedge/modules/${encodeURIComponent(moduleId)}`),
      ]);
      const raw = { ...module.raw, ...unwrap(data) };
      setModuleModal({
        ...module,
        content: raw?.content || raw?.text || raw?.body || raw?.description || module.content,
        attachments: arr(raw?.attachments || raw?.resources || raw?.files || raw?.media || module.attachments),
      });
    } catch {
      setModuleModal(module);
    }
  }, []);

  const openAssessment = useCallback(async () => {
    if (!activeChapter) return;
    const chapterId = activeChapter?.id || activeChapter?.chapterId || nodeLabel(activeChapter);
    setAssessmentLoading(true);
    setDetailView('assessment');
    setAssessmentState({ index: 0, answers: {}, submitted: false });
    try {
      const data = await requestWithFallbacks([
        () => studentService.getSkillChapterAssessment(chapterId),
        () => api.get(`/api/skillsedge/assessment/${encodeURIComponent(chapterId)}`),
        () => api.get(`/api/students/skillsedge/chapters/${encodeURIComponent(chapterId)}/assessment`),
      ]);
      setAssessmentQuestions(arr(unwrap(data)?.questions || unwrap(data)?.items || unwrap(data)));
    } catch (assessmentError) {
      setError(assessmentError?.message || 'Unable to load assessment.');
      setAssessmentQuestions([]);
    } finally {
      setAssessmentLoading(false);
    }
  }, [activeChapter]);

  const openProject = useCallback(async () => {
    if (!activeChapter) return;
    const chapterId = activeChapter?.id || activeChapter?.chapterId || nodeLabel(activeChapter);
    setProjectLoading(true);
    setDetailView('project');
    try {
      const data = await requestWithFallbacks([
        () => studentService.getSkillChapterProject(chapterId),
        () => api.get(`/api/skillsedge/project/${encodeURIComponent(chapterId)}`),
        () => api.get(`/api/students/skillsedge/chapters/${encodeURIComponent(chapterId)}/project`),
      ]);
      setProjectData(unwrap(data));
    } catch (projectError) {
      setError(projectError?.message || 'Unable to load project details.');
      setProjectData(null);
    } finally {
      setProjectLoading(false);
    }
  }, [activeChapter]);

  const assessmentQuestion = assessmentQuestions[assessmentState.index];
  const assessmentOptions = arr(
    assessmentQuestion?.options
    || assessmentQuestion?.choices
    || assessmentQuestion?.answers,
  );

  const renderCatalog = () => (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Skills Edge Catalog</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>{HERO_TITLE}</Text>
          <Text style={styles.heroTagline}>{HERO_TAGLINE}</Text>
          <Text style={styles.heroCopy}>{HERO_COPY}</Text>
        </View>

        <View style={styles.skillsGrid}>
          {skills.map((skill, index) => (
            <SkillCard
              key={String(skill.id)}
              skill={skill}
              index={index}
              onPress={() => setSelectedSkill(skill)}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );

  const renderAssessment = () => {
    if (assessmentLoading) return <View style={styles.centerWrap}><ActivityIndicator color={STUDENT.accent} /></View>;
    if (!assessmentQuestions.length) return <Text style={styles.emptyText}>No assessment available for this chapter.</Text>;
    if (assessmentState.submitted) {
      const score = Object.keys(assessmentState.answers).length;
      return (
        <View style={styles.contentCard}>
          <Text style={styles.sectionTitle}>Assessment Complete</Text>
          <Text style={styles.scoreText}>{`Answered ${score} / ${assessmentQuestions.length}`}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setAssessmentState({ index: 0, answers: {}, submitted: false })}>
            <Text style={styles.primaryButtonText}>Retake Assessment</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.contentCard}>
        <Text style={styles.sectionTitle}>{`Question ${assessmentState.index + 1} / ${assessmentQuestions.length}`}</Text>
        <Text style={styles.questionText}>{assessmentQuestion?.question || assessmentQuestion?.questionText || assessmentQuestion?.text || 'Question'}</Text>
        {assessmentOptions.map((option, optionIndex) => {
          const text = typeof option === 'string' ? option : option?.text || option?.label || `Option ${optionIndex + 1}`;
          const selected = assessmentState.answers[String(assessmentState.index)] === optionIndex;
          return (
            <TouchableOpacity
              key={`${text}-${optionIndex}`}
              style={[styles.optionRow, selected && styles.optionRowActive]}
              onPress={() => setAssessmentState((prev) => ({
                ...prev,
                answers: { ...prev.answers, [String(prev.index)]: optionIndex },
              }))}
            >
              <Text style={styles.optionText}>{text}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            setAssessmentState((prev) => {
              if (prev.index + 1 >= assessmentQuestions.length) return { ...prev, submitted: true };
              return { ...prev, index: prev.index + 1 };
            });
          }}
        >
          <Text style={styles.primaryButtonText}>{assessmentState.index + 1 >= assessmentQuestions.length ? 'Submit' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderProject = () => {
    if (projectLoading) return <View style={styles.centerWrap}><ActivityIndicator color={STUDENT.accent} /></View>;
    if (!projectData) return <Text style={styles.emptyText}>No project details available for this chapter.</Text>;
    const title = projectData?.title || projectData?.name || 'My Project';
    const body = projectData?.description || projectData?.instructions || projectData?.content || projectData?.text || '';
    const link = projectData?.url || projectData?.link || projectData?.submissionUrl;
    return (
      <View style={styles.contentCard}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.objectiveDetail}>{body || 'Project details will appear here.'}</Text>
        {link ? (
          <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openURL(link).catch(() => {})}>
            <Text style={styles.primaryButtonText}>Open Project Link</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const renderChapterDetail = () => (
    <>
      <ScrollView horizontal contentContainerStyle={styles.tabsContent} style={styles.tabsScroll} showsHorizontalScrollIndicator={false}>
        {chapters.map((chapter) => {
          const chapterId = chapter?.id || chapter?.chapterId || nodeLabel(chapter);
          const active = String(chapterId) === String(activeChapterId);
          return (
            <TouchableOpacity key={String(chapterId)} style={[styles.tabPill, active && styles.tabPillActive]} onPress={() => loadChapter(chapter)}>
              <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>{nodeLabel(chapter, 'Chapter')}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {chapterLoading ? (
        <View style={styles.centerWrap}><ActivityIndicator color={STUDENT.accent} /></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.contentCard}>
            <Text style={styles.sectionTitle}>Learning Objectives</Text>
            {objectives.length ? objectives.map((objective, index) => {
              const expanded = expandedObjectiveId === objective.id;
              return (
                <View key={String(objective.id)} style={styles.objectiveRowWrap}>
                  <TouchableOpacity style={styles.objectiveRow} onPress={() => setExpandedObjectiveId(expanded ? null : objective.id)}>
                    <Text style={styles.objectiveTitle}>{`${index + 1}. ${objective.title}`}</Text>
                    <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
                  </TouchableOpacity>
                  {expanded && objective.detail ? <Text style={styles.objectiveDetail}>{objective.detail}</Text> : null}
                </View>
              );
            }) : <Text style={styles.emptyText}>No learning objectives available.</Text>}
          </View>

          {modules.map((module, index) => (
            <TouchableOpacity key={String(module.id)} style={styles.moduleCard} onPress={() => openModule(module)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.moduleTitle}>{`Module ${index + 1}: ${module.title}`}</Text>
                {module.description ? <Text style={styles.moduleDesc}>{module.description}</Text> : null}
              </View>
              <View style={styles.moduleIcons}>
                {module.content ? <Text style={styles.moduleIcon}>📝</Text> : null}
                {arr(module.attachments).slice(0, 3).map((item, attachmentIndex) => (
                  <Text key={`${module.id}-${attachmentIndex}`} style={styles.moduleIcon}>{attachmentType(item)}</Text>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionButton} onPress={openAssessment}>
          <Text style={styles.actionButtonText}>Assessment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={openProject}>
          <Text style={styles.actionButtonText}>My Project</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.centerWrap}>
          <ActivityIndicator color={STUDENT.accent} size="large" />
          <Text style={styles.mutedText}>Loading Skills Edge…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {selectedSkill ? (
        <>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => { setSelectedSkill(null); setDetailView('chapter'); }}>
              <Text style={styles.backText}>← Skills Edge Catalog</Text>
            </TouchableOpacity>
            <View style={styles.skillHero}>
              <Text style={styles.skillHeroEmoji}>{selectedSkill.emoji}</Text>
              <Text style={styles.skillHeroTitle}>{selectedSkill.name}</Text>
              <Text style={styles.skillHeroDesc}>{selectedSkill.description || 'Build practical life-ready skills through engaging chapter-based learning.'}</Text>
            </View>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {detailView === 'assessment' ? renderAssessment() : detailView === 'project' ? renderProject() : renderChapterDetail()}
        </>
      ) : (
        renderCatalog()
      )}

      <Modal visible={Boolean(moduleModal)} transparent animationType="slide" onRequestClose={() => setModuleModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>{moduleModal?.title || 'Module'}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {moduleModal?.content ? <Text style={styles.objectiveDetail}>{asText(moduleModal.content)}</Text> : null}
              {arr(moduleModal?.attachments).map((item, index) => {
                const label = item?.title || item?.name || item?.url || item?.link || `Attachment ${index + 1}`;
                const link = item?.url || item?.link || item?.src || item?.fileUrl;
                return (
                  <TouchableOpacity key={`${label}-${index}`} style={styles.attachmentRow} onPress={() => { if (link) Linking.openURL(link).catch(() => {}); }}>
                    <Text style={styles.attachmentText}>{`${attachmentType(item)} ${label}`}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={[styles.primaryButton, { marginTop: 12 }]} onPress={() => setModuleModal(null)}>
              <Text style={styles.primaryButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  mutedText: { color: STUDENT.textMuted, fontSize: 13 },
  headerRow: { paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { color: STUDENT.textPrimary, fontSize: 22, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
  heroCard: {
    backgroundColor: '#0B132D',
    borderWidth: 1,
    borderColor: STUDENT.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  heroTagline: { color: '#FCD34D', fontSize: 14, fontWeight: '700', marginTop: 4 },
  heroCopy: { color: '#D1D5DB', fontSize: 13, lineHeight: 18, marginTop: 8 },
  skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  skillCard: {
    width: '48.5%',
    borderRadius: 14,
    minHeight: 100,
    padding: 12,
    justifyContent: 'space-between',
  },
  skillEmoji: { fontSize: 24 },
  skillName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  detailHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backText: { color: STUDENT.accent, fontWeight: '700', fontSize: 13 },
  skillHero: {
    marginTop: 8,
    backgroundColor: '#FACC15',
    borderRadius: 16,
    padding: 14,
  },
  skillHeroEmoji: { fontSize: 22 },
  skillHeroTitle: { color: '#111827', fontSize: 20, fontWeight: '800', marginTop: 4 },
  skillHeroDesc: { color: '#1F2937', fontSize: 13, lineHeight: 18, marginTop: 6 },
  tabsScroll: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: STUDENT.border },
  tabsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: STUDENT.borderBlue,
    backgroundColor: STUDENT.accentBlueTint,
  },
  tabPillActive: { backgroundColor: STUDENT.accentBlueStrong, borderColor: STUDENT.accentBlue },
  tabPillText: { color: '#BFDBFE', fontSize: 12, fontWeight: '600' },
  tabPillTextActive: { color: '#fff' },
  contentCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  sectionTitle: { color: '#0F172A', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  objectiveRowWrap: { borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  objectiveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 8 },
  objectiveTitle: { flex: 1, color: '#111827', fontSize: 13, fontWeight: '600' },
  chevron: { color: '#6B7280', fontSize: 14, fontWeight: '700' },
  objectiveDetail: { color: '#4B5563', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  moduleCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: STUDENT.bgCard,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moduleTitle: { color: STUDENT.textPrimary, fontSize: 13, fontWeight: '700' },
  moduleDesc: { color: STUDENT.textMuted, fontSize: 12, marginTop: 4 },
  moduleIcons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  moduleIcon: { fontSize: 16 },
  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  actionButton: { flex: 1, backgroundColor: STUDENT.accent, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  actionButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  errorText: { color: '#FB7185', paddingHorizontal: 16, marginTop: 4, fontSize: 12 },
  emptyText: { color: STUDENT.textMuted, fontSize: 13, paddingHorizontal: 16, paddingVertical: 12 },
  scoreText: { color: '#1F2937', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  questionText: { color: '#111827', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  optionRow: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  optionRowActive: { borderColor: STUDENT.accent, backgroundColor: '#EEF2FF' },
  optionText: { color: '#111827', fontSize: 13 },
  primaryButton: {
    backgroundColor: STUDENT.accent,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(3,7,18,0.65)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', borderRadius: 14, backgroundColor: '#fff', padding: 14 },
  attachmentRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  attachmentText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
});
