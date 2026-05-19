import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { studentService } from '../../services/studentService';

const STREAMS = [
  { key: 'ai', label: 'Artificial Intelligence (AI)', icon: '🧠' },
  { key: 'coding', label: 'Coding', icon: '</>' },
  { key: 'robotics', label: 'Robotics', icon: '🦾' },
];
const toMessage = (err) => err?.response?.data?.message || err?.message || 'Server error. Please try again.';

export default function CodingProLandingScreen() {
  const router = useRouter();
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [landingData, setLandingData] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadLanding = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await studentService.getCodingProLanding();
        if (!mounted) return;
        setLandingData(response?.data ?? response ?? null);
      } catch (err) {
        if (!mounted) return;
        setError(toMessage(err));
        setLandingData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadLanding();
    return () => { mounted = false; };
  }, []);

  const streamOptions = useMemo(() => {
    const fromApi = Array.isArray(landingData?.streams)
      ? landingData.streams.map((item, index) => ({
          key: String(item?.key || item?.streamKey || item?.stream || item?.slug || item?.id || item?.name || STREAMS[index]?.key || `stream-${index}`),
          label: String(item?.label || item?.name || item?.title || STREAMS[index]?.label || `Stream ${index + 1}`),
          icon: String(item?.icon || STREAMS[index]?.icon || '💡'),
        }))
      : [];
    return fromApi.length ? fromApi : STREAMS;
  }, [landingData]);

  const openStream = (stream) => {
    setSelectorVisible(false);
    router.push({ pathname: '/student/coding-pro-stream', params: { stream } });
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Image source={require('../../assets/images/ShreyarthaLogo.png')} style={styles.logo} resizeMode="contain" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Coding Pro</Text>
          <Text style={styles.headerSub}>(Create, innovate, and code your future)</Text>
          {loading ? <ActivityIndicator color="#dbeafe" style={{ marginTop: 8 }} /> : null}
          {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.mainCard, styles.projectCard]}
            activeOpacity={0.85}
            onPress={() => router.push('/student/coding-pro-projects')}
          >
            <Text style={styles.cardIcon}>⚙️💡</Text>
            <Text style={styles.cardTitle}>My Project</Text>
            <Text style={styles.cardSub}>Tools to Practice Projects</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.mainCard, styles.streamCard]} activeOpacity={0.9} onPress={() => setSelectorVisible(true)}>
            <Text style={styles.streamTitle}>AI, Coding & Robotics</Text>
            {streamOptions.map((stream) => (
              <View
                key={stream.key}
                style={styles.chip}
                accessibilityRole="button"
                accessibilityLabel={`Open selector for ${stream.label}`}
              >
                <Text style={styles.chipText}>{stream.icon} {stream.label} ▾</Text>
              </View>
            ))}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal transparent animationType="fade" visible={selectorVisible} onRequestClose={() => setSelectorVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectorVisible(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.popupWrap}>
            <BlurView intensity={40} tint="dark" style={styles.popup}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectorVisible(false)}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
              {streamOptions.map((stream) => (
                <TouchableOpacity
                  key={stream.key}
                  style={styles.popupButton}
                  activeOpacity={0.9}
                  onPress={() => openStream(stream.key)}
                >
                  <Text style={styles.popupButtonText}>{stream.icon}  {stream.label}</Text>
                </TouchableOpacity>
              ))}
            </BlurView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  bgGlowOne: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(59,130,246,0.24)',
  },
  bgGlowTwo: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(34,197,94,0.14)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  backText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  logo: { width: 92, height: 26 },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 24 },
  headerCard: {
    backgroundColor: '#0f1f45',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 12,
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  headerSub: { color: '#d1d9ff', marginTop: 4, fontSize: 13 },
  row: { flexDirection: 'row', gap: 10 },
  mainCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: '#10244e',
    padding: 12,
  },
  projectCard: { width: '48%', minHeight: 240 },
  streamCard: { width: '49%', minHeight: 240 },
  cardIcon: { fontSize: 34, marginBottom: 10 },
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  cardSub: { color: '#d6defd', marginTop: 8, fontSize: 12, lineHeight: 18 },
  streamTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  errorText: { color: '#fecaca', marginTop: 8, fontSize: 12 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  chipText: { color: '#0f172a', fontSize: 11, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 8, 25, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  popupWrap: { width: '100%', maxWidth: 420, borderRadius: 24, overflow: 'hidden' },
  popup: {
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    backgroundColor: 'rgba(26,32,64,0.45)',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 10,
  },
  closeText: { color: '#fff', fontSize: 22, marginTop: -2 },
  popupButton: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  popupButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
