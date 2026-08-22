import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SHADOWS, SLATE, SPACING } from '../../constants/theme';
import { usePalette } from '../../components/ui/PaletteContext';
import { api } from '../../services/apiService';
import useStaffLogout from '../../hooks/useStaffLogout';
import StaffHeader from './StaffHeader';
import { initialsOf, prettyRole } from './helpers';
import { SegmentedTabs, Toast, useToast } from '../ui';
import AcademicTab from './profile/AcademicTab';
import HrTab from './profile/HrTab';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Native staff profile, shared by the teacher panel and every app/staff/[role] shell.
 *
 * Tries each endpoint in `endpoints` in order (roles whose web shell fetches a profile DTO pass
 * theirs; roles without one pass an empty list) and falls back to the values cached at login so
 * the screen still renders something useful offline.
 *
 * Props:
 *   endpoints — array of GET endpoints to try, first success wins (may be empty)
 *   homeRoute — native route Back falls back to
 *   roleLabel — display fallback when nothing names the user's role
 */


function InfoRow({ icon, label, value }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={17} color={PALETTE.primaryDark} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

export default function StaffProfileScreen({
  endpoints = [],
  homeRoute,
  roleLabel = 'Staff',
  // Off by default so the app/staff/[role] shells keep the read-only profile they have today;
  // the teacher route and the Portal-A counsellor opt in.
  showAcademic = false,
  showHr = false,
  // Namespace for the Academic tab's three endpoints — '/api/counselor' for the counsellor.
  academicApiBase = '/api/teacher',
  // A portal-supplied second tab, for shells whose "Academic Management" is not the assign-class
  // editor. The Shreyartha counsellor passes its read-only roster browser here.
  extraTab,
  // The web calls the first tab "Personalised Details" on the counsellor panels and "Details"
  // nowhere; teacher/staff shells keep the shorter label they already had.
  detailsLabel = 'Details',
  academicLabel = 'Academic',
}) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const { confirmLogout, loggingOut } = useStaffLogout();
  const [tab, setTab] = useState('details');
  const { toast, showToast } = useToast();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadFromStorage = useCallback(async (notice) => {
    const entries = await AsyncStorage.multiGet([
      'schoolUserName',
      'schoolUserEmail',
      'schoolCode',
      'schoolUserType',
      'schoolUserVerified',
    ]);
    const values = Object.fromEntries(entries);
    setProfile({
      fullName: values.schoolUserName || '',
      email: values.schoolUserEmail || '',
      schoolCode: values.schoolCode || '',
      userType: values.schoolUserType || '',
      verified: values.schoolUserVerified === 'true',
    });
    if (notice) setError(notice);
  }, []);

  // Callers rebuild the endpoints array every render (it comes off a route param), so key the
  // effect on its contents — not its identity — or the load loops forever.
  const endpointsKey = endpoints.join('|');

  const load = useCallback(async () => {
    const list = endpointsKey ? endpointsKey.split('|') : [];
    setError('');
    try {
      let dto = null;
      for (const endpoint of list) {
        try {
          const res = await api.get(endpoint);
          dto = res?.data ?? res;
          if (dto) break;
        } catch {
          // Try the next endpoint; a total miss falls back to storage below.
        }
      }
      if (dto) setProfile(dto);
      else await loadFromStorage(list.length ? 'Showing saved details — could not reach the server.' : '');
    } catch (e) {
      try {
        await loadFromStorage('Showing saved details — could not reach the server.');
      } catch {
        setError(e?.message || 'Failed to load your profile.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [endpointsKey, loadFromStorage]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const assignedClasses = Array.isArray(profile?.assignedClasses) ? profile.assignedClasses : [];

  const tabOptions = [
    { value: 'details', label: detailsLabel, icon: 'person-outline' },
    ...(showAcademic ? [{ value: 'academic', label: academicLabel, icon: 'easel-outline' }] : []),
    // A portal's own second tab, mutually exclusive with the assign-class editor above.
    ...(extraTab && !showAcademic
      ? [{ value: 'extra', label: extraTab.label, icon: extraTab.icon || 'easel-outline' }]
      : []),
    ...(showHr ? [{ value: 'hr', label: 'HR', icon: 'briefcase-outline' }] : []),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StaffHeader title="My Profile" fallbackRoute={homeRoute} />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={PALETTE.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PALETTE.primary} />
          }
        >
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(profile?.fullName)}</Text>
            </View>
            <Text style={styles.name}>{profile?.fullName || roleLabel}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.roleChip}>
                <Text style={styles.roleChipText}>{prettyRole(profile?.userType, roleLabel)}</Text>
              </View>
              {profile?.verified === true ? (
                <View style={[styles.statusChip, styles.statusVerified]}>
                  <Ionicons name="checkmark-circle" size={13} color={FEEDBACK.successText} />
                  <Text style={[styles.statusText, { color: FEEDBACK.successText }]}>Verified</Text>
                </View>
              ) : profile?.verified === false ? (
                <View style={[styles.statusChip, styles.statusPending]}>
                  <Ionicons name="time-outline" size={13} color="#b45309" />
                  <Text style={[styles.statusText, { color: '#b45309' }]}>Pending</Text>
                </View>
              ) : null}
            </View>
          </View>

          {error ? <Text style={styles.notice}>{error}</Text> : null}

          {tabOptions.length > 1 ? (
            <SegmentedTabs
              options={tabOptions}
              value={tab}
              onChange={setTab}
              style={styles.tabs}
            />
          ) : null}

          {tab === 'academic' ? (
            <AcademicTab
              profile={profile}
              onChanged={load}
              showToast={showToast}
              apiBase={academicApiBase}
            />
          ) : tab === 'extra' ? (
            extraTab.render()
          ) : tab === 'hr' ? (
            <HrTab showToast={showToast} />
          ) : (
            <DetailsTab
              profile={profile}
              assignedClasses={assignedClasses}
              confirmLogout={confirmLogout}
              loggingOut={loggingOut}
            />
          )}
        </ScrollView>
      )}

      <Toast message={toast.message} tone={toast.tone} />
    </SafeAreaView>
  );
}

