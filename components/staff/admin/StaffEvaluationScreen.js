import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { Card, EmptyState, FormSheet, ScreenScaffold, StatusChip, useToast } from '../../ui';
import { ProgressBar } from '../../ui/charts';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  EVALUATION_METRICS,
  EVAL_ROLE_COLOR,
  RATING_MAX,
  adminBlockScore,
  fetchAdminEvaluation,
  fetchEvaluationDetail,
  fetchEvaluationStaff,
  fetchStaffTypes,
  metricPercent,
  prettyRoleName,
  submitEvaluation,
  validateRatings,
} from '../../../services/admin/evaluationService';
import { initialsOf } from '../helpers';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Staff Evaluation — pick a category, pick a member, read their composite score, rate them.
 *
 * The web is three routes (StaffTypeCards → StaffEvaluationList → StaffEvaluationDetail) plus a
 * modal. Here it is ONE screen with a level derived from state, because pushing three times for a
 * drill-down leaves a phone back-stack that has to be unwound tap by tap to change category.
 *
 * The admin only ever writes three of the six metrics — discipline, integrity, professionalism.
 * The rest are computed from attendance, syllabus and the like, and are read-only everywhere.
 */

const EMPTY_RATINGS = { discipline: 0, integrity: 0, professionalism: 0 };

function Stars({ value, onChange, disabled }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  return (
    <View style={styles.stars}>
      {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((point) => (
        <Pressable
          key={point}
          onPress={() => onChange(point)}
          disabled={disabled}
          style={({ pressed }) => [styles.star, pressed && styles.pressed]}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === point }}
          accessibilityLabel={`${point} of ${RATING_MAX}`}
        >
          <Ionicons
            name={point <= value ? 'star' : 'star-outline'}
            size={26}
            color={point <= value ? PALETTE.primary : SLATE[300]}
          />
        </Pressable>
      ))}
    </View>
  );
}

