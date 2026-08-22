import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { Card, EmptyState, ScreenScaffold, Select, StatusChip, useToast } from '../../ui';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  STAFF_STATUS,
  STAFF_TYPES,
  STAFF_TYPE_COLOR,
  canActOn,
  fetchStaff,
  prettyStaffType,
  unverifyStaff,
  verifyStaff,
} from '../../../services/admin/staffService';
import { initialsOf } from '../helpers';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Staff Management — verify and unverify the school's own staff.
 *
 * This is the gate that turns a signup into a working account: until verification a staff member
 * holds ROLE_UNVERIFIED_*, which is not in the role hierarchy and reaches almost nothing.
 *
 * The web renders a six-column table with two filter button rows. Here each staff member is a card
 * and the two filters are chip selects, which is also how the Overview's "View All →" arrives —
 * it passes `?type=TEACHER` and this screen opens pre-filtered.
 */

export default function StaffManagementScreen({ homeRoute, apiBase }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();
  // Overview's stat sections deep-link here with a type already chosen.
  const { type } = useLocalSearchParams();

  const [status, setStatus] = useState('all');
  const [userType, setUserType] = useState(
    STAFF_TYPES.includes(String(type)) ? String(type) : 'all',
  );
  const [busyId, setBusyId] = useState(null);

  const fetcher = useCallback(
    (signal) => fetchStaff(apiBase, { status, userType }, signal),
    [apiBase, status, userType],
  );
  const { data, loading, error, refreshing, reload, refresh, revalidate } = useStaffResource(
    fetcher,
    { initialData: [] },
  );

  const rows = data || [];

  const act = async (user, verify) => {
    setBusyId(user.id);
    try {
      await (verify ? verifyStaff(apiBase, user.id) : unverifyStaff(apiBase, user.id));
      showToast(
        `${user.fullName} ${verify ? 'verified' : 'unverified'}.`,
        'success',
      );
      await revalidate();
    } catch (e) {
      showToast(e?.message || `Failed to ${verify ? 'verify' : 'unverify'}.`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Only the destructive direction confirms, matching the web's single window.confirm.
  const confirmUnverify = (user) =>
    Alert.alert(
      'Unverify staff member?',
      `${user.fullName} will lose access until they are verified again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unverify', style: 'destructive', onPress: () => act(user, false) },
      ],
    );

  return (
    <ScreenScaffold
      title="Staff Management"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
      scroll
    >
      <View style={styles.filters}>
        <Select
          variant="chip"
          label="Status"
          value={status}
          onChange={setStatus}
          options={STAFF_STATUS.map((value) => ({
            value,
            label: value.charAt(0).toUpperCase() + value.slice(1),
          }))}
        />
        <Select
          variant="chip"
          label="Role"
          value={userType}
          onChange={setUserType}
          options={STAFF_TYPES.map((value) => ({
            value,
            label: value === 'all' ? 'All roles' : prettyStaffType(value),
          }))}
        />
      </View>

      {rows.length === 0 ? (
        <EmptyState
          icon="people-circle-outline"
          title="No staff members"
          message="Nobody matches these filters."
        />
      ) : (
        rows.map((user) => (
          <Card key={user.id} style={styles.item}>
            <View style={styles.head}>
              <View style={[styles.avatar, { backgroundColor: PALETTE.tint }]}>
                <Text style={[styles.avatarText, { color: PALETTE.primaryDark }]}>
                  {initialsOf(user.fullName)}
                </Text>
              </View>
              <View style={styles.headText}>
                <Text style={styles.name} numberOfLines={1}>
                  {user.fullName || '—'}
                </Text>
                <Text style={styles.contact} numberOfLines={1}>
                  {user.email || '—'}
                </Text>
                {user.mobile ? (
                  <Text style={styles.contact} numberOfLines={1}>
                    {user.mobile}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.badges}>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: STAFF_TYPE_COLOR[user.userType] || SLATE[500] },
                ]}
              >
                <Text style={styles.typeBadgeText}>{prettyStaffType(user.userType)}</Text>
              </View>
              <StatusChip
                label={user.verified ? 'Verified' : 'Pending'}
                tone={user.verified ? 'success' : 'warning'}
              />
            </View>

            {!canActOn(user) ? (
              // The backend would accept the call; only the UI withholds it, as on the web.
              <Text style={styles.noAction}>Requires a system administrator.</Text>
            ) : (
              <Pressable
                onPress={() => (user.verified ? confirmUnverify(user) : act(user, true))}
                disabled={busyId === user.id}
                style={({ pressed }) => [
                  styles.actionBtn,
                  user.verified
                    ? styles.actionGhost
                    : { backgroundColor: PALETTE.primary, borderColor: PALETTE.primary },
                  (pressed || busyId === user.id) && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <Text style={user.verified ? styles.actionGhostText : styles.actionText}>
                  {user.verified ? 'Unverify' : 'Verify'}
                </Text>
              </Pressable>
            )}
          </Card>
        ))
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  filters: { flexDirection: 'row', gap: 8, marginBottom: SPACING.sm },
  item: { marginBottom: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  headText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: SLATE[800] },
  contact: { fontSize: 12, color: SLATE[500], marginTop: 1 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  typeBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  noAction: { fontSize: 12, color: SLATE[400], fontStyle: 'italic', marginTop: SPACING.sm },
  actionBtn: {
    marginTop: SPACING.sm,
    borderRadius: 9,
    borderWidth: 1,
    paddingVertical: 9,
    alignItems: 'center',
  },
  actionText: { color: '#ffffff', fontWeight: '700', fontSize: 13.5 },
  actionGhost: { backgroundColor: '#ffffff', borderColor: SLATE[200] },
  actionGhostText: { color: SLATE[600], fontWeight: '700', fontSize: 13.5 },
  pressed: { opacity: 0.7 },
}));