/** The original read-only profile — every staff shell still sees exactly this and nothing else. */
function DetailsTab({ profile, assignedClasses, confirmLogout, loggingOut }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  return (
    <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contact</Text>
            <InfoRow icon="mail-outline" label="Email" value={profile?.email} />
            <InfoRow icon="call-outline" label="Mobile" value={profile?.mobile} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>School</Text>
            <InfoRow icon="business-outline" label="School" value={profile?.schoolName} />
            <InfoRow icon="barcode-outline" label="School Code" value={profile?.schoolCode} />
            {profile?.schoolBoard ? (
              <InfoRow icon="library-outline" label="Board" value={profile.schoolBoard} />
            ) : null}
            {profile?.designation ? (
              <InfoRow icon="ribbon-outline" label="Designation" value={profile.designation} />
            ) : null}
            {profile?.department ? (
              <InfoRow icon="albums-outline" label="Department" value={profile.department} />
            ) : null}
          </View>

          {assignedClasses.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>My Classes</Text>
              {assignedClasses.map((cls) => (
                <View key={cls.id ?? `${cls.classId}-${cls.sectionId}-${cls.subjectId}`} style={styles.classRow}>
                  <Ionicons name="easel-outline" size={16} color={PALETTE.primaryDark} />
                  <Text style={styles.classText}>
                    Class {cls.className}
                    {cls.sectionName ? `-${cls.sectionName}` : ''}
                    {cls.subjectName ? ` · ${cls.subjectName}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={confirmLogout}
            disabled={loggingOut}
            style={({ pressed }) => [styles.logoutRow, pressed && styles.logoutRowPressed]}
            accessibilityRole="button"
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color={FEEDBACK.errorText} />
            ) : (
              <Ionicons name="log-out-outline" size={19} color={FEEDBACK.errorText} />
            )}
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  safe: { flex: 1, backgroundColor: p.headerBg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: SLATE[50] },
  scroll: { backgroundColor: SLATE[50], padding: SPACING.md, paddingBottom: SPACING.xl },
  identity: { alignItems: 'center', paddingVertical: SPACING.md },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: p.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 26, fontWeight: '700', color: p.primaryDark },
  name: { fontSize: 19, fontWeight: '700', color: SLATE[800], marginTop: SPACING.sm },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  roleChip: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  roleChipText: { fontSize: 12, fontWeight: '700', color: p.primaryDark },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusVerified: { backgroundColor: FEEDBACK.successBg },
  statusPending: { backgroundColor: '#fffbeb' },
  statusText: { fontSize: 12, fontWeight: '700' },
  tabs: { marginBottom: SPACING.xs },
  notice: {
    fontSize: 13,
    color: SLATE[500],
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    marginTop: SPACING.md,
    ...SHADOWS.sm,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: SPACING.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: p.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 11.5, color: SLATE[500], fontWeight: '600' },
  rowValue: { fontSize: 14.5, color: SLATE[800], marginTop: 1 },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  classText: { flex: 1, fontSize: 14, color: SLATE[700] },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.lg,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FEEDBACK.errorBorder,
    backgroundColor: FEEDBACK.errorBg,
  },
  logoutRowPressed: { opacity: 0.75 },
  logoutText: { fontSize: 15, fontWeight: '700', color: FEEDBACK.errorText },
}));
