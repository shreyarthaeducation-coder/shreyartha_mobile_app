// app/student/resources.js
// Native Resources screen — displays learning materials, documents, and
// school-specific resources returned by the backend.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { studentService } from '../../services/studentService';
import { STUDENT } from '../../constants/theme';

// ─── Category colour mapping ──────────────────────────────────────────────────
const CATEGORY_COLORS = {
  documents: '#4F46E5',
  videos: '#f43f5e',
  quizzes: '#f59e0b',
  notes: '#10b981',
  assignments: '#06b6d4',
  books: '#8b5cf6',
  default: '#4F46E5',
};

const CATEGORY_ICONS = {
  documents: '📄',
  videos: '🎬',
  quizzes: '📝',
  notes: '📒',
  assignments: '📋',
  books: '📘',
  default: '📁',
};

function categoryColor(cat) {
  const key = (cat || 'default').toLowerCase();
  return CATEGORY_COLORS[key] || CATEGORY_COLORS.default;
}

function categoryIcon(cat) {
  const key = (cat || 'default').toLowerCase();
  return CATEGORY_ICONS[key] || CATEGORY_ICONS.default;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryPill({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ResourceCard({ item }) {
  const cat = item.category || item.type || 'default';
  const color = categoryColor(cat);
  const icon = item.icon || categoryIcon(cat);

  const handleOpen = () => {
    const url = item.url || item.link || item.fileUrl;
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.resourceCard, { borderColor: color + '44' }]}>
      <View style={[styles.resourceIconBg, { backgroundColor: color + '22' }]}>
        <Text style={styles.resourceIcon}>{icon}</Text>
      </View>
      <View style={styles.resourceInfo}>
        <Text style={styles.resourceTitle} numberOfLines={2}>{item.title || item.name || 'Resource'}</Text>
        {item.subject ? <Text style={styles.resourceSubject}>{item.subject}</Text> : null}
        {item.description ? (
          <Text style={styles.resourceDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.resourceMeta}>
          <View style={[styles.typeBadge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.typeText, { color }]}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </View>
          {item.size ? <Text style={styles.resourceSize}>{item.size}</Text> : null}
        </View>
      </View>
      {(item.url || item.link || item.fileUrl) ? (
        <TouchableOpacity style={[styles.openBtn, { backgroundColor: color }]} onPress={handleOpen}>
          <Text style={styles.openBtnText}>Open</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ResourcesScreen() {
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await studentService.getResources();
      const list = data?.resources || data?.items || (Array.isArray(data) ? data : []);
      setResources(list);

      // Derive categories from returned data
      const cats = new Set(['All']);
      list.forEach((r) => {
        const c = r.category || r.type;
        if (c) cats.add(c.charAt(0).toUpperCase() + c.slice(1));
      });
      setCategories([...cats]);
    } catch (err) {
      setError(err?.message || 'Could not load resources.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  const filtered =
    activeCategory === 'All'
      ? resources
      : resources.filter(
          (r) =>
            (r.category || r.type || '').toLowerCase() ===
            activeCategory.toLowerCase()
        );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Resources</Text>
        <Text style={styles.screenSub}>Learning materials & documents</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={STUDENT.accent} />
          <Text style={styles.loaderText}>Loading resources…</Text>
        </View>
      ) : (
        <>
          {/* ── Category pills ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillsScroll}
            contentContainerStyle={styles.pillsContent}
          >
            {categories.map((c) => (
              <CategoryPill
                key={c}
                label={c}
                active={activeCategory === c}
                onPress={() => setActiveCategory(c)}
              />
            ))}
          </ScrollView>

          {/* ── Resources list ── */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={STUDENT.accent}
                colors={[STUDENT.accent]}
              />
            }
          >
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️  {error}</Text>
              </View>
            ) : null}

            {filtered.length > 0 ? (
              filtered.map((item, i) => <ResourceCard key={item.id || item.resourceId || i} item={item} />)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📂</Text>
                <Text style={styles.emptyTitle}>No resources found</Text>
                <Text style={styles.emptyText}>
                  {activeCategory === 'All'
                    ? 'Your learning materials will appear here once uploaded by your school.'
                    : `No ${activeCategory.toLowerCase()} available yet.`}
                </Text>
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: STUDENT.bg },

  screenHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: STUDENT.border,
  },
  screenTitle: { fontSize: 22, fontWeight: '800', color: STUDENT.textPrimary },
  screenSub: { fontSize: 13, color: STUDENT.textMuted, marginTop: 2 },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { color: STUDENT.textMuted, fontSize: 14 },

  // Category pills
  pillsScroll: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: STUDENT.border },
  pillsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: STUDENT.bgCard,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  pillActive: {
    backgroundColor: STUDENT.accent,
    borderColor: STUDENT.accent,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: STUDENT.textMuted },
  pillTextActive: { color: '#fff' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14 },

  errorBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: '#f43f5e', fontSize: 13 },

  // Resource card
  resourceCard: {
    backgroundColor: STUDENT.bgCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    ...STUDENT.shadow,
  },
  resourceIconBg: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resourceIcon: { fontSize: 22 },
  resourceInfo: { flex: 1 },
  resourceTitle: { fontSize: 14, fontWeight: '700', color: STUDENT.textPrimary, marginBottom: 3 },
  resourceSubject: { fontSize: 12, color: STUDENT.accent, fontWeight: '600', marginBottom: 3 },
  resourceDesc: { fontSize: 12, color: STUDENT.textSecondary, lineHeight: 17, marginBottom: 6 },
  resourceMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 11, fontWeight: '600' },
  resourceSize: { fontSize: 11, color: STUDENT.textMuted },
  openBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignSelf: 'center',
    flexShrink: 0,
  },
  openBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Empty state
  emptyCard: {
    backgroundColor: STUDENT.bgCard,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: STUDENT.textPrimary, marginBottom: 6 },
  emptyText: { fontSize: 13, color: STUDENT.textMuted, textAlign: 'center', lineHeight: 19 },
});
