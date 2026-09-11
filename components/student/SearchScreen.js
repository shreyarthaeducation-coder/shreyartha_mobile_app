import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { EmptyState } from '../ui';
import StudentScaffold from './StudentScaffold';
import { StudentCard, StudentNote } from './StudentCard';
import { useTranslations } from '../../hooks/useTranslations';
import { groupResults, loadSearchIndex, searchIndex } from '../../services/student/searchService';

/**
 * Search — topics, chapters, skills and screens, across the whole panel.
 *
 * ── THE INDEX IS BUILT ONCE, THEN MATCHING IS LOCAL ─────────────────────────
 * There is no search endpoint on the backend, so `loadSearchIndex()` fans out over the six module
 * trees on first use and caches the result for a day. That means the first search of the day waits
 * on six requests and every one after it is instant — which is the right way round, because a
 * student searching once usually searches three times.
 *
 * Matching happens on every keystroke with no debounce, and that is deliberate rather than sloppy:
 * there is no network in the loop, so a debounce would only add lag to a pure array filter.
 *
 * ── A PARTIAL INDEX SAYS SO ────────────────────────────────────────────────
 * `/api/coding/tree` requires a student role and a free or college student can be refused it. When
 * a module is missing from the index the screen names it, rather than quietly returning no results
 * for a topic the student knows exists.
 */

const STRINGS = {
  title: 'Search',
  placeholder: 'Search topics, resources, courses and more…',
  building: 'Getting everything ready…',
  emptyTitle: 'Search the platform',
  emptyBody:
    'Look for a topic, a chapter, a skill, or any screen — try “photosynthesis”, “homework” or “trigonometry”.',
  noneTitle: 'Nothing matched',
  noneBody: 'Try fewer words, or a different spelling.',
  partial: 'Some sections could not be included:',
  results: 'result',
  resultsPlural: 'results',
};

export default function SearchScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const t = useTranslations(STRINGS);
  const { q } = useLocalSearchParams();

  // Seeded from the dashboard's search bar, so a student who typed there does not type again.
  const [query, setQuery] = useState(typeof q === 'string' ? q : '');
  const [index, setIndex] = useState({ rows: [], partial: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const inputRef = useRef(null);

  const load = useCallback(async (force) => {
    const next = await loadSearchIndex(force);
    setIndex(next);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  // Focus only when the student arrived with nothing typed. Stealing focus from a seeded query
  // would pop the keyboard over the results they came to read.
  useEffect(() => {
    if (!loading && !query) {
      const timer = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading, query]);

  const results = useMemo(() => searchIndex(index.rows, query), [index.rows, query]);
  const groups = useMemo(() => groupResults(results), [results]);

  const open = (row) => router.push(row.route);

  return (
    <StudentScaffold
      title={t.title}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load(true);
      }}
    >
      <View style={styles.bar}>
        <Ionicons name="search" size={20} color={SLATE[600]} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={t.placeholder}
          placeholderTextColor={SLATE[600]}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={19} color={SLATE[600]} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.building}>{t.building}</Text>
        </View>
      ) : (
        <>
          {index.partial.length > 0 ? (
            <StudentCard>
              <StudentNote>
                {t.partial} {index.partial.join(', ')}.
              </StudentNote>
            </StudentCard>
          ) : null}

          {!query.trim() ? (
            <EmptyState icon="search-outline" title={t.emptyTitle} message={t.emptyBody} />
          ) : results.length === 0 ? (
            <EmptyState icon="help-circle-outline" title={t.noneTitle} message={t.noneBody} />
          ) : (
            <>
              <Text style={styles.count}>
                {results.length} {results.length === 1 ? t.results : t.resultsPlural}
              </Text>

              {groups.map((group) => (
                <View key={group.module}>
                  <Text style={styles.group}>{group.module}</Text>
                  <StudentCard>
                    {group.rows.map((row, i) => (
                      <Pressable
                        key={`${row.module}-${row.name}-${row.trail}-${i}`}
                        onPress={() => open(row)}
                        style={({ pressed }) => [
                          styles.row,
                          i > 0 && styles.rowDivided,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${row.name}${row.trail ? `, in ${row.trail}` : ''}`}
                      >
                        <Ionicons
                          name={row.kind === 'screen' ? 'apps-outline' : 'document-text-outline'}
                          size={18}
                          color={palette.primary}
                        />
                        <View style={styles.rowText}>
                          <Text style={styles.rowName} numberOfLines={2}>
                            {row.name}
                          </Text>
                          {row.trail ? (
                            <Text style={styles.rowTrail} numberOfLines={1}>
                              {row.trail}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={17} color={SLATE[600]} />
                      </Pressable>
                    ))}
                  </StudentCard>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE[200],
    marginBottom: SPACING.md,
  },
  // No per-focus setState: the border never changes, so the field cannot re-render on focus and
  // take the Android keyboard down with it. See components/auth/FormField.
  input: { flex: 1, paddingVertical: 12, fontSize: TYPE.label, color: SLATE[800] },

  centre: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.md },
  building: { fontSize: TYPE.label, color: SLATE[600] },

  count: { fontSize: TYPE.caption, color: SLATE[600], marginBottom: SPACING.sm },
  group: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: SLATE[600],
    marginBottom: SPACING.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    paddingVertical: 6,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: SLATE[200] },
  rowText: { flex: 1 },
  rowName: { fontSize: TYPE.body, fontWeight: '600', color: SLATE[800] },
  rowTrail: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 1 },

  pressed: { opacity: 0.75 },
}));