export default function StaffEvaluationScreen({ homeRoute, apiBase }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();

  const [role, setRole] = useState(null);
  const [staffId, setStaffId] = useState(null);
  const [rating, setRating] = useState(null); // the member being rated, or null
  const [ratings, setRatings] = useState(EMPTY_RATINGS);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [saving, setSaving] = useState(false);

  const typesFetcher = useCallback((signal) => fetchStaffTypes(apiBase, signal), [apiBase]);
  const {
    data: types,
    loading: typesLoading,
    error: typesError,
    refreshing,
    reload,
    refresh,
  } = useStaffResource(typesFetcher, { initialData: [] });

  const listFetcher = useCallback(
    (signal) => fetchEvaluationStaff(apiBase, role, signal),
    [apiBase, role],
  );
  const {
    data: staff,
    loading: listLoading,
    error: listError,
    revalidate: revalidateList,
  } = useStaffResource(listFetcher, { enabled: !!role, initialData: [] });

  const detailFetcher = useCallback(
    (signal) => fetchEvaluationDetail(apiBase, staffId, signal),
    [apiBase, staffId],
  );
  const {
    data: detail,
    loading: detailLoading,
    error: detailError,
    revalidate: revalidateDetail,
  } = useStaffResource(detailFetcher, { enabled: !!staffId, initialData: null });

  // Load any existing ratings when the sheet opens. Keyed on the ID ALONE — `rating` is an object
  // the caller rebuilds every render, and depending on it would refetch forever. Same trap the
  // teacher report sheets hit.
  const ratingId = rating?.id ?? null;
  useEffect(() => {
    if (!ratingId) return undefined;
    let alive = true;
    setLoadingRatings(true);
    setRatings(EMPTY_RATINGS);
    (async () => {
      const existing = await fetchAdminEvaluation(apiBase, ratingId);
      if (!alive) return;
      if (existing) setRatings(existing);
      setLoadingRatings(false);
    })();
    return () => {
      alive = false;
    };
  }, [apiBase, ratingId]);

  const submit = async () => {
    const problem = validateRatings(ratings);
    if (problem) {
      showToast(problem, 'error');
      return;
    }
    setSaving(true);
    try {
      await submitEvaluation(apiBase, ratingId, ratings);
      showToast('Evaluation submitted.', 'success');
      setRating(null);
      await revalidateList();
      if (staffId) await revalidateDetail();
    } catch (e) {
      showToast(e?.message || 'Failed to submit evaluation.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const level = staffId ? 'detail' : role ? 'list' : 'types';
  const back = () => (staffId ? setStaffId(null) : setRole(null));

  const staffRows = staff || [];
  const metrics = Array.isArray(detail?.metrics) ? detail.metrics : [];

  return (
    <ScreenScaffold
      title="Staff Evaluation"
      fallbackRoute={homeRoute}
      loading={level === 'types' && typesLoading}
      error={level === 'types' ? typesError : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      {level !== 'types' ? (
        <Pressable
          onPress={back}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={16} color={PALETTE.primaryDark} />
          <Text style={[styles.backText, { color: PALETTE.primaryDark }]}>
            {staffId ? prettyRoleName(role) : 'All categories'}
          </Text>
        </Pressable>
      ) : null}

      {level === 'types' ? (
        (types || []).length === 0 ? (
          <EmptyState
            icon="trending-up-outline"
            title="No staff categories"
            message="Nobody has been added to this school yet."
          />
        ) : (
          <View>
            <Text style={styles.intro}>
              Select a staff category to view and evaluate its members.
            </Text>
            {(types || []).map((item) => (
              <Pressable
                key={item}
                onPress={() => setRole(item)}
                style={({ pressed }) => [styles.typeCard, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <View
                  style={[styles.typeDot, { backgroundColor: EVAL_ROLE_COLOR[item] || SLATE[400] }]}
                />
                <Text style={styles.typeName}>{prettyRoleName(item)}</Text>
                <Ionicons name="chevron-forward" size={17} color={SLATE[400]} />
              </Pressable>
            ))}
          </View>
        )
      ) : level === 'list' ? (
        listLoading ? (
          <ActivityIndicator style={styles.spinner} color={PALETTE.primary} />
        ) : listError ? (
          <Text style={styles.error}>{listError}</Text>
        ) : staffRows.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="Nobody here"
            message="No staff member of this category has been added yet."
          />
        ) : (
          staffRows.map((member) => (
            <Card key={member.id} style={styles.item}>
              <Pressable
                onPress={() => setStaffId(member.id)}
                style={({ pressed }) => [styles.memberHead, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <View style={[styles.avatar, { backgroundColor: PALETTE.tint }]}>
                  <Text style={[styles.avatarText, { color: PALETTE.primaryDark }]}>
                    {initialsOf(member.fullName)}
                  </Text>
                </View>
                <View style={styles.memberText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {member.fullName}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {member.designation || member.email || '—'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={SLATE[400]} />
              </Pressable>
              <Pressable
                onPress={() => setRating(member)}
                style={({ pressed }) => [
                  styles.evalBtn,
                  { backgroundColor: PALETTE.primary },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.evalBtnText}>
                  {member.hasAdminEvaluation ? 'Re-evaluate' : 'Evaluate'}
                </Text>
              </Pressable>
            </Card>
          ))
        )
      ) : detailLoading ? (
        <ActivityIndicator style={styles.spinner} color={PALETTE.primary} />
      ) : detailError ? (
        <Text style={styles.error}>{detailError}</Text>
      ) : detail ? (
        <View>
          <Card>
            <View style={styles.memberHead}>
              <View style={[styles.avatar, { backgroundColor: PALETTE.tint }]}>
                <Text style={[styles.avatarText, { color: PALETTE.primaryDark }]}>
                  {initialsOf(detail.fullName)}
                </Text>
              </View>
              <View style={styles.memberText}>
                <Text style={styles.name}>{detail.fullName}</Text>
                <Text style={styles.sub} numberOfLines={2}>
                  {[prettyRoleName(detail.role), detail.designation, detail.department]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>
            <View style={styles.scoreBox}>
              <Text style={[styles.score, { color: PALETTE.primary }]}>
                {typeof detail.totalScore === 'number' ? detail.totalScore.toFixed(1) : '—'}
              </Text>
              <Text style={styles.scoreLabel}>
                Composite score across {metrics.length || 6} weighted metrics
              </Text>
            </View>
            <Pressable
              onPress={() =>
                setRating({ id: staffId, fullName: detail.fullName, role: detail.role })
              }
              style={({ pressed }) => [
                styles.evalBtn,
                { backgroundColor: PALETTE.primary },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.evalBtnText}>
                {detail.hasAdminEvaluation ? 'Re-evaluate' : 'Evaluate'}
              </Text>
            </Pressable>
          </Card>

          <Text style={styles.sectionTitle}>Evaluation breakdown</Text>
          {metrics.length === 0 ? (
            <Text style={styles.sub}>No metric breakdown is available for this member.</Text>
          ) : (
            metrics.map((metric, index) => {
              // The admin block can arrive with actualScore 0 while its ratings exist; the web
              // rescales them onto its own five points rather than drawing an empty bar.
              const raw =
                typeof metric.actualScore === 'number' && metric.actualScore > 0
                  ? metric.actualScore
                  : /admin/i.test(metric.name || '')
                    ? adminBlockScore(detail.adminEvaluationDetail)
                    : 0;
              const max = typeof metric.maxScore === 'number' ? metric.maxScore : 0;
              return (
                <Card key={metric.name || index} style={styles.item}>
                  <View style={styles.metricHead}>
                    <Text style={styles.metricName} numberOfLines={2}>
                      {metric.name}
                    </Text>
                    {metric.percentage != null ? (
                      <StatusChip label={`${metric.percentage}%`} tone="neutral" />
                    ) : null}
                  </View>
                  <Text style={[styles.metricScore, { color: PALETTE.primaryDark }]}>
                    {raw.toFixed(2)} / {max}
                  </Text>
                  <ProgressBar value={metricPercent(raw, max)} color={PALETTE.primary} />
                </Card>
              );
            })
          )}
        </View>
      ) : null}

      <FormSheet
        visible={!!rating}
        title={rating?.fullName || 'Evaluate'}
        subtitle={rating ? prettyRoleName(rating.role) : undefined}
        onClose={() => setRating(null)}
        onSubmit={submit}
        submitLabel="Submit"
        submitting={saving}
        submitDisabled={loadingRatings}
      >
        <Text style={styles.sheetHint}>
          Rate each area from 1 to {RATING_MAX}. These three are the only metrics an administrator
          sets — the rest of the score is computed from attendance and syllabus records.
        </Text>
        {loadingRatings ? (
          <ActivityIndicator style={styles.spinner} color={PALETTE.primary} />
        ) : (
          EVALUATION_METRICS.map((metric) => (
            <View key={metric.key} style={styles.metricRow}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Stars
                value={ratings[metric.key]}
                onChange={(value) => setRatings((prev) => ({ ...prev, [metric.key]: value }))}
                disabled={saving}
              />
            </View>
          ))
        )}
      </FormSheet>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  intro: { fontSize: 13, color: SLATE[500], marginBottom: SPACING.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: SPACING.sm },
  backText: { fontSize: 13.5, fontWeight: '700' },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: 8,
  },
  typeDot: { width: 10, height: 10, borderRadius: 5 },
  typeName: { flex: 1, fontSize: 14.5, fontWeight: '700', color: SLATE[800] },
  item: { marginBottom: SPACING.sm },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800' },
  memberText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: SLATE[800] },
  sub: { fontSize: 12.5, color: SLATE[500], marginTop: 2 },
  evalBtn: { marginTop: SPACING.sm, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  evalBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13.5 },
  scoreBox: { alignItems: 'center', marginTop: SPACING.md },
  score: { fontSize: 38, fontWeight: '800' },
  scoreLabel: { fontSize: 12, color: SLATE[500], textAlign: 'center', marginTop: 2 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: SLATE[700],
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  metricHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricName: { flex: 1, fontSize: 14, fontWeight: '700', color: SLATE[800] },
  metricScore: { fontSize: 17, fontWeight: '800', marginTop: 4, marginBottom: 6 },
  sheetHint: { fontSize: 12.5, color: SLATE[500], lineHeight: 18, marginBottom: SPACING.sm },
  metricRow: { marginTop: SPACING.sm },
  metricLabel: { fontSize: 13.5, fontWeight: '700', color: SLATE[700], marginBottom: 4 },
  stars: { flexDirection: 'row', gap: 4 },
  star: { padding: 2 },
  spinner: { marginTop: SPACING.lg },
  error: { fontSize: 13, color: SLATE[500], marginTop: SPACING.sm },
  pressed: { opacity: 0.7 },
}));
