import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { studentService } from '../../services/studentService';

const STREAM_LABELS = {
  ai: 'Artificial Intelligence (AI)',
  coding: 'Coding',
  robotics: 'Robotics',
};

const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});
const text = (value) => String(value || '').toLowerCase().trim();

const classToken = (value) => {
  const match = String(value || '').match(/\d+/);
  return match ? match[0] : String(value || '').trim();
};

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

function normalizeTopicList(payload) {
  const data = unwrap(payload);
  const direct = arr(data.topics || data.items || data.nodes || data.children || data.lessons || data);
  return direct
    .map((item, index) => ({
      id: item?.id || item?.topicId || item?._id || `${index}`,
      title: item?.title || item?.name || item?.label || `Topic ${index + 1}`,
      raw: item,
    }))
    .filter((item) => item.title);
}

function normalizeLinks(content) {
  return arr(content?.attachments || content?.files || content?.resources || content?.videos || content?.links || content?.urls)
    .map((item, index) => {
      if (typeof item === 'string') {
        return { id: `${index}`, label: item, url: item };
      }
      return {
        id: String(item.id || item._id || index),
        label: item.title || item.name || item.fileName || item.url || `Attachment ${index + 1}`,
        url: item.url || item.fileUrl || item.link,
      };
    })
    .filter((item) => item.url || item.label);
}

export default function CodingProStreamScreen() {
  const { stream = 'ai' } = useLocalSearchParams();
  const streamKey = Array.isArray(stream) ? stream[0] : stream;
  const streamLabel = STREAM_LABELS[streamKey] || 'Coding Pro';
  const router = useRouter();

  const [studentClass, setStudentClass] = useState('—');
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTopicId, setActiveTopicId] = useState(null);
  const [topicLoading, setTopicLoading] = useState(false);
  const [topicError, setTopicError] = useState('');
  const [topicContent, setTopicContent] = useState(null);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const profile = await studentService.getProfile().catch(() => ({}));
      const profileData = unwrap(profile);
      const classValue = classToken(profileData?.currentClass || profileData?.className || profileData?.class || '');
      setStudentClass(classValue || '—');

      const data = await requestWithFallbacks([
        () => studentService.getCodingProStreamTopics(streamKey, classValue),
        () => studentService.getCodingProStreamTopics(streamLabel, classValue),
        () => studentService.getCodingProTree(),
      ]);

      const normalized = normalizeTopicList(data);
      setTopics(normalized);
    } catch (loadErr) {
      setError(loadErr?.message || 'Unable to load Coding Pro topics.');
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, [streamKey, streamLabel]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const openTopic = useCallback(async (topic) => {
    const topicLabel = text(topic.title);
    const topicType = text(topic?.raw?.type || topic?.raw?.nodeType || topic?.raw?.category);
    const isProjectTopic = Boolean(topic?.raw?.isProject || topic?.raw?.isProjects || topicType === 'project' || topicType === 'projects' || topicLabel.includes('project'));
    if (isProjectTopic) {
      router.push({ pathname: '/student/coding-pro-projects', params: { stream: streamKey, classValue: studentClass } });
      return;
    }

    setActiveTopicId(topic.id);
    setTopicLoading(true);
    setTopicError('');
    try {
      const data = await requestWithFallbacks([
        () => studentService.getCodingProTopicContent({ topicId: topic.id, stream: streamKey, classValue: studentClass }),
        () => studentService.getTopicContent(topic.id, 'coding_pro'),
        () => studentService.getTopicContent(topic.id, streamKey),
      ]);
      setTopicContent(unwrap(data));
    } catch (contentErr) {
      setTopicError(contentErr?.message || 'Unable to load topic content.');
      setTopicContent(null);
    } finally {
      setTopicLoading(false);
    }
  }, [router, streamKey, studentClass]);

  const contentText = useMemo(() => {
    const raw = topicContent?.html || topicContent?.content || topicContent?.body || topicContent?.text || topicContent?.description || '';
    return String(raw).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }, [topicContent]);

  const links = useMemo(() => normalizeLinks(topicContent || {}), [topicContent]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Coding Pro</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.banner}>
        <View style={styles.bannerTextWrap}>
          <Text style={styles.bannerTitle}>{streamLabel}</Text>
          <Text style={styles.bannerSub}>Coding Pro Stream</Text>
        </View>
        <Text style={styles.classText}>{`Class: ${studentClass}`}</Text>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color="#3b82f6" size="large" />
          <Text style={styles.loaderText}>Loading topics...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}

          {topics.map((topic) => (
            <TouchableOpacity
              key={String(topic.id)}
              style={[styles.topicRow, activeTopicId === topic.id && styles.topicRowActive]}
              onPress={() => openTopic(topic)}
              activeOpacity={0.82}
            >
              <Text style={styles.topicText}>{topic.title}</Text>
              <Text style={styles.topicChevron}>›</Text>
            </TouchableOpacity>
          ))}

          {!topics.length && !error ? <Text style={styles.placeholderText}>No topics found for this stream.</Text> : null}

          <View style={styles.contentCard}>
            {topicLoading ? (
              <ActivityIndicator color="#2563eb" />
            ) : topicError ? (
              <Text style={styles.errorText}>⚠️ {topicError}</Text>
            ) : activeTopicId ? (
              <>
                {contentText ? <Text style={styles.contentText}>{contentText}</Text> : <Text style={styles.placeholderText}>No content available for this topic.</Text>}
                {links.length > 0 ? (
                  <View style={styles.linksWrap}>
                    {links.map((item) => (
                      <TouchableOpacity key={item.id} style={styles.linkBtn} onPress={() => item.url && Linking.openURL(item.url).catch(() => {})}>
                        <Text style={styles.linkText} numberOfLines={1}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.tapIcon}>👆</Text>
                <Text style={styles.placeholderText}>Select a topic to view content</Text>
              </>
            )}
          </View>

          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/student/coding-pro')}>
            <Text style={styles.backButtonText}>Back to Coding Pro</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },
  backText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  topTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  topBarSpacer: { width: 46 },
  banner: {
    backgroundColor: '#f7c948',
    borderRadius: 14,
    marginHorizontal: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerTextWrap: { flex: 1 },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: '#1f2937' },
  bannerSub: { fontSize: 12, color: '#374151', marginTop: 2 },
  classText: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loaderText: { color: '#c7d2fe' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 24 },
  errorText: { color: '#fecaca', marginBottom: 10 },
  topicRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  topicRowActive: { borderWidth: 2, borderColor: '#3b82f6' },
  topicText: { color: '#0f172a', fontSize: 14, fontWeight: '700', flex: 1, paddingRight: 10 },
  topicChevron: { color: '#64748b', fontSize: 22 },
  contentCard: {
    marginTop: 10,
    backgroundColor: '#dbeafe',
    borderRadius: 14,
    minHeight: 170,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    justifyContent: 'center',
  },
  tapIcon: { fontSize: 30, textAlign: 'center', marginBottom: 6 },
  placeholderText: { color: '#475569', textAlign: 'center', fontSize: 13 },
  contentText: { color: '#0f172a', fontSize: 13, lineHeight: 20 },
  linksWrap: { marginTop: 12, gap: 8 },
  linkBtn: { backgroundColor: '#bfdbfe', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 10 },
  linkText: { color: '#1e3a8a', fontWeight: '700', fontSize: 12 },
  backButton: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  backButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
