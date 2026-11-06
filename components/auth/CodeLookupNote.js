import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { lookupUniversityCode } from '../../services/authService';
import { FEEDBACK, SPACING, TYPE } from '../../constants/theme';

/**
 * Under a University Code field: the university's name once the code is recognised, or "Invalid
 * University Code" — the website checks on blur, this checks a moment after typing stops.
 * `onResult(name|null)` lets the form refuse a code that matched nothing.
 */
export default function CodeLookupNote({ code, palette, onResult }) {
  const [state, setState] = useState({ loading: false, name: '', checked: false });

  useEffect(() => {
    const c = String(code || '').trim();
    if (!c) {
      setState({ loading: false, name: '', checked: false });
      onResult?.(null);
      return undefined;
    }
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(async () => {
      const hit = await lookupUniversityCode(c);
      if (!live) return;
      setState({ loading: false, name: hit?.name || '', checked: true });
      onResult?.(hit?.name || null);
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (state.loading) return <Text style={styles.note}>Checking…</Text>;
  if (!state.checked) return null;
  return state.name ? (
    <Text style={[styles.note, { color: palette.primaryDark }]}>University: {state.name}</Text>
  ) : (
    <Text style={[styles.note, styles.bad]}>Invalid University Code</Text>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: TYPE.caption, fontWeight: '700', marginTop: -SPACING.xs, marginBottom: SPACING.sm },
  bad: { color: FEEDBACK.errorText },
});
