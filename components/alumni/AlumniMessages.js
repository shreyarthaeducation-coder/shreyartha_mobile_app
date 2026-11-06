import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../constants/theme';
import { EmptyState, ScreenScaffold, useToast } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import useStaffResource from '../../hooks/useStaffResource';
import { alumniApi } from '../../services/portalClients';
import { formatLongDateTime } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

const D = '/api/alumni/dashboard/messages/conversations';

/**
 * Alumni Messages (5 Nov 2026), as on the website: one conversation per connection, newest first,
 * with an unread count; opening one shows the thread and a box to reply. Only connected alumni can
 * message each other — the server decides that.
 */
export function AlumniConversations() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const fetcher = useCallback(() => alumniApi.get(D), []);
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher, { initialData: null });
  const list = Array.isArray(data) ? data : [];
  return (
    <ScreenScaffold title="Messages" fallbackRoute="/alumni" loading={loading} error={error} onRetry={reload} refreshing={refreshing} onRefresh={refresh}>
      {list.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title="No conversations yet" message="Connect with alumni, then message them here." />
      ) : (
        list.map((c) => (
          <Pressable
            key={c.connectionId}
            onPress={() => router.push({ pathname: '/alumni/chat', params: { id: String(c.connectionId), name: c.counterpartName || '' } })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={[styles.avatar, { backgroundColor: palette.tint }]}>
              <Text style={[styles.avatarText, { color: palette.primaryDark }]}>{String(c.counterpartName || '?').charAt(0)}</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.name}>{c.counterpartName}</Text>
              <Text style={styles.last} numberOfLines={1}>
                {c.lastMessage || 'No messages yet'}
              </Text>
            </View>
            {c.unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: palette.primary }]}>
                <Text style={styles.badgeText}>{c.unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ))
      )}
    </ScreenScaffold>
  );
}

export function AlumniChat() {
  const styles = useStyles();
  const palette = usePalette();
  const { id, name } = useLocalSearchParams();
  const { toast, showToast } = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef(null);
  const fetcher = useCallback(() => alumniApi.get(`${D}/${id}`), [id]);
  const { data, loading, error, reload } = useStaffResource(fetcher, { initialData: null });
  const messages = Array.isArray(data) ? data : data?.messages || [];

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd?.({ animated: false }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await alumniApi.post(`${D}/${id}`, { body });
      setText('');
      reload();
    } catch (e) {
      showToast(e?.message || 'Could not send.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenScaffold title={name || 'Messages'} fallbackRoute="/alumni/messages" loading={loading} error={error} onRetry={reload} scroll={false} toast={toast}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.thread}>
          {messages.length === 0 ? <Text style={styles.empty}>Say hello.</Text> : null}
          {messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.mine ? [styles.mine, { backgroundColor: palette.primary }] : styles.theirs]}>
              <Text style={[styles.body, m.mine && styles.bodyMine]}>{m.body}</Text>
              <Text style={[styles.time, m.mine && styles.timeMine]}>{m.sentAt ? formatLongDateTime(m.sentAt) : ''}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write a message"
            style={styles.input}
            multiline
            accessibilityLabel="Message"
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            style={({ pressed }) => [styles.send, { backgroundColor: palette.primary }, (!text.trim() || sending) && styles.disabled, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Ionicons name="send" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: TYPE.heading, fontWeight: '800' },
  rowText: { flex: 1 },
  name: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[800] },
  last: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: TYPE.caption, fontWeight: '800', color: '#ffffff' },
  thread: { padding: SPACING.md, gap: SPACING.sm },
  empty: { textAlign: 'center', color: SLATE[500], marginTop: SPACING.lg },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#ffffff', borderWidth: 1, borderColor: SLATE[200], borderBottomLeftRadius: 4 },
  body: { fontSize: TYPE.body, color: SLATE[800], lineHeight: leading(TYPE.body) },
  bodyMine: { color: '#ffffff' },
  time: { fontSize: TYPE.micro, color: SLATE[500], marginTop: 2 },
  timeMine: { color: 'rgba(255,255,255,0.8)' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, padding: SPACING.sm, borderTopWidth: 1, borderTopColor: SLATE[200], backgroundColor: '#ffffff' },
  input: { flex: 1, minHeight: TOUCH.min, maxHeight: 120, borderWidth: 1, borderColor: SLATE[200], borderRadius: 14, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: TYPE.body, color: SLATE[800] },
  send: { width: TOUCH.min, height: TOUCH.min, borderRadius: TOUCH.min / 2, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
}));
