import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STUDENT } from '../../constants/theme';
import { studentService } from '../../services/studentService';

const MODE_TABS = [
  { key: 'listen', label: '🎧 Listen' },
  { key: 'read_speak', label: '📖 Read & Speak' },
  { key: 'write', label: '✍ Write' },
];

const FOCUS_AREAS = [
  { key: 'Listening', emoji: '🎧' },
  { key: 'Speaking', emoji: '🗣️' },
  { key: 'Reading', emoji: '📖' },
  { key: 'Writing', emoji: '✍' },
];

const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});
const nodeLabel = (node, fallback = '') => String(node?.name || node?.title || node?.label || fallback || '').trim();
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const asText = (value) => String(value ?? '').trim();
const toMessage = (err) => err?.response?.data?.message || err?.message || 'Server error. Please try again.';

function levelBadge(levelRaw) {
  const level = String(levelRaw || 'Beginner');
  const token = normalize(level);
  if (token.includes('proficient')) return { label: 'PROFICIENT', color: '#16A34A', background: '#DCFCE7' };
  if (token.includes('average') || token.includes('intermediate')) return { label: 'AVERAGE', color: '#D97706', background: '#FEF3C7' };
  return { label: 'BEGINNER', color: '#DC2626', background: '#FEE2E2' };
}

function mapTopics(data) {
  return arr(data?.topics || data?.items || data).map((topic, index) => ({
    id: topic?.id || topic?.topicId || topic?.slug || `topic-${index}`,
    name: topic?.name || topic?.title || topic?.label || `Topic ${index + 1}`,
    description: topic?.description || topic?.summary || '',
    raw: topic,
  }));
}

