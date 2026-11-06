import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { StatusChip } from '../ui';
import { makeStyles } from '../../utils/makeStyles';
import { studentApi } from '../../services/studentApi';
import StudentScaffold from './StudentScaffold';
import { StudentCard, StudentCardTitle, StudentNote } from './StudentCard';

/**
 * My Bookings (5 Nov 2026) — the website's MyBookings: the student's counselling sessions, with the
 * plan's sessions left, and Cancel on a pending or confirmed one (an optional reason goes with it).
 * `/api/me/counselling/bookings` and `/api/me/entitlements`. Booking a new one is the Counsellor
 * screen's, as on the website.
 */

const STATUS = {
  PENDING: { label: 'Pending', tone: 'warning' },
  CONFIRMED: { label: 'Confirmed', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'error' },
  NO_SHOW: { label: 'No-show', tone: 'error' },
};

const when = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function MyBookingsScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const [bookings, setBookings] = useState(null);
  const [ent, setEnt] = useState(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [b, e] = await Promise.all([
        studentApi.get('/api/me/counselling/bookings'),
        studentApi.get('/api/me/entitlements').catch(() => null),
      ]);
      setBookings(Array.isArray(b) ? b : []);
      setEnt(e);
    } catch (e) {
      setBookings([]);
      setError(e?.message || 'Could not load your bookings.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remaining =
    ent == null
      ? '—'
      : ent.counsellingTotalAllowed === -1
        ? 'Unlimited'
        : Math.max(0, (ent.counsellingTotalAllowed || 0) - (ent.counsellingUsed || 0));

  const cancel = async () => {
    setBusy(true);
    try {
      await studentApi.post(`/api/me/counselling/bookings/${cancelling.id}/cancel`, { reason: reason.trim() || null });
      setCancelling(null);
      setReason('');
      load();
    } catch (e) {
      Alert.alert('Could not cancel', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <StudentScaffold title="My Bookings" fallbackRoute="/student/workspace" loading={bookings === null} onRefresh={load}>
      <StudentCard>
        <StudentCardTitle>My counselling bookings</StudentCardTitle>
        <Text style={styles.meta}>
          Plan: {ent?.currentTier || 'NONE'} · Sessions remaining: {String(remaining)}
        </Text>
        <Pressable
          onPress={() => router.push('/student/counselor')}
          style={({ pressed }) => [styles.button, { backgroundColor: palette.primary }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Book a new session</Text>
        </Pressable>
      </StudentCard>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {bookings && bookings.length === 0 && !error ? (
        <StudentCard>
          <StudentNote>You have no bookings yet.</StudentNote>
        </StudentCard>
      ) : null}
      {(bookings || []).map((b) => {
        const s = STATUS[b.status] || { label: b.status, tone: 'neutral' };
        const canCancel = b.status === 'PENDING' || b.status === 'CONFIRMED';
        return (
          <StudentCard key={b.id}>
            <View style={styles.head}>
              <Text style={styles.topic}>{b.topic || 'Counselling session'}</Text>
              <StatusChip label={s.label} tone={s.tone} />
            </View>
            <Text style={styles.meta}>Scheduled: {when(b.scheduledAt)}</Text>
            {b.counsellorName ? <Text style={styles.meta}>Counsellor: {b.counsellorName}</Text> : null}
            {b.notes ? <Text style={styles.notes}>{b.notes}</Text> : null}
            {canCancel && cancelling?.id === b.id ? (
              <View>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Reason (optional)"
                  placeholderTextColor={SLATE[400]}
                  style={styles.input}
                  accessibilityLabel="Reason for cancelling"
                />
                <View style={styles.row}>
                  <Pressable onPress={() => setCancelling(null)} style={styles.ghost} accessibilityRole="button">
                    <Text style={styles.ghostText}>Keep it</Text>
                  </Pressable>
                  <Pressable onPress={cancel} disabled={busy} style={[styles.danger, busy && styles.pressed]} accessibilityRole="button">
                    <Text style={styles.buttonText}>{busy ? 'Cancelling…' : 'Cancel booking'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {canCancel && cancelling?.id !== b.id ? (
              <Pressable onPress={() => setCancelling(b)} hitSlop={6} accessibilityRole="button">
                <Text style={styles.cancelLink}>Cancel this booking</Text>
              </Pressable>
            ) : null}
          </StudentCard>
        );
      })}
    </StudentScaffold>
  );
}

const useStyles = makeStyles(() => ({
  meta: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  topic: { flex: 1, fontSize: TYPE.body, fontWeight: '800', color: SLATE[900] },
  notes: { fontSize: TYPE.body, color: SLATE[700], marginTop: SPACING.sm },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, marginVertical: SPACING.sm },
  button: { marginTop: SPACING.md, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontSize: TYPE.label, fontWeight: '800', color: '#ffffff' },
  pressed: { opacity: 0.85 },
  cancelLink: { fontSize: TYPE.label, fontWeight: '800', color: FEEDBACK.errorText, marginTop: SPACING.sm },
  input: { borderWidth: 1, borderColor: SLATE[300], borderRadius: 10, padding: SPACING.sm, fontSize: TYPE.body, color: SLATE[900], marginTop: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  ghost: { flex: 1, borderWidth: 1.5, borderColor: SLATE[300], borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  ghostText: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[700] },
  danger: { flex: 1, backgroundColor: FEEDBACK.errorText, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
}));
