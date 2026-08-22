import { useCallback, useState } from 'react';
import { Image, Linking, Pressable, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { Card, EmptyState, FormSheet, ScreenScaffold, StatusChip, useToast } from '../../ui';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  COURSE_FEE_ROWS,
  accreditationBadges,
  eligibilityLine,
  fetchLinkedUniversities,
  isHttpUrl,
  placeLine,
  setUniversityVisibility,
} from '../../../services/admin/linkedCollegeService';
import { htmlToText } from '../../../utils/htmlToText';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Linked Colleges — the universities the PLATFORM admin has linked to this school, and whether
 * each is visible to the school's students.
 *
 * There is no add or remove here, by design: linking is done in the platform admin panel and this
 * page only flips visibility, which starts OFF for every new link.
 *
 * The web expands a full showcase panel inline, including an eleven-column course table. Here the
 * summary stays a card and "Details" opens a read-only FormSheet (it drops its action row when
 * `onSubmit` is omitted), with courses as cards rather than a table.
 */

const money = (value) => (value != null ? `₹${value}` : '—');

function DetailRow({ label, value }) {
  const styles = useStyles();
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function LinkAction({ icon, label, url }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  if (!isHttpUrl(url)) return null;
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [styles.linkAction, pressed && styles.pressed]}
      accessibilityRole="link"
    >
      <Ionicons name={icon} size={15} color={PALETTE.primaryDark} />
      <Text style={[styles.linkActionText, { color: PALETTE.primaryDark }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function CourseCard({ course }) {
  const styles = useStyles();
  return (
    <View style={styles.course}>
      <View style={styles.courseHead}>
        <Text style={styles.courseName}>{course.courseName}</Text>
        {course.popular ? <StatusChip label="Featured" tone="success" /> : null}
      </View>
      <Text style={styles.courseMeta}>
        {[course.department, course.duration, course.degreeLevel].filter(Boolean).join(' · ') || '—'}
      </Text>
      {COURSE_FEE_ROWS.map((row) => (
        <View key={row.field} style={styles.feeRow}>
          <Text style={styles.feeLabel}>{row.label}</Text>
          <Text style={styles.feeValue}>{money(course[row.field])}</Text>
        </View>
      ))}
      <Text style={styles.eligibility}>Eligibility: {eligibilityLine(course)}</Text>
      {course.courseDetails ? (
        <Text style={styles.courseDetails}>{htmlToText(course.courseDetails)}</Text>
      ) : null}
    </View>
  );
}

export default function LinkedCollegesScreen({ homeRoute, apiBase }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();
  const [detail, setDetail] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const fetcher = useCallback((signal) => fetchLinkedUniversities(apiBase, signal), [apiBase]);
  const { data, loading, error, refreshing, reload, refresh, setData } = useStaffResource(fetcher, {
    initialData: [],
  });

  const links = data || [];

  const toggle = async (link, next) => {
    setTogglingId(link.linkId);
    // Optimistic, as the web is — the switch is the whole interaction and a round-trip lag on it
    // reads as a broken control.
    setData((prev) =>
      (prev || []).map((l) => (l.linkId === link.linkId ? { ...l, visibleToStudents: next } : l)),
    );
    try {
      await setUniversityVisibility(apiBase, link.linkId, next);
    } catch (e) {
      setData((prev) =>
        (prev || []).map((l) =>
          l.linkId === link.linkId ? { ...l, visibleToStudents: !next } : l,
        ),
      );
      showToast(e?.message || 'Could not update visibility.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <ScreenScaffold
      title="Linked Colleges"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <Text style={styles.intro}>
        Universities linked to your school by the platform admin. Switch one on to make it visible
        to your students — new links start hidden until you enable them.
      </Text>

      {links.length === 0 ? (
        <EmptyState
          icon="business-outline"
          title="No linked universities"
          message="No universities have been linked to your school yet."
        />
      ) : (
        links.map((link) => (
          <Card key={link.linkId} style={styles.item}>
            <View style={styles.identity}>
              <View style={styles.logoBox}>
                {link.logoUrl ? (
                  <Image source={{ uri: link.logoUrl }} style={styles.logo} resizeMode="contain" />
                ) : (
                  <Ionicons name="business-outline" size={22} color={SLATE[400]} />
                )}
              </View>
              <View style={styles.identityText}>
                <Text style={styles.name} numberOfLines={2}>
                  {link.universityName}
                </Text>
                <Text style={styles.meta} numberOfLines={2}>
                  {[link.universityCode || '—', link.collegeType, placeLine(link)]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <StatusChip
                label={link.visibleToStudents ? 'Visible to students' : 'Hidden from students'}
                tone={link.visibleToStudents ? 'success' : 'neutral'}
              />
              <View style={styles.spacer} />
              <Switch
                value={!!link.visibleToStudents}
                onValueChange={(next) => toggle(link, next)}
                disabled={togglingId === link.linkId}
                trackColor={{ true: PALETTE.accent, false: SLATE[200] }}
                thumbColor={link.visibleToStudents ? PALETTE.primary : '#ffffff'}
              />
            </View>

            <Pressable
              onPress={() => setDetail(link)}
              style={({ pressed }) => [styles.detailBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={[styles.detailBtnText, { color: PALETTE.primaryDark }]}>
                View details
              </Text>
              <Ionicons name="chevron-forward" size={15} color={PALETTE.primaryDark} />
            </Pressable>
          </Card>
        ))
      )}

      <FormSheet
        visible={!!detail}
        title={detail?.universityName || 'University'}
        subtitle={placeLine(detail || {}) || undefined}
        onClose={() => setDetail(null)}
        fullHeight
      >
        {detail ? (
          <View>
            {detail.bannerUrl ? (
              <Image source={{ uri: detail.bannerUrl }} style={styles.banner} resizeMode="cover" />
            ) : null}

            {accreditationBadges(detail.accreditation).length ? (
              <View style={styles.badgeRow}>
                {accreditationBadges(detail.accreditation).map((badge) => (
                  <StatusChip key={badge} label={badge} tone="info" />
                ))}
              </View>
            ) : null}

            <DetailRow label="College type" value={detail.collegeType} />
            <DetailRow label="Established" value={detail.establishedYear} />
            <DetailRow label="Code" value={detail.universityCode} />
            <DetailRow
              label="Address"
              value={[detail.addressLine, detail.city, detail.state, detail.country, detail.postalCode]
                .filter(Boolean)
                .join(', ')}
            />
            <DetailRow label="Email" value={detail.admissionsEmail} />
            <DetailRow label="Phone" value={detail.phoneNumber} />

            {detail.description ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>About</Text>
                {/* The field is TipTap HTML. react-native-render-html cannot execute script, but
                    plain text reads better than a styled block inside a sheet. */}
                <Text style={styles.blockText}>{htmlToText(detail.description)}</Text>
              </View>
            ) : null}

            <View style={styles.linkRow}>
              <LinkAction icon="globe-outline" label="Website" url={detail.websiteUrl} />
              <LinkAction icon="map-outline" label="Map" url={detail.mapEmbedUrl} />
              <LinkAction icon="play-circle-outline" label="Video tour" url={detail.videoTourUrl} />
              <LinkAction icon="cube-outline" label="360° tour" url={detail.virtualTourUrl} />
            </View>

            {Array.isArray(detail.courses) && detail.courses.length ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Courses ({detail.courses.length})</Text>
                {detail.courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </FormSheet>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  intro: { fontSize: 13, color: SLATE[500], lineHeight: 19, marginBottom: SPACING.sm },
  item: { marginBottom: SPACING.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  logoBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: SLATE[50],
    borderWidth: 1,
    borderColor: SLATE[200],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: '100%', height: '100%' },
  identityText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: SLATE[800] },
  meta: { fontSize: 12, color: SLATE[500], marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm },
  spacer: { flex: 1 },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  detailBtnText: { fontSize: 13.5, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  banner: { width: '100%', height: 120, borderRadius: 10, marginBottom: SPACING.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
    gap: SPACING.sm,
  },
  detailLabel: { flex: 1, fontSize: 12.5, color: SLATE[500], fontWeight: '600' },
  detailValue: { flex: 1.4, fontSize: 13, color: SLATE[800], fontWeight: '600' },
  block: { marginTop: SPACING.md },
  blockTitle: { fontSize: 14, fontWeight: '800', color: p.primaryDark, marginBottom: 6 },
  blockText: { fontSize: 13, color: SLATE[600], lineHeight: 20 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACING.md },
  linkAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: p.tint,
  },
  linkActionText: { fontSize: 12.5, fontWeight: '700' },
  course: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    padding: SPACING.sm,
    marginTop: 8,
    backgroundColor: SLATE[50],
  },
  courseHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseName: { flex: 1, fontSize: 14, fontWeight: '700', color: SLATE[800] },
  courseMeta: { fontSize: 12, color: SLATE[500], marginTop: 2, marginBottom: 6 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  feeLabel: { fontSize: 12, color: SLATE[500] },
  feeValue: { fontSize: 12.5, color: SLATE[800], fontWeight: '700' },
  eligibility: { fontSize: 12, color: SLATE[600], marginTop: 6, fontWeight: '600' },
  courseDetails: { fontSize: 12, color: SLATE[500], marginTop: 5, lineHeight: 18 },
}));