export default function LanguageProScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [skillsProfile, setSkillsProfile] = useState({});
  const [view, setView] = useState('landing');
  const [resourceType, setResourceType] = useState('personalized');
  const [activeFocusArea, setActiveFocusArea] = useState('Listening');
  const [activeMode, setActiveMode] = useState('listen');
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topicContentLoading, setTopicContentLoading] = useState(false);
  const [topicContent, setTopicContent] = useState(null);

  const communicationRatings = useMemo(() => ({
    Listening: skillsProfile?.englishCommunicationRating?.Listening || skillsProfile?.communicationRatings?.Listening || skillsProfile?.listeningRating || 'Beginner',
    Speaking: skillsProfile?.englishCommunicationRating?.Speaking || skillsProfile?.communicationRatings?.Speaking || skillsProfile?.speakingRating || 'Beginner',
    Reading: skillsProfile?.englishCommunicationRating?.Reading || skillsProfile?.communicationRatings?.Reading || skillsProfile?.readingRating || 'Average',
    Writing: skillsProfile?.englishCommunicationRating?.Writing || skillsProfile?.communicationRatings?.Writing || skillsProfile?.writingRating || 'Average',
  }), [skillsProfile]);

  const activeLevel = communicationRatings[activeFocusArea] || 'Beginner';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profileRes] = await Promise.all([
        studentService.getSkillsProfile().catch(() => ({})),
        studentService.getLanguageProTree().catch(() => ({})),
      ]);
      setSkillsProfile(unwrap(profileRes));
    } catch (loadError) {
      setError(toMessage(loadError));
      setSkillsProfile({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    setError('');
    setSelectedTopic(null);
    setTopicContent(null);
    try {
      const data = await studentService.getLanguageProTopics({
        resourceType,
        focusArea: activeFocusArea,
        level: resourceType === 'personalized' ? activeLevel : '',
        mode: activeMode,
      });
      setTopics(mapTopics(unwrap(data)));
    } catch (topicsError) {
      setError(toMessage(topicsError));
      setTopics([]);
    } finally {
      setTopicsLoading(false);
    }
  }, [resourceType, activeFocusArea, activeLevel, activeMode]);

  useEffect(() => {
    if (view === 'resources') {
      loadTopics();
    }
  }, [view, loadTopics]);

  const openTopic = useCallback(async (topic) => {
    const topicId = topic?.id || topic?.topicId || topic?.slug || nodeLabel(topic);
    setSelectedTopic(topic);
    setTopicContentLoading(true);
    setTopicContent(null);
    try {
      const data = await studentService.getLanguageProTopicContent(topicId, {
        resourceType,
        focusArea: activeFocusArea,
        level: resourceType === 'personalized' ? activeLevel : '',
        mode: activeMode,
      });
      setTopicContent(unwrap(data));
    } catch (contentError) {
      setError(toMessage(contentError));
      setTopicContent(null);
    } finally {
      setTopicContentLoading(false);
    }
  }, [resourceType, activeFocusArea, activeLevel, activeMode]);

  const headerTitle = resourceType === 'personalized' ? 'Personalized Resources' : 'School Resources';

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.centerWrap}>
          <ActivityIndicator color={STUDENT.accent} size="large" />
          <Text style={styles.mutedText}>Loading Language Pro…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (view === 'landing') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Language Pro</Text>
            <Text style={styles.bannerSubtitle}>(Where Confidence Meets Communication)</Text>
          </View>

          <TouchableOpacity
            style={styles.landingCard}
            onPress={() => { setResourceType('personalized'); setView('resources'); }}
          >
            <Text style={styles.landingTitle}>Personalized Resources</Text>
            <Text style={styles.landingSub}>Based on Your English Level</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.landingCard}
            onPress={() => { setResourceType('school'); setView('resources'); }}
          >
            <Text style={styles.landingTitle}>School Resources</Text>
            <Text style={styles.landingSub}>Structured school-level communication resources</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.resourcesHeader}>
        <TouchableOpacity onPress={() => { setView('landing'); setSelectedTopic(null); }}>
          <Text style={styles.backText}>← Language Pro</Text>
        </TouchableOpacity>
        <Text style={styles.resourcesTitle}>{headerTitle}</Text>
      </View>

      <View style={styles.focusPanel}>
        <Text style={styles.focusHeading}>Focus Areas</Text>
        <View style={styles.focusRow}>
          {FOCUS_AREAS.map((focus) => {
            const active = activeFocusArea === focus.key;
            const badge = levelBadge(communicationRatings[focus.key]);
            return (
              <TouchableOpacity
                key={focus.key}
                style={[styles.focusChip, active && styles.focusChipActive]}
                onPress={() => setActiveFocusArea(focus.key)}
              >
                <Text style={styles.focusChipTitle}>{`${focus.emoji} ${focus.key}`}</Text>
                <View style={[styles.levelBadge, { backgroundColor: badge.background }]}>
                  <Text style={[styles.levelBadgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeTabs}>
        {MODE_TABS.map((mode) => {
          const active = activeMode === mode.key;
          return (
            <TouchableOpacity key={mode.key} style={[styles.modeTab, active && styles.modeTabActive]} onPress={() => setActiveMode(mode.key)}>
              <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{mode.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {topicsLoading ? (
        <View style={styles.centerWrap}><ActivityIndicator color={STUDENT.accent} /></View>
      ) : selectedTopic ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => setSelectedTopic(null)}>
            <Text style={styles.backToTopics}>← Back to topics</Text>
          </TouchableOpacity>
          <View style={styles.topicContentCard}>
            <Text style={styles.topicContentTitle}>{nodeLabel(selectedTopic, 'Topic')}</Text>
            {topicContentLoading ? (
              <ActivityIndicator color={STUDENT.accent} />
            ) : (
              <>
                <Text style={styles.topicContentText}>
                  {asText(topicContent?.content || topicContent?.text || topicContent?.description || topicContent?.body || 'No content is available for this topic yet.')}
                </Text>
                {arr(topicContent?.attachments || topicContent?.resources || topicContent?.files || topicContent?.media).map((item, index) => {
                  const label = item?.title || item?.name || item?.url || item?.link || `Attachment ${index + 1}`;
                  const link = item?.url || item?.link || item?.src || item?.fileUrl;
                  return (
                    <TouchableOpacity key={`${label}-${index}`} style={styles.attachmentRow} onPress={() => { if (link) Linking.openURL(link).catch(() => {}); }}>
                      <Text style={styles.attachmentText}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {topics.length ? topics.map((topic) => (
            <TouchableOpacity key={String(topic.id)} style={styles.topicCard} onPress={() => openTopic(topic)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.topicTitle}>{topic.name}</Text>
                {topic.description ? <Text style={styles.topicDesc}>{topic.description}</Text> : null}
              </View>
              <Text style={styles.topicChevron}>›</Text>
            </TouchableOpacity>
          )) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No topics available for this combination yet.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  mutedText: { color: STUDENT.textMuted, fontSize: 13 },
  banner: {
    borderRadius: 16,
    backgroundColor: '#FACC15',
    padding: 16,
    marginBottom: 16,
  },
  bannerTitle: { color: '#111827', fontSize: 24, fontWeight: '800' },
  bannerSubtitle: { color: '#374151', fontSize: 13, marginTop: 4, fontWeight: '600' },
  landingCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B132D',
    padding: 16,
    marginBottom: 12,
  },
  landingTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  landingSub: { color: '#CBD5E1', fontSize: 13, marginTop: 6 },
  resourcesHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backText: { color: STUDENT.accent, fontWeight: '700', fontSize: 13 },
  resourcesTitle: { color: STUDENT.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 6 },
  focusPanel: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: STUDENT.bgCard,
    padding: 12,
  },
  focusHeading: { color: STUDENT.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  focusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  focusChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STUDENT.border,
    padding: 8,
    minWidth: '48%',
    backgroundColor: STUDENT.bg,
  },
  focusChipActive: { borderColor: STUDENT.accent },
  focusChipTitle: { color: STUDENT.textPrimary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  levelBadge: { borderRadius: 999, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3 },
  levelBadgeText: { fontSize: 10, fontWeight: '800' },
  modeTabs: { maxHeight: 52, marginTop: 10, marginBottom: 6, paddingHorizontal: 16 },
  modeTab: {
    height: 34,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: STUDENT.bgCard,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  modeTabActive: { backgroundColor: STUDENT.accent, borderColor: STUDENT.accent },
  modeTabText: { color: STUDENT.textMuted, fontSize: 12, fontWeight: '600' },
  modeTabTextActive: { color: '#fff' },
  errorText: { color: '#FB7185', paddingHorizontal: 16, marginBottom: 6, fontSize: 12 },
  topicCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topicTitle: { color: '#111827', fontSize: 14, fontWeight: '700' },
  topicDesc: { color: '#4B5563', fontSize: 12, marginTop: 4 },
  topicChevron: { color: '#6B7280', fontSize: 20, fontWeight: '700' },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: STUDENT.bgCard,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: { color: STUDENT.textMuted, fontSize: 13, textAlign: 'center' },
  backToTopics: { color: STUDENT.accent, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  topicContentCard: {
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 14,
  },
  topicContentTitle: { color: '#111827', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  topicContentText: { color: '#374151', fontSize: 13, lineHeight: 19 },
  attachmentRow: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8 },
  attachmentText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
});
