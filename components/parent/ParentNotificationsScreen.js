import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { EmptyState, ScreenScaffold, useToast } from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  fetchParentNotifications,
  markAllParentNotificationsRead,
  markParentNotificationRead,
} from '../../services/parent/notificationService';
import { formatLongDateTime } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * The parent's notifications: every school event aimed at their child's class — a PTM, an exam, a
 * holiday — when it is scheduled, rescheduled or cancelled, and a reminder the evening before.
 * Mirrors frontendmain/src/Parent/platform/pages/ParentNotifications.js.
 *
 * The same inbox the website shows; on this phone each one is also pushed. Tapping one marks it read
 * and, unless the event was cancelled, opens the Schedule where the event itself is.
 */

const KIND = {
  SCHEDULED: { icon: 'calendar-outline', label: 'New event' },
  RESCHEDULED: { icon: 'swap-horizontal-outline', label: 'Rescheduled' },
  CANCELLED: { icon: 'close-circle-outline', label: 'Cancelled' },
  REMINDER: { icon: 'alarm-outline', label: 'Reminder' },
};

export default function ParentNotificationsScreen() {
  const styles = useStyles();
  const PALETTE = usePalette();
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [older, setOlder] = useState({ items: [], page: 0, loading: false });

  const fetcher = useCallback((signal) => fetchParentNotifications(0, signal), []);
  const { data, loading, refreshing, error, reload, refresh, setData } = useStaffResource(fetcher);

  const first = data?.items || [];
  const items = [...first, ...older.items.filter((o) => !first.some((f) => f.id === o.id))];
  const unread = Number(data?.unreadCount) || 0;
  const lastPage = older.page || data?.page || 0;
  const hasMore = lastPage + 1 < (data?.totalPages || 0);

  const setRead = (id) => {
    setData((current) =>
      current
        ? {
            ...current,
            items: (current.items || []).map((n) => (n.id === id ? { ...n, read: true } : n)),
            unreadCount: Math.max(0, (Number(current.unreadCount) || 0) - 1),
          }
        : current,
    );
    setOlder((o) => ({ ...o, items: o.items.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
  };

  const open = async (item) => {
    if (!item.read) {
      setRead(item.id);
      markParentNotificationRead(item.id).catch(() => {});
    }
    if (item.kind !== 'CANCELLED') router.push('/parent/schedule');
  };

  const markAll = async () => {
    try {
      await markAllParentNotificationsRead();
      setData((current) =>
        current
          ? { ...current, items: (current.items || []).map((n) => ({ ...n, read: true })), unreadCount: 0 }
          : current,
      );
      setOlder((o) => ({ ...o, items: o.items.map((n) => ({ ...n, read: true })) }));
    } catch (e) {
      showToast(e?.message || 'Could not mark them as read.', 'error');
    }
  };

  const loadOlder = async () => {
    if (older.loading) return;
    setOlder((o) => ({ ...o, loading: true }));
    try {
      const res = await fetchParentNotifications(lastPage + 1);
      setOlder((o) => ({ items: [...o.items, ...(res?.items || [])], page: res?.page ?? lastPage + 1, loading: false }));
    } catch (e) {
      setOlder((o) => ({ ...o, loading: false }));
      showToast(e?.message || 'Could not load older notifications.', 'error');
    }
  };

  return (
    <ScreenScaffold
      title="Notifications"
      fallbackRoute="/parent"
      loading={loading && !data}
      error={data ? '' : error}
      notice={data && error ? error : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <Text style={styles.intro}>
        School events for your child's class — when they are scheduled, changed or cancelled, and a
        reminder the evening before.
      </Text>

      {unread > 0 ? (
        <Pressable
          onPress={markAll}
          style={({ pressed }) => [styles.markAll, { borderColor: PALETTE.primary }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="checkmark-done-outline" size={19} color={PALETTE.primaryDark} />
          <Text style={[styles.markAllText, { color: PALETTE.primaryDark }]}>Mark all as read ({unread})</Text>
        </Pressable>
      ) : null}

      {data && items.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="No notifications yet"
          message="You will hear here whenever the school schedules something for your child's class."
        />
      ) : (
        items.map((item) => {
          const kind = KIND[item.kind] || { icon: 'notifications-outline', label: 'Update' };
          return (
            <Pressable
              key={item.id}
              onPress={() => open(item)}
              style={({ pressed }) => [
                styles.row,
                !item.read && { borderColor: PALETTE.primary, backgroundColor: PALETTE.tint },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.read ? 'Read' : 'Unread'}.`}
            >
              <Ionicons name={kind.icon} size={23} color={PALETTE.primaryDark} style={styles.rowIcon} />
              <View style={styles.rowText}>
                <Text style={[styles.kind, { color: PALETTE.primaryDark }]}>{kind.label}</Text>
                <Text style={[styles.title, !item.read && styles.titleUnread]}>{item.title}</Text>
                {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
                <Text style={styles.time}>{formatLongDateTime(item.createdAt)}</Text>
              </View>
              {!item.read ? <View style={[styles.dot, { backgroundColor: PALETTE.primary }]} /> : null}
            </Pressable>
          );
        })
      )}

      {hasMore ? (
        <Pressable
          onPress={loadOlder}
          disabled={older.loading}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          {older.loading ? (
            <ActivityIndicator size="small" color={PALETTE.primaryDark} />
          ) : (
            <Text style={[styles.moreText, { color: PALETTE.primaryDark }]}>Show older</Text>
          )}
        </Pressable>
      ) : null}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  intro: {
    fontSize: TYPE.body,
    lineHeight: leading(TYPE.body),
    color: SLATE[700],
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    marginBottom: SPACING.md,
  },
  markAllText: { fontSize: TYPE.label, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
    marginBottom: SPACING.sm,
  },
  rowIcon: { marginTop: 2 },
  rowText: { flex: 1 },
  kind: { fontSize: TYPE.caption, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { fontSize: TYPE.body, lineHeight: leading(TYPE.body), fontWeight: '700', color: SLATE[800], marginTop: 2 },
  titleUnread: { fontWeight: '800' },
  body: { fontSize: TYPE.label, lineHeight: leading(TYPE.label), color: SLATE[700], marginTop: 2 },
  time: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },

  more: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
    marginTop: SPACING.sm,
  },
  moreText: { fontSize: TYPE.heading, fontWeight: '700' },
  errorText: { color: FEEDBACK.errorText },
  pressed: { opacity: 0.8 },
}));
