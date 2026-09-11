import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { Card, EmptyState, ScreenScaffold, Select, StatusChip } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import useSortableRows from '../../hooks/useSortableRows';
import { fetchProfile } from '../../services/partner/profileService';
import { fetchSchoolStudents, totalPaid } from '../../services/partner/analyticsService';
import { formatRupees, formatShortDate } from '../../utils/currency';

/**
 * School Analytics — the students at a linked school who subscribed.
 *
 * Ports frontendmain/src/Partner/platform/PartnerSchoolAnalytics.js: profile → school picker →
 * `/analytics/schools/{code}/students`, sortable and searchable, with a paid total in the footer.
 *
 * ── WHY `Select` AND NOT `ScopePicker` ──────────────────────────────────────────────────────────
 * ScopePicker is shaped for the teacher's tree (Academic Year → Class → Section → Subject) and
 * loads it from services/teacher/scopeService. What is needed here is a flat list of school codes
 * out of `PartnerProfileResponse.linkedSchoolCodes[]`. Different shape, different source — `Select`
 * is the right primitive and ScopePicker would have to be gutted to fit.
 *
 * ── THE TOTAL COUNTS EVERY ROW, CANCELLED INCLUDED ──────────────────────────────────────────────
 * Deliberate, and matching the web. This screen is a roster of who subscribed at a school, not a
 * revenue report — Monetization is the revenue report and it *does* exclude cancellations. The two
 * totals are supposed to differ; a partner comparing them is comparing different questions.
 */

