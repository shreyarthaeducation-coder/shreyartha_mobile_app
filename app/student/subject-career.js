import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { STUDENT } from '../../constants/theme';
import { studentService } from '../../services/studentService';
import { api } from '../../services/apiService';

const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});
const labelOf = (node, fallback = '') => String(node?.title || node?.name || node?.label || fallback || '').trim();

const SECTION_TABS = [
  { key: 'about-courses', label: 'About Courses' },
  { key: 'skill-match-meter', label: 'Skill Match Meter' },
  { key: 'colleges-india', label: 'Colleges in India' },
  { key: 'colleges-abroad', label: 'Colleges Abroad' },
  { key: 'scholarship-details', label: 'Scholarship Details' },
];

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

const normalizeOptions = (payload, fallbackLabel) => {
  const data = unwrap(payload);
  return arr(data?.streams || data?.majors || data?.careers || data?.items || data)
    .map((item, index) => ({
      id: item?.id || item?.streamId || item?.majorId || item?.careerId || item?.slug || `${index}`,
      name: labelOf(item, `${fallbackLabel} ${index + 1}`),
      raw: item,
    }))
    .filter((item) => item.name);
};

const getTabPayload = (payload, tabKey) => {
  const data = unwrap(payload);
  return (
    data?.[tabKey]
    || data?.[tabKey.replace(/-/g, '_')]
    || data?.[tabKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase())]
    || data?.content
    || data?.details
    || data
  );
};

const renderArrayContent = (list) => (
  list.map((item, index) => {
    const title = typeof item === 'string' ? item : item?.title || item?.name || item?.label || `Item ${index + 1}`;
    const desc = typeof item === 'string' ? '' : item?.description || item?.content || item?.details || item?.subtitle || item?.location || '';
    const badge = typeof item === 'string' ? '' : item?.country || item?.score || item?.rank || item?.amount || '';

    return (
      <View key={`${title}-${index}`} style={styles.detailRowCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailRowTitle}>{title}</Text>
          {desc ? <Text style={styles.detailRowText}>{desc}</Text> : null}
        </View>
        {badge ? <Text style={styles.detailRowBadge}>{String(badge)}</Text> : null}
      </View>
    );
  })
);

