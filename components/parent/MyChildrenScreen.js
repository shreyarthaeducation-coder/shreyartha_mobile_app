import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TOUCH, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { Card, ScreenScaffold } from '../ui';
import { Banner, FormField, PrimaryButton } from '../auth';
import { makeStyles } from '../../utils/makeStyles';
import {
  childDetails,
  fetchChildren,
  linkChild,
  looksLikeContact,
  rememberActiveChild,
  removeChild,
  selectChild,
  withdrawRequest,
} from '../../services/parent/childrenService';

/**
 * My Children (6 Nov 2026) — the website's parent My Children page, on the phone.
 *
 * Every child linked to this parent: which one the dashboard is showing (View switches to another,
 * Remove takes one off), and one box to link another — the parent code from the school links and
 * verifies at once; the child's mobile number or email asks the school to verify first, and such a
 * request waits underneath with Withdraw.
 *
 * Reachable before verification too: a parent whose school gave them a code can link their child
 * from here without waiting for anyone (`ParentLinkBox` on the pending screen is the same box).
 */

/** Alert with buttons does nothing on the web build; the browser's own confirm does. */
function confirm(title, message, label) {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: label, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * The link box and the requests still waiting — the website's ParentLinkCodeBox.
 *
 * @param onLinked called with the answer after a CODE linked a child (a mobile or email only asks)
 * @param initialPending the requests already known, so the box need not fetch them again
 */
export function ParentLinkBox({ prompt, onLinked, initialPending, onChange }) {
  const styles = useStyles();
  const palette = usePalette();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(initialPending || []);

  useEffect(() => {
    if (initialPending) {
      setPending(initialPending);
      return undefined;
    }
    let alive = true;
    fetchChildren()
      .then((res) => alive && setPending(res?.pending || []))
      .catch(() => alive && setPending([]));
    return () => {
      alive = false;
    };
  }, [initialPending]);

  const submit = async () => {
    const typed = value.trim();
    if (!typed || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await linkChild(typed);
      await rememberActiveChild(result);
      setValue('');
      setPending(result?.pending || []);
      onChange?.(result);
      if (looksLikeContact(typed)) setNotice(result?.message || 'Request sent. The school will verify your account.');
      else onLinked?.(result);
    } catch (e) {
      setError(e?.message || 'That did not work. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async (request) => {
    if (!(await confirm('Withdraw request?', `Withdraw your request for ${request.typedValue}?`, 'Withdraw'))) return;
    setError('');
    try {
      const result = await withdrawRequest(request.requestId);
      setPending(result?.pending || []);
      setNotice('');
      onChange?.(result);
    } catch (e) {
      setError(e?.message || 'Could not withdraw that request.');
    }
  };

  return (
    <Card>
      <Text style={styles.prompt}>{prompt}</Text>
      <FormField
        label="Code, or your child's mobile / email"
        value={value}
        onChangeText={(t) => {
          setValue(t);
          setError('');
        }}
        placeholder="ABCD-2345, or child's mobile / email"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={120}
        returnKeyType="done"
        onSubmitEditing={submit}
        palette={palette}
      />
      <Text style={styles.hint}>
        A code from the school links your child straight away. With your child&apos;s mobile or email, the school
        verifies you first.
      </Text>
      <PrimaryButton
        title={saving ? 'Linking…' : 'Link child'}
        onPress={submit}
        loading={saving}
        disabled={!value.trim()}
        palette={palette}
        style={styles.linkBtn}
      />
      {error ? <Banner message={error} /> : null}
      {notice ? <Banner variant="success" message={notice} /> : null}
      {pending.length ? (
        <View style={styles.pending}>
          <Text style={styles.pendingTitle}>Waiting for the school to verify</Text>
          {pending.map((request) => (
            <View key={request.requestId} style={styles.pendingRow}>
              <Ionicons name="time-outline" size={18} color={SLATE[500]} />
              <Text style={styles.pendingText} numberOfLines={1}>
                {request.typedValue}
              </Text>
              <Pressable
                onPress={() => withdraw(request)}
                style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Withdraw your request for ${request.typedValue}`}
              >
                <Text style={styles.smallBtnText}>Withdraw</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export default function MyChildrenScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchChildren());
      setError('');
    } catch (e) {
      setError(e?.message || 'Could not load your children.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Home again, from the top: every card on it is about the child that was showing.
  const openDashboard = () => router.replace('/parent');

  const select = async (child) => {
    setBusy(child.studentId);
    setError('');
    try {
      await rememberActiveChild(await selectChild(child.studentId));
      openDashboard();
    } catch (e) {
      setError(e?.message || 'Could not switch to that child.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (child) => {
    const ok = await confirm(
      `Remove ${child.fullName}?`,
      'You will no longer see their progress, and you will need a code from the school, or the ' +
        "school's approval, to add them back.",
      'Remove',
    );
    if (!ok) return;
    setBusy(child.studentId);
    setError('');
    try {
      const result = await removeChild(child.studentId);
      await rememberActiveChild(result);
      setData(result);
    } catch (e) {
      setError(e?.message || 'Could not remove that child.');
    } finally {
      setBusy(null);
    }
  };

  const children = data?.children || [];

  return (
    <ScreenScaffold
      title="My Children"
      fallbackRoute="/parent"
      loading={loading && !data}
      error={!data ? error : ''}
      onRetry={load}
      refreshing={loading && !!data}
      onRefresh={load}
    >
      {data && error ? <Banner message={error} /> : null}

      {data && !children.length ? (
        <Card>
          <Text style={styles.empty}>No children are linked to your account yet.</Text>
        </Card>
      ) : null}

      {children.map((child) => {
        const active = child.studentId === data.activeStudentId;
        const details = childDetails(child);
        return (
          <Card key={child.studentId} style={[styles.child, active && { borderColor: palette.primary }]}>
            <View style={styles.childTop}>
              {child.profilePicture ? (
                <Image source={{ uri: child.profilePicture }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: palette.tint }]}>
                  <Text style={[styles.initial, { color: palette.primaryDark }]}>
                    {String(child.fullName || '?').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.childText}>
                <Text style={styles.name}>{child.fullName}</Text>
                {details ? <Text style={styles.details}>{details}</Text> : null}
              </View>
            </View>
            <View style={styles.actions}>
              {active ? (
                <View style={[styles.activeChip, { backgroundColor: palette.tint }]}>
                  <Ionicons name="eye-outline" size={16} color={palette.primaryDark} />
                  <Text style={[styles.activeText, { color: palette.primaryDark }]}>Showing now</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => select(child)}
                  disabled={busy !== null}
                  style={({ pressed }) => [styles.viewBtn, { backgroundColor: palette.primary }, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${child.fullName}`}
                >
                  <Text style={styles.viewText}>View</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => remove(child)}
                disabled={busy !== null}
                style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${child.fullName}`}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          </Card>
        );
      })}

      {data ? (
        <>
          <Text style={styles.section}>{children.length ? 'Link another child' : 'Link your child'}</Text>
          <ParentLinkBox
            initialPending={data.pending || []}
            onChange={(result) => setData(result)}
            prompt={
              children.length
                ? "Enter the parent code from that child's school, or the child's mobile number or email."
                : "Enter the parent code from your child's school, or your child's mobile number or email."
            }
            onLinked={openDashboard}
          />
        </>
      ) : null}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  empty: { fontSize: TYPE.body, color: SLATE[600] },
  child: { borderWidth: 1.5, borderColor: SLATE[200] },
  childTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: TYPE.title, fontWeight: '800' },
  childText: { flex: 1 },
  name: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[800] },
  details: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2, lineHeight: leading(TYPE.label) },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  activeChip: {
    flex: 1,
    minHeight: TOUCH.min,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  activeText: { fontWeight: '700', fontSize: TYPE.label },
  viewBtn: { flex: 1, minHeight: TOUCH.min, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  viewText: { color: '#fff', fontWeight: '700', fontSize: TYPE.label },
  removeBtn: {
    minHeight: TOUCH.min,
    paddingHorizontal: SPACING.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FEEDBACK.errorBorder,
    backgroundColor: FEEDBACK.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: FEEDBACK.errorText, fontWeight: '700', fontSize: TYPE.label },
  section: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: SLATE[500],
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  prompt: { fontSize: TYPE.body, color: SLATE[700], lineHeight: leading(TYPE.body), marginBottom: SPACING.sm },
  hint: { fontSize: TYPE.caption, color: SLATE[500], lineHeight: leading(TYPE.caption), marginTop: SPACING.xs },
  linkBtn: { marginTop: SPACING.md },
  pending: { marginTop: SPACING.md, gap: SPACING.xs },
  pendingTitle: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[700] },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  pendingText: { flex: 1, fontSize: TYPE.label, color: SLATE[700] },
  smallBtn: {
    minHeight: TOUCH.min,
    paddingHorizontal: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SLATE[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700] },
  pressed: { opacity: 0.8 },
}));