export default function PartnerSchoolAnalyticsScreen({ homeRoute = '/partner' }) {
  const styles = useStyles();
  const palette = usePalette();

  const [codes, setCodes] = useState([]);
  const [code, setCode] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [rowsRaw, setRowsRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    setError('');
    try {
      const profile = await fetchProfile();
      const list = Array.isArray(profile?.linkedSchoolCodes) ? profile.linkedSchoolCodes : [];
      setCodes(list);
      setPartnerCode(profile?.partnerCode || '');
      // Auto-select the first school: a partner with one linked school (the common case) should
      // not have to make a choice that has only one answer.
      setCode((cur) => cur || list[0] || '');
      if (list.length === 0) setLoading(false);
    } catch (e) {
      setError(e?.message || 'Could not load your linked schools.');
      setLoading(false);
    }
  }, []);

  const loadStudents = useCallback(async (schoolCode, mode) => {
    if (!schoolCode) return;
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await fetchSchoolStudents(schoolCode);
      setRowsRaw(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Could not load students for this school.');
      setRowsRaw([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (code) loadStudents(code, 'load');
  }, [code, loadStudents]);

  const { rows, search, setSearch, toggle, indicatorFor } = useSortableRows(rowsRaw, {
    searchKeys: ['studentName', 'email', 'currentClass', 'section', 'subscriptionType'],
    initialSort: { key: 'studentName', dir: 'asc' },
  });

  const indicatorIcon = (key) => {
    const state = indicatorFor(key);
    if (state === 'asc') return 'arrow-up';
    if (state === 'desc') return 'arrow-down';
    return 'swap-vertical';
  };

  const SORTS = [
    ['studentName', 'Name'],
    ['currentClass', 'Class'],
    ['amountPaid', 'Paid'],
    ['purchasedAt', 'Date'],
  ];

  return (
    <ScreenScaffold
      title="School Analytics"
      fallbackRoute={homeRoute}
      loading={loading}
      error={rowsRaw.length === 0 ? error : ''}
      notice={rowsRaw.length > 0 ? error : ''}
      onRetry={() => (code ? loadStudents(code, 'load') : loadProfile())}
      refreshing={refreshing}
      onRefresh={() => loadStudents(code, 'refresh')}
    >
      {codes.length === 0 && !loading ? (
        <EmptyState
          icon="business-outline"
          title="No linked schools"
          message="Schools linked to your partner code will appear here once an administrator adds them."
        />
      ) : (
        <>
          {/* One school needs no picker; more than one does. */}
          {codes.length > 1 ? (
            <Select
              variant="chip"
              label="School"
              value={code}
              options={codes.map((c) => ({ value: c, label: c }))}
              onChange={setCode}
            />
          ) : (
            <Text style={styles.oneSchool}>{code}</Text>
          )}

          <View style={styles.summary}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{rowsRaw.length}</Text>
              <Text style={styles.summaryLabel}>Students</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{formatRupees(totalPaid(rowsRaw))}</Text>
              <Text style={styles.summaryLabel}>Total paid</Text>
            </View>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={SLATE[400]} />
            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Search name, email or class"
              placeholderTextColor={SLATE[500]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={SLATE[400]} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.sortBar}>
            {SORTS.map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => toggle(key)}
                style={({ pressed }) => [
                  styles.sortChip,
                  indicatorFor(key) !== 'none' && styles.sortChipOn,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${label}`}
              >
                <Text
                  style={[styles.sortText, indicatorFor(key) !== 'none' && styles.sortTextOn]}
                >
                  {label}
                </Text>
                <Ionicons
                  name={indicatorIcon(key)}
                  size={12}
                  color={indicatorFor(key) !== 'none' ? palette.onPrimary : palette.primaryDark}
                />
              </Pressable>
            ))}
          </View>

          {rows.length === 0 && !loading ? (
            <EmptyState
              icon="people-outline"
              title={search ? 'No matches' : 'No subscribed students yet'}
              message={
                search
                  ? 'No student matches that search.'
                  : 'Students at this school who subscribe will appear here.'
              }
            />
          ) : (
            rows.map((r) => {
              // The endpoint returns EVERY subscribed student at the school, including ones who
              // came through a different partner. Flagging whose code was used is the difference
              // between "my school" and "my students".
              const mine =
                !!partnerCode &&
                String(r.partnerCodeUsed || '').toUpperCase() === partnerCode.toUpperCase();
              return (
                <Card key={r.studentId}>
                  <View style={styles.rowHead}>
                    <Text style={styles.student} numberOfLines={1}>
                      {r.studentName || '—'}
                    </Text>
                    <Text style={styles.paid}>{formatRupees(r.amountPaid)}</Text>
                  </View>

                  <View style={styles.chips}>
                    {r.currentClass ? (
                      <StatusChip
                        label={`Class ${r.currentClass}${r.section ? ` ${r.section}` : ''}`}
                        tone="neutral"
                      />
                    ) : null}
                    {r.subscriptionType ? (
                      <StatusChip label={r.subscriptionType} tone="info" />
                    ) : null}
                    {r.subscriptionStatus ? (
                      <StatusChip
                        label={r.subscriptionStatus}
                        tone={
                          String(r.subscriptionStatus).toUpperCase() === 'ACTIVE'
                            ? 'success'
                            : 'warning'
                        }
                      />
                    ) : null}
                    {mine ? <StatusChip label="Your code" tone="success" /> : null}
                  </View>

                  {r.email ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      {r.email}
                    </Text>
                  ) : null}
                  <Text style={styles.meta}>
                    {`${formatShortDate(r.purchasedAt) || '—'} → ${formatShortDate(r.expiresAt) || '—'}`}
                  </Text>
                </Card>
              );
            })
          )}
        </>
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  oneSchool: {
    fontSize: TYPE.title,
    fontWeight: '700',
    color: p.primaryDark,
    marginBottom: SPACING.sm,
  },
  summary: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    backgroundColor: p.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: p.cardBorder,
  },
  summaryValue: { fontSize: TYPE.title, fontWeight: '800', color: p.primaryDark },
  summaryLabel: { fontSize: TYPE.micro, color: SLATE[600], marginTop: 2 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    backgroundColor: p.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.inputBorder,
    marginBottom: SPACING.sm,
  },
  search: { flex: 1, fontSize: TYPE.body, color: SLATE[800] },

  sortBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: p.cardBorder,
    backgroundColor: p.card,
  },
  sortChipOn: { backgroundColor: p.primary, borderColor: p.primary },
  sortText: { fontSize: TYPE.caption, fontWeight: '600', color: p.primaryDark },
  sortTextOn: { color: p.onPrimary },

  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  student: { flex: 1, fontSize: TYPE.title, fontWeight: '700', color: p.primaryDark },
  paid: { fontSize: TYPE.title, fontWeight: '800', color: p.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  meta: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 4 },
  pressed: { opacity: 0.75 },
}));
