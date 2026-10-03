import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { Card, CardTitle } from '../ui';
import { parseLocalDateTime } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';
import {
  endDayNow,
  fetchTodaySession,
  formatDuration,
  parseSessionLocation,
  resumeDayNow,
  startDayNow,
} from '../../services/staffDayService';

/** "2026-10-03T09:12" → "9:12 am" (the server's IST wall time, never shifted). */
function clock(value) {
  const date = parseLocalDateTime(value);
  if (!date) return '';
  const hours = date.getHours();
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(date.getMinutes()).padStart(2, '0')} ${hours >= 12 ? 'pm' : 'am'}`;
}

/**
 * Today's working day, as a card with one button — shown above the Self Attendance sheet for the
 * sales rep. The web's twin is frontendmain/src/Sales/platform/SalesDayCard.js.
 *
 * A rep's day is one attendance record: it starts when they sign in (time and place), and until
 * 3 Oct 2026 it could only be ended by logging out. The card shows the day and offers
 *
 *   • Start my day  — only when signing in did not start it;
 *   • End my day    — records the end time and place, as logging out does, and stays signed in;
 *   • Resume my day — reopens an ended day so a later end replaces it. The server keeps the first
 *                     end time and counts the resumes, so the record shows that it was moved.
 *
 * Ending and resuming both ask first. Ending says so when the hours so far are under the school's
 * full day — the day would be recorded as Incomplete.
 *
 * `onChanged` — called after any action, so the sheet below can refetch.
 * `showToast` — the host screen's toast, for the outcome.
 */
export default function DaySessionCard({ onChanged, showToast }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const [session, setSession] = useState(undefined); // undefined = loading, null = not started
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [, setTick] = useState(0);

  const load = useCallback(() => {
    const controller = new AbortController();
    fetchTodaySession(controller.signal)
      .then((s) => {
        setSession(s);
        setError('');
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setSession(null);
        setError(e?.message || "Could not load today's attendance.");
      });
    return () => controller.abort();
  }, []);

  useEffect(load, [load]);

  const open = !!session?.loginAt && !session?.logoutAt;
  useEffect(() => {
    if (!open) return undefined;
    const timer = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, [open]);

  const run = async (label, action, done) => {
    setBusy(label);
    setError('');
    try {
      setSession(await action());
      showToast?.(done, 'success');
      onChanged?.();
    } catch (e) {
      setError(e?.message || 'That did not work. Please try again.');
    } finally {
      setBusy('');
    }
  };

  const started = parseLocalDateTime(session?.loginAt);
  const elapsedMs = open && started ? Date.now() - started.getTime() : 0;
  const minimumHours = Number(session?.minimumHours) || 6;

  const confirmEnd = () => {
    const short = elapsedMs < minimumHours * 3600000;
    Alert.alert(
      'End your day?',
      `You started at ${clock(session.loginAt)} — ${formatDuration(elapsedMs)} so far.` +
        (short
          ? `\n\nA full day is ${minimumHours} hours, so ending now records today as Incomplete. You can resume your day afterwards if you carry on working.`
          : '\n\nYour end time and location are recorded. You stay signed in.'),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End my day', style: 'destructive', onPress: () => run('end', endDayNow, 'Your day is ended.') },
      ],
    );
  };

  const confirmResume = () => {
    Alert.alert(
      'Resume your day?',
      `The end you recorded at ${clock(session.logoutAt)} is cleared, and your day runs on until you end it again. Your record keeps a note that the day was resumed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Resume my day', onPress: () => run('resume', resumeDayNow, 'Your day is running again.') },
      ],
    );
  };

  if (session === undefined) {
    return (
      <Card>
        <CardTitle>My day</CardTitle>
        <ActivityIndicator color={PALETTE.primary} style={styles.loader} />
      </Card>
    );
  }

  const ended = !!session?.logoutAt;
  const present = session?.status === 'PRESENT';
  const place = parseSessionLocation(ended ? session.logoutLocation : session?.loginLocation);
  const hasFix = place?.lat != null && place?.lng != null;

  return (
    <Card>
      <CardTitle>My day</CardTitle>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {!session?.loginAt ? (
        <Text style={styles.body}>
          You haven't started your day. Starting it records the time and your location.
        </Text>
      ) : null}

      {open ? (
        <Text style={styles.body}>
          <Text style={styles.strong}>Day started {clock(session.loginAt)}</Text>
          {` · ${formatDuration(elapsedMs)} so far`}
        </Text>
      ) : null}

      {ended ? (
        <>
          <Text style={styles.body}>
            <Text style={styles.strong}>
              Started {clock(session.loginAt)} · ended {clock(session.logoutAt)}
            </Text>
            {` · ${formatDuration(session.durationMs)}`}
          </Text>
          {session.status ? (
            <View style={[styles.pill, present ? styles.pillOk : styles.pillWarn]}>
              <Text style={[styles.pillText, present ? styles.pillOkText : styles.pillWarnText]}>
                {present ? 'Present' : 'Incomplete'}
              </Text>
            </View>
          ) : null}
          {!present && session.status ? (
            <Text style={styles.muted}>
              A full day is {minimumHours} hours. Resume your day if you are still working.
            </Text>
          ) : null}
        </>
      ) : null}

      {session?.loginAt && hasFix ? (
        <Pressable
          onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`)}
          accessibilityRole="link"
          style={styles.placeRow}
        >
          <Ionicons name="location-outline" size={17} color={PALETTE.primary} />
          <Text style={[styles.placeLink, { color: PALETTE.primary }]}>
            {ended ? 'Where you ended' : 'Where you started'} · open map
          </Text>
        </Pressable>
      ) : null}

      {session?.resumeCount > 0 ? (
        <Text style={styles.muted}>
          Resumed {session.resumeCount === 1 ? 'once' : `${session.resumeCount} times`} today
          {session.firstLogoutAt ? ` · first ended ${clock(session.firstLogoutAt)}` : ''}
        </Text>
      ) : null}

      {!session?.loginAt ? (
        <DayButton
          label="Start my day"
          icon="play"
          busy={busy === 'start'}
          disabled={!!busy}
          onPress={() => run('start', startDayNow, 'Your day is started.')}
          style={[styles.primary, { backgroundColor: PALETTE.primaryDark }]}
          textStyle={styles.primaryText}
          color="#ffffff"
        />
      ) : null}
      {open ? (
        <DayButton
          label="End my day"
          icon="stop"
          busy={busy === 'end'}
          disabled={!!busy}
          onPress={confirmEnd}
          style={[styles.primary, { backgroundColor: PALETTE.primaryDark }]}
          textStyle={styles.primaryText}
          color="#ffffff"
        />
      ) : null}
      {ended ? (
        <DayButton
          label="Resume my day"
          icon="refresh"
          busy={busy === 'resume'}
          disabled={!!busy}
          onPress={confirmResume}
          style={styles.secondary}
          textStyle={styles.secondaryText}
          color={SLATE[700]}
        />
      ) : null}
      {busy === 'start' || busy === 'end' ? (
        <Text style={styles.locating}>Getting your location…</Text>
      ) : null}
    </Card>
  );
}

function DayButton({ label, icon, busy, disabled, onPress, style, textStyle, color }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, style, disabled && styles.disabled, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <>
          <Ionicons name={icon} size={19} color={color} />
          <Text style={textStyle}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  loader: { marginVertical: SPACING.md },
  body: { fontSize: TYPE.body, lineHeight: leading(TYPE.body), color: SLATE[700] },
  strong: { fontWeight: '800', color: SLATE[900] },
  muted: { fontSize: TYPE.label, color: SLATE[600], marginTop: SPACING.xs },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, marginBottom: SPACING.sm },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: SPACING.xs },
  pillOk: { backgroundColor: '#dcfce7' },
  pillWarn: { backgroundColor: '#fef3c7' },
  pillText: { fontSize: TYPE.label, fontWeight: '800' },
  pillOkText: { color: '#166534' },
  pillWarnText: { color: '#92400e' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, marginTop: SPACING.xs },
  placeLink: { fontSize: TYPE.label, fontWeight: '700' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: SPACING.md,
  },
  primary: {},
  primaryText: { fontSize: TYPE.heading, fontWeight: '800', color: '#ffffff' },
  secondary: { borderWidth: 1, borderColor: SLATE[200], backgroundColor: '#ffffff' },
  secondaryText: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[700] },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  locating: { fontSize: TYPE.label, color: SLATE[600], textAlign: 'center', marginTop: SPACING.xs },
}));