const renderObjectContent = (content) => {
  const heading = content?.title || content?.heading || content?.name || null;
  const bodyText = content?.description || content?.content || content?.summary || content?.about || null;
  const bullets = arr(content?.points || content?.bullets || content?.highlights || content?.items)
    .map((item) => (typeof item === 'string' ? item : item?.text || item?.title || item?.description || ''))
    .filter(Boolean);

  const numericEntries = Object.entries(content || {})
    .filter(([key, value]) => typeof value === 'number' && !['id'].includes(key))
    .slice(0, 6);

  return (
    <>
      {heading ? <Text style={styles.contentHeading}>{heading}</Text> : null}
      {bodyText ? <Text style={styles.contentBody}>{String(bodyText)}</Text> : null}

      {bullets.length > 0 ? (
        <View style={{ marginTop: 8 }}>
          {bullets.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {numericEntries.length > 0 ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          {numericEntries.map(([key, value]) => (
            <View key={key}>
              <View style={styles.meterHeader}>
                <Text style={styles.meterLabel}>{key.replace(/([A-Z])/g, ' $1')}</Text>
                <Text style={styles.meterValue}>{`${value}%`}</Text>
              </View>
              <View style={styles.meterTrack}>
                <View style={[styles.meterFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
};

export default function SubjectCareerScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [streams, setStreams] = useState([]);
  const [majors, setMajors] = useState([]);
  const [careers, setCareers] = useState([]);

  const [streamId, setStreamId] = useState('');
  const [majorId, setMajorId] = useState('');
  const [careerId, setCareerId] = useState('');

  const [activeTab, setActiveTab] = useState(SECTION_TABS[0].key);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState('');
  const [contentPayload, setContentPayload] = useState(null);

  const loadStreams = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');

    try {
      const data = await requestWithFallbacks([
        () => studentService.getSubjectCareerStreams(),
        () => api.get('/api/students/subject-career/streams'),
        () => api.get('/api/subjectcareer/streams'),
      ]);

      const parsed = normalizeOptions(data, 'Stream');
      setStreams(parsed);
      if (!streamId && parsed.length > 0) {
        setStreamId(String(parsed[0].id));
      }
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load streams.');
      setStreams([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [streamId]);

  useEffect(() => {
    loadStreams();
  }, [loadStreams]);

  useEffect(() => {
    if (!streamId) {
      setMajors([]);
      setMajorId('');
      setCareers([]);
      setCareerId('');
      return;
    }

    let mounted = true;

    const loadMajors = async () => {
      setError('');
      try {
        const data = await requestWithFallbacks([
          () => studentService.getSubjectCareerMajors(streamId),
          () => api.get(`/api/students/subject-career/streams/${encodeURIComponent(streamId)}/majors`),
          () => api.get(`/api/subjectcareer/streams/${encodeURIComponent(streamId)}/majors`),
        ]);

        if (!mounted) return;
        const parsed = normalizeOptions(data, 'Major');
        setMajors(parsed);
        setMajorId(parsed.length > 0 ? String(parsed[0].id) : '');
        setCareers([]);
        setCareerId('');
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError?.message || 'Unable to load major options.');
        setMajors([]);
        setMajorId('');
      }
    };

    loadMajors();
    return () => {
      mounted = false;
    };
  }, [streamId]);

  useEffect(() => {
    if (!streamId || !majorId) {
      setCareers([]);
      setCareerId('');
      return;
    }

    let mounted = true;

    const loadCareers = async () => {
      setError('');
      try {
        const data = await requestWithFallbacks([
          () => studentService.getSubjectCareerOptics(streamId, majorId),
          () => api.get(`/api/students/subject-career/streams/${encodeURIComponent(streamId)}/majors/${encodeURIComponent(majorId)}/careers`),
          () => api.get(`/api/subjectcareer/majors/${encodeURIComponent(majorId)}/careers`),
        ]);

        if (!mounted) return;
        const parsed = normalizeOptions(data, 'Career');
        setCareers(parsed);
        setCareerId(parsed.length > 0 ? String(parsed[0].id) : '');
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError?.message || 'Unable to load career options.');
        setCareers([]);
        setCareerId('');
      }
    };

    loadCareers();
    return () => {
      mounted = false;
    };
  }, [streamId, majorId]);

  const fetchContent = useCallback(async () => {
    if (!streamId || !majorId || !careerId) {
      setContentPayload(null);
      return;
    }

    setContentLoading(true);
    setContentError('');

    try {
      const query = `streamId=${encodeURIComponent(streamId)}&majorId=${encodeURIComponent(majorId)}&careerId=${encodeURIComponent(careerId)}&section=${encodeURIComponent(activeTab)}`;
      const data = await requestWithFallbacks([
        () => studentService.getSubjectCareerContent({ streamId, majorId, careerId, section: activeTab }),
        () => api.get(`/api/students/subject-career/content?${query}`),
        () => api.get(`/api/subjectcareer/content?${query}`),
        () => api.get(`/api/subject-career/careers/${encodeURIComponent(careerId)}/${encodeURIComponent(activeTab)}`),
      ]);

      setContentPayload(getTabPayload(data, activeTab));
    } catch (loadError) {
      setContentPayload(null);
      setContentError(loadError?.message || 'Unable to load section content.');
    } finally {
      setContentLoading(false);
    }
  }, [streamId, majorId, careerId, activeTab]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const activeCareer = useMemo(
    () => careers.find((item) => String(item.id) === String(careerId)) || null,
    [careers, careerId],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStreams(true);
  }, [loadStreams]);

  const contentList = Array.isArray(contentPayload) ? contentPayload : null;
  const contentObject = contentPayload && !Array.isArray(contentPayload) && typeof contentPayload === 'object' ? contentPayload : null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subject & Career</Text>
        <View style={{ width: 48 }} />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={STUDENT.accent} />
          <Text style={styles.mutedText}>Loading subject and career data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={STUDENT.accent} colors={[STUDENT.accent]} />}
        >
          <View style={styles.pickerGroup}>
            <Text style={styles.pickerLabel}>Select Stream</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={streamId}
                onValueChange={(value) => setStreamId(String(value || ''))}
                style={styles.picker}
                dropdownIconColor={STUDENT.textPrimary}
              >
                {streams.map((stream) => (
                  <Picker.Item key={String(stream.id)} label={stream.name} value={String(stream.id)} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.pickerGroup}>
            <Text style={styles.pickerLabel}>Select Major Option</Text>
            <View style={[styles.pickerWrap, !streamId && styles.disabled]}>
              <Picker
                selectedValue={majorId}
                onValueChange={(value) => setMajorId(String(value || ''))}
                style={styles.picker}
                dropdownIconColor={STUDENT.textPrimary}
                enabled={Boolean(streamId)}
              >
                {majors.map((major) => (
                  <Picker.Item key={String(major.id)} label={major.name} value={String(major.id)} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.pickerGroup}>
            <Text style={styles.pickerLabel}>Select Career Optics</Text>
            <View style={[styles.pickerWrap, (!streamId || !majorId) && styles.disabled]}>
              <Picker
                selectedValue={careerId}
                onValueChange={(value) => setCareerId(String(value || ''))}
                style={styles.picker}
                dropdownIconColor={STUDENT.textPrimary}
                enabled={Boolean(streamId && majorId)}
              >
                {careers.map((career) => (
                  <Picker.Item key={String(career.id)} label={career.name} value={String(career.id)} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.chipWrap}>
            {SECTION_TABS.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setActiveTab(tab.key)}
                  disabled={!careerId}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.card}>
            {activeCareer ? <Text style={styles.cardTitle}>{labelOf(activeCareer.raw, activeCareer.name)}</Text> : null}

            {contentError ? <Text style={styles.errorTextInline}>⚠️ {contentError}</Text> : null}

            {contentLoading ? (
              <View style={styles.contentLoadingWrap}>
                <ActivityIndicator size="small" color={STUDENT.accent} />
                <Text style={styles.mutedText}>Loading {SECTION_TABS.find((item) => item.key === activeTab)?.label.toLowerCase()}...</Text>
              </View>
            ) : null}

            {!contentLoading && !contentError && !careerId ? (
              <Text style={styles.placeholderText}>Select stream, major option, and career optics to view details.</Text>
            ) : null}

            {!contentLoading && !contentError && careerId && contentList && contentList.length > 0 ? renderArrayContent(contentList) : null}

            {!contentLoading && !contentError && careerId && contentObject ? renderObjectContent(contentObject) : null}

            {!contentLoading && !contentError && careerId && !contentObject && (!contentList || contentList.length === 0) ? (
              <Text style={styles.placeholderText}>No data is currently available for this section.</Text>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: STUDENT.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: STUDENT.border,
  },
  backText: { color: STUDENT.accentCyan, fontSize: 12, fontWeight: '700' },
  headerTitle: { color: STUDENT.textPrimary, fontSize: 16, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 14 },
  pickerGroup: { marginBottom: 10 },
  pickerLabel: { color: STUDENT.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  pickerWrap: {
    borderWidth: 1,
    borderColor: STUDENT.border,
    borderRadius: 12,
    backgroundColor: STUDENT.bgCard,
    overflow: 'hidden',
  },
  picker: { color: STUDENT.textPrimary, height: 50 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: STUDENT.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: STUDENT.accent, borderColor: STUDENT.accent },
  chipText: { color: STUDENT.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  card: {
    backgroundColor: STUDENT.bgCard,
    borderWidth: 1,
    borderColor: STUDENT.border,
    borderRadius: 14,
    padding: 14,
    minHeight: 180,
  },
  cardTitle: { color: STUDENT.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  contentHeading: { color: STUDENT.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  contentBody: { color: STUDENT.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 7 },
  bulletDot: { color: STUDENT.accentCyan, fontSize: 16, marginRight: 8 },
  bulletText: { color: STUDENT.textSecondary, fontSize: 13, lineHeight: 19, flex: 1 },
  meterHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  meterLabel: { color: STUDENT.textSecondary, fontSize: 12, textTransform: 'capitalize' },
  meterValue: { color: STUDENT.accentCyan, fontWeight: '700', fontSize: 12 },
  meterTrack: { height: 7, borderRadius: 999, backgroundColor: STUDENT.bgCardAlt, overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: STUDENT.accentCyan },
  detailRowCard: {
    borderWidth: 1,
    borderColor: STUDENT.border,
    borderRadius: 12,
    backgroundColor: STUDENT.bgCardAlt,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  detailRowTitle: { color: STUDENT.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  detailRowText: { color: STUDENT.textSecondary, fontSize: 12, lineHeight: 17 },
  detailRowBadge: { color: STUDENT.accentCyan, fontSize: 11, fontWeight: '700' },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: 'rgba(244,63,94,0.16)',
    borderColor: 'rgba(244,63,94,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  errorText: { color: '#fecdd3', fontSize: 12 },
  errorTextInline: { color: '#fecdd3', fontSize: 12, marginBottom: 8 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  contentLoadingWrap: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20 },
  mutedText: { color: STUDENT.textMuted },
  placeholderText: { color: STUDENT.textMuted, fontSize: 13, lineHeight: 20 },
  disabled: { opacity: 0.6 },
});
