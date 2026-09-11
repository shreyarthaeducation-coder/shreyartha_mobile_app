import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { Card, EmptyState, ScreenScaffold } from '../ui';
import { useTranslations } from '../../hooks/useTranslations';
import {
  groupResults,
  loadTeacherSearchIndex,
  searchIndex,
} from '../../services/teacher/searchService';

/**
 * Search across the teacher portal — every tab, plus the teacher's own classes and sections.
 *
 * Fourth use of the shared matcher in `services/shared/searchMatch.js`; only the index differs. See
 * that file for the ranking rules and `services/teacher/searchService.js` for what goes in.
 *
 * ── THE DESTINATIONS COME FROM THE MENU ─────────────────────────────────────
 * `TEACHER_MENU` is derived from the workspace groups plus the attendance items plus the profile
 * item, so the index is exactly the sixteen tabs however the redesign regrouped them. That is why
 * the service reads it rather than retyping the labels — a retyped list keeps naming a tab after
 * the menu has renamed it.
 */

const STRINGS = {
  title: 'Search',
  placeholder: 'Search resources, tools, students and more…',
  building: 'Getting everything ready…',
  emptyTitle: 'Search your portal',
  emptyBody:
    'Look for a section or one of your classes — try “homework”, “syllabus”, “payroll” or a class name.',
  noneTitle: 'Nothing matched',
  noneBody: 'Try fewer words, or a different spelling.',
  partial: 'Some things could not be included:',
  result: 'result',
  results: 'results',
};

export default function TeacherSearchScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const t = useTranslations(STRINGS);
  const { q } = useLocalSearchParams();

  // Seeded from the dashboard's search bar, so a teacher who typed there does not type again.
  const [query, setQuery] = useState(typeof q === 'string' ? q : '');
  const [index, setIndex] = useState({ rows: [], partial: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const inputRef = useRef(null);

  const load = useCallback(async (force) => {
    const next = await loadTeacherSearchIndex(force);
    setIndex(next);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  // Focus only when they arrived with nothing typed. Stealing focus from a seeded query would pop
  // the keyboard over the results they came to read.
  useEffect(() => {
    if (!loading && !query) {
      const timer = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading, query]);

  const results = useMemo(() => searchIndex(index.rows, query), [index.rows, query]);
  const groups = useMemo(() => groupResults(results), [results]);

  return (
    <ScreenScaffold
      title={t.title}
      fallbackRoute="/teacher"
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load(true);
      }}
    >
      <View style={styles.bar}>
        <Ionicons name="search" size={20} color={SLATE[400]} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={t.placeholder}
          placeholderTextColor={SLATE[500]}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={19} color={SLATE[400]} />
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
            <Card>
              <Text style={styles.note}>
                {t.partial} {index.partial.join(', ')}.
              </Text>
            </Card>
          ) : null}

          {!query.trim() ? (
            <EmptyState icon="search-outline" title={t.emptyTitle} message={t.emptyBody} />
          ) : results.length === 0 ? (
            <EmptyState icon="help-circle-outline" title={t.noneTitle} message={t.noneBody} />
          ) : (
            <>
              <Text style={styles.count}>
                {results.length} {results.length === 1 ? t.result : t.results}
              </Text>

              {groups.map((group) => (
                <View key={group.module}>
                  <Text style={styles.group}>{group.module}</Text>
                  <Card>
                    {group.rows.map((row, i) => (
                      <Pressable
                        key={`${row.module}-${row.name}-${row.trail}-${i}`}
                        onPress={() => router.push(row.route)}
                        style={({ pressed }) => [
                          styles.row,
                          i > 0 && styles.rowDivided,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${row.name}${row.trail ? `, ${row.trail}` : ''}`}
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
                        <Ionicons name="chevron-forward" size={17} color={SLATE[400]} />
                      </Pressable>
                    ))}
                  </Card>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE[200],
    marginBottom: SPACING.sm,
  },
  // No per-focus setState: the border never changes, so the field cannot re-render on focus and
  // take the Android keyboard down with it. See components/auth/FormField.
  input: { flex: 1, paddingVertical: 12, fontSize: TYPE.label, color: SLATE[800] },

  centre: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.md },
  building: { fontSize: TYPE.label, color: SLATE[500] },
  note: { fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body) },

  count: { fontSize: TYPE.caption, color: SLATE[500], marginTop: SPACING.sm },
  group: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: SLATE[500],
    marginTop: SPACING.md,
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
  rowTrail: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 1 },

  pressed: { opacity: 0.75 },
}));
