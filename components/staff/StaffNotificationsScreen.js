import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenScaffold from '../ui/ScreenScaffold';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { resolveStaffMenus } from '../../constants/staffRoles';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationIcon,
  resolveNotificationRoute,
} from '../../services/staff/notificationService';
import { formatLongDateTime } from '../../utils/dates';

/**
 * The staff inbox — what the bell in BrandBar opens.
 *
 * ══ EVERY ROW HERE WAS WRITTEN BY A BUSINESS EVENT ═════════════════════════
 * Nothing on this screen is generated for its own sake. The producers are single, existing seams:
 * a leave decision (`HrLeaveNotifier`), a deal approved / rejected / collected and an incentive
 * approved or paid (`AdminSalesService`), an account approved, and a meeting sent to its attendees
 * (`StaffMeetingService.notifyAttendees`, where the in-app row is a third channel beside the email
 * and WhatsApp it already sent). If this screen is empty, nothing has happened.
 *
 * ══ `link` IS A MENU KEY, RESOLVED AGAINST THIS ROLE'S OWN MENU ════════════
 * The server cannot store a path: the panel segment differs per recipient, so `/staff/sales/leave`
 * and `/teacher/leave` are the same notification seen by two people. A key this role does not
 * carry resolves to null and the row is rendered unclickable rather than navigating into a screen
 * they would be refused.
 */
export default function StaffNotificationsScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();

  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const config = resolveStaffMenus(roleKey);
  const menu = config?.menu || [];

  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetchNotifications(0);
      setItems(Array.isArray(res?.items) ? res.items : []);
      setUnread(Number(res?.unreadCount) || 0);
    } catch (e) {
      // A 403 is renderable here rather than fatal — staffApi does not end the session on one.
      setError(e?.message || 'Could not load your notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openItem = async (item) => {
    const route = resolveNotificationRoute(item.link, menu);

    // Marked read BEFORE navigating, and optimistically in local state, so the row does not still
    // look unread for the moment it takes the request to land. A failure is swallowed: the badge
    // being one too high is not worth an error dialog over a notification the user just read.
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      setUnread((n) => Math.max(0, n - 1));
      markNotificationRead(item.id).catch(() => {});
    }

    if (route) router.push(route);
  };

  const readAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    markAllNotificationsRead().catch(() => {});
  };

  return (
    <ScreenScaffold
      title="Notifications"
      fallbackRoute={`/staff/${roleKey}`}
      loading={loading}
      error={error}
      onRetry={load}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {unread > 0 ? (
        <Pressable
          onPress={readAll}
          style={({ pressed }) => [styles.readAll, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Mark all ${unread} notifications read`}
        >
          <Ionicons name="checkmark-done" size={18} color={palette.primary} />
          <Text style={[styles.readAllText, { color: palette.primary }]}>
            Mark all read ({unread})
          </Text>
        </Pressable>
      ) : null}

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={34} color={SLATE[300]} />
          <Text style={styles.emptyText}>You have no notifications yet.</Text>
        </View>
      ) : (
        items.map((item) => {
          const route = resolveNotificationRoute(item.link, menu);
          const body = (
            <>
              <View style={[styles.iconTile, !item.read && { backgroundColor: palette.tint }]}>
                <Ionicons
                  name={notificationIcon(item.category)}
                  size={20}
                  color={item.read ? SLATE[400] : palette.primary}
                />
              </View>

              <View style={styles.text}>
                <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
                <Text style={styles.when}>{formatLongDateTime(item.createdAt)}</Text>
              </View>

              {/* The unread dot, and the chevron only where the row actually goes somewhere. */}
              {!item.read ? <View style={[styles.dot, { backgroundColor: palette.primary }]} /> : null}
              {route ? <Ionicons name="chevron-forward" size={18} color={SLATE[400]} /> : null}
            </>
          );

          // Tappable whenever it is unread OR has somewhere to go: an unread row with no link is
          // still worth being able to dismiss by reading it.
          const tappable = route || !item.read;

          return tappable ? (
            <Pressable
              key={item.id}
              onPress={() => openItem(item)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.body || ''}`}
            >
              {body}
            </Pressable>
          ) : (
            <View key={item.id} style={styles.row}>
              {body}
            </View>
          );
        })
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  readAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingVertical: SPACING.sm,
  },
  readAllText: { fontSize: TYPE.label, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[100],
  },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: TYPE.body, fontWeight: '600', color: SLATE[700] },
  // Last in the cascade, so an unread title always wins over the read weight above.
  titleUnread: { fontWeight: '800', color: SLATE[900] },
  body: { fontSize: TYPE.caption, color: SLATE[600], lineHeight: leading(TYPE.caption), marginTop: 3 },
  when: { fontSize: TYPE.micro, color: SLATE[500], marginTop: 5 },

  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },

  empty: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xl },
  emptyText: { fontSize: TYPE.body, color: SLATE[500] },

  pressed: { opacity: 0.75 },
}));
