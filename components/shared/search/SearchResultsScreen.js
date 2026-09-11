import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { Card, EmptyState, ScreenScaffold } from '../../ui';
import { useTranslations } from '../../../hooks/useTranslations';
import { groupResults, searchIndex } from '../../../services/shared/searchMatch';

/**
 * A search results screen for any light-tone panel: the query bar, the ranked groups, and the
 * "some things could not be included" notice.
 *
 * ── WHAT IT TAKES, AND WHY THAT IS ALL ──────────────────────────────────────
 * The teacher, parent and partner screens are the same 224 lines three times over. Diffed, they
 * differ in exactly three things that matter — which index loader they call, where Back goes, and
 * their copy — plus a component name and two prose comments. Their stylesheets are byte-identical.
 * So those three are the props, and nothing else needs to be.
 *
 * ── ONLY THE STAFF ROUTE USES THIS TODAY, ON PURPOSE ────────────────────────
 * The three shipped screens are deliberately left alone rather than converted here. `checksearch`
 * covers the STUDENT screen only, so converting teacher, parent and partner in a feature change
 * would mean three live panels verified by build and eyeball. Worse, `checkparentdashboard` reads
 * `ParentSearchScreen.js` by path and never asserts on it — delete that file and `readFileSync`
 * throws inside a mutation loop whose `catch` sets `caught = true`, so all twelve of its mutations
 * report a tick while testing nothing, and only then does the real run throw.
 *
 * Migrating them is a separate change that should also unify the accessibility label, repoint that
 * `checkparentdashboard` entry, and rewrite the two `checksearch` assertions that read the student
 * screen's source text. Until then this file is the fourth copy in shape but the only one anyone
 * has to edit again.
 *
 * ── NOT THE STUDENT'S ────────────────────────────────────────────────────────
 * `components/student/SearchScreen.js` diverges structurally, not cosmetically: a different
 * scaffold, card and note component, a palette-taking stylesheet, and colours off `p.onDark`.
 * Folding it in means parameterising over components as well as strings — a second, larger job.
 */

const FALLBACK_STRINGS = {
  title: 'Search',
  placeholder: 'Search sections, tools and more…',
  building: 'Getting everything ready…',
  emptyTitle: 'Search your portal',
  emptyBody: 'Look for a section — try “attendance”, “leave” or “payroll”.',
  noneTitle: 'Nothing matched',
  noneBody: 'Try fewer words, or a different spelling.',
  partial: 'Some things could not be included:',
  result: 'result',
  results: 'results',
};

/**
 * @param {object}   props
 * @param {(force: boolean) => Promise<{rows: Array, partial: string[]}>} props.loadIndex
 * @param {string}   props.fallbackRoute where Back goes when there is no stack to pop
 * @param {object}   [props.strings] merged over the defaults, then translated
 */
export default function SearchResultsScreen({ loadIndex, fallbackRoute, strings }) {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const t = useTranslations({ ...FALLBACK_STRINGS, ...(strings || {}) });
  const { q } = useLocalSearchParams();

  // Seeded from the dashboard's search bar, so someone who typed there does not type again.
  const [query, setQuery] = useState(typeof q === 'string' ? q : '');
  const [index, setIndex] = useState({ rows: [], partial: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const inputRef = useRef(null);

  const load = useCallback(
    async (force) => {
      const next = await loadIndex(force);
      setIndex(next || { rows: [], partial: [] });
      setLoading(false);
      setRefreshing(false);
    },
    [loadIndex],
  );

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
      fallbackRoute={fallbackRoute}
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
                        // "in" deliberately. The four existing screens disagree — teacher and
                        // partner read it out as ", Class 9", parent and student as ", in Class 9".
                        // The trail is a location, so the preposition earns its place; this is the
                        // form the migration should settle on.
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
