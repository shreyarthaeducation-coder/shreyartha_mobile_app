import { useCallback, useEffect, useState } from 'react';
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

const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});

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

export default function CodingProProjectsScreen() {
  const { stream = '', classValue = '' } = useLocalSearchParams();
  const streamValue = Array.isArray(stream) ? stream[0] : stream;
  const classParam = Array.isArray(classValue) ? classValue[0] : classValue;
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await requestWithFallbacks([
        () => studentService.getCodingProProjects({ stream: streamValue, classValue: classParam }),
        () => studentService.getCodingProLanding(),
        () => studentService.getResources(),
      ]);
      const payload = unwrap(data);
      const projectItems = arr(payload.projects || payload.items || payload.tools || payload.resources || payload).map((item, index) => ({
        id: item?.id || item?._id || item?.toolId || `${index}`,
        title: item?.title || item?.name || item?.label || `Project Tool ${index + 1}`,
        description: item?.description || item?.summary || item?.subtitle || '',
        url: item?.url || item?.link || item?.fileUrl || '',
      }));
      setItems(projectItems);
    } catch (loadErr) {
      setError(loadErr?.message || 'Unable to load project tools.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [classParam, streamValue]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Project</Text>
        <View style={styles.topBarSpacer} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loaderText}>Loading project tools...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}
          {items.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
              {item.url ? (
                <TouchableOpacity style={styles.openBtn} onPress={() => Linking.openURL(item.url).catch(() => {})}>
                  <Text style={styles.openBtnText}>Open Tool</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          {!items.length && !error ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No project tools found.</Text>
              <Text style={styles.emptyText}>Project resources for this stream/class will appear here.</Text>
            </View>
          ) : null}
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
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  topBarSpacer: { width: 40 },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loaderText: { color: '#c7d2fe' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 22 },
  errorText: { color: '#fecaca', marginBottom: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  cardDesc: { color: '#475569', marginTop: 6, fontSize: 12, lineHeight: 18 },
  openBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  openBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyCard: {
    backgroundColor: '#dbeafe',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 18,
    alignItems: 'center',
  },
  emptyTitle: { color: '#1e3a8a', fontWeight: '800', marginBottom: 6 },
  emptyText: { color: '#475569', textAlign: 'center', fontSize: 12 },
});
