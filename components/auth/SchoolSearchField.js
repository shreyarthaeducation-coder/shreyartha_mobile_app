import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import FormField from './FormField';
import { API_BASE_URL } from '../../services/apiService';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';

/**
 * Pick a school the way the website's SchoolPlaceSearch does (6 Nov 2026): the backend searches the
 * platform's own schools and Google Places together (`/api/website/schools/search`), so the app
 * holds no Places key. A Google result is resolved to full details on tap (pincode, city…); a
 * school that is not found can be typed in by hand. `value` is the pick, `pickToPayload` is what
 * the server takes, `pickProblem` the website's own check.
 *
 * Public endpoints, so a plain fetch: no token, and nothing here can end anyone's session.
 */

const newSession = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const getJson = async (path) => {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    const err = new Error(`Search failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
};

export const pickToPayload = (pick) =>
  pick
    ? {
        schoolId: pick.schoolId ?? null,
        placeId: pick.placeId || null,
        name: pick.name || null,
        address: pick.address || null,
        pincode: (pick.pincode || '').trim() || null,
        city: pick.city || null,
        state: pick.state || null,
        latitude: pick.latitude ?? null,
        longitude: pick.longitude ?? null,
      }
    : null;

export const pickProblem = (pick, { required = true } = {}) => {
  if (!pick) return required ? 'Please choose the school from the search.' : '';
  if (!pick.schoolId && !(pick.name || '').trim()) return "Please enter the school's name.";
  const pin = (pick.pincode || '').trim();
  if (pin && !/^\d{6}$/.test(pin)) return 'The pincode must be 6 digits.';
  return '';
};

export default function SchoolSearchField({ value, onChange, palette, label = 'School you studied at' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(false);
  const session = useRef(newSession());

  useEffect(() => {
    const term = query.trim();
    if (value || manual || term.length < 3) {
      setResults([]);
      setSearched(false);
      return undefined;
    }
    let live = true;
    setLoading(true);
    const timer = setTimeout(() => {
      getJson(`/api/website/schools/search?q=${encodeURIComponent(term)}&session=${encodeURIComponent(session.current)}`)
        .then((res) => {
          if (!live) return;
          setResults(Array.isArray(res?.results) ? res.results : []);
          setError('');
        })
        .catch((e) => {
          if (!live) return;
          setResults([]);
          setError(e?.status === 429 ? 'Too many searches. Please wait a minute.' : 'The search is not available right now.');
        })
        .finally(() => {
          if (!live) return;
          setLoading(false);
          setSearched(true);
        });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, value, manual]);

  const choose = async (r) => {
    setResults([]);
    setQuery('');
    if (r.source === 'PLATFORM') {
      onChange({ schoolId: r.schoolId, placeId: r.placeId, name: r.name, address: r.address, pincode: r.pincode || '', city: r.city, state: r.state, latitude: r.latitude, longitude: r.longitude, onPlatform: true });
      session.current = newSession();
      return;
    }
    setLoading(true);
    try {
      const d = await getJson(`/api/website/schools/place/${encodeURIComponent(r.placeId)}?session=${encodeURIComponent(session.current)}`);
      onChange({
        schoolId: d.schoolId ?? null,
        placeId: d.placeId || r.placeId,
        name: d.name || r.name,
        address: d.address || r.secondary || '',
        pincode: d.pincode || '',
        city: d.city,
        state: d.state,
        latitude: d.latitude,
        longitude: d.longitude,
        onPlatform: !!d.onPlatform,
      });
    } catch {
      // Keep what the suggestion said; they can still type the pincode.
      onChange({ schoolId: r.schoolId ?? null, placeId: r.placeId, name: r.name, address: r.secondary || '', pincode: '', onPlatform: !!r.onPlatform });
    } finally {
      setLoading(false);
      session.current = newSession();
    }
  };

  if (value && !manual) {
    return (
      <View style={styles.picked}>
        <View style={styles.pickedText}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.name}>{value.name}</Text>
          {value.address ? <Text style={styles.meta}>{value.address}</Text> : null}
          {value.onPlatform ? <Text style={[styles.meta, { color: palette.primaryDark }]}>On The 3C Edge</Text> : null}
        </View>
        <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.link, { color: palette.primaryDark }]}>Change</Text>
        </Pressable>
      </View>
    );
  }

  if (manual) {
    const v = value || { name: '', pincode: '', city: '' };
    return (
      <View>
        <FormField palette={palette} label="School name" required value={v.name} onChangeText={(name) => onChange({ ...v, name })} placeholder="Your school's full name" />
        <FormField palette={palette} label="City" value={v.city || ''} onChangeText={(city) => onChange({ ...v, city })} placeholder="City" />
        <FormField
          palette={palette}
          label="Pincode"
          value={v.pincode || ''}
          onChangeText={(p) => onChange({ ...v, pincode: p.replace(/[^0-9]/g, '') })}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="6 digits"
        />
        <Pressable
          onPress={() => {
            setManual(false);
            onChange(null);
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.link, { color: palette.primaryDark }]}>Search for the school instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <FormField
        palette={palette}
        label={label}
        value={query}
        onChangeText={setQuery}
        placeholder="Type the school's name and town"
        autoCorrect={false}
        rightSlot={loading ? <ActivityIndicator size="small" color={palette.primary} /> : null}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {results.map((r) => (
        <Pressable key={r.placeId || `p-${r.schoolId}`} onPress={() => choose(r)} style={({ pressed }) => [styles.result, pressed && styles.pressed]} accessibilityRole="button">
          <Text style={styles.name}>{r.name}</Text>
          <Text style={styles.meta}>{r.secondary || r.address || [r.city, r.state].filter(Boolean).join(', ')}</Text>
          {r.source === 'PLATFORM' || r.onPlatform ? <Text style={[styles.meta, { color: palette.primaryDark }]}>On The 3C Edge</Text> : null}
        </Pressable>
      ))}
      {searched && !results.length && !error ? <Text style={styles.meta}>No school matches yet — keep typing, or enter it yourself.</Text> : null}
      <Pressable onPress={() => setManual(true)} accessibilityRole="button">
        <Text style={[styles.link, { color: palette.primaryDark }]}>Can't find your school? Enter it yourself</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700] },
  picked: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: SLATE[200], borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.md, backgroundColor: '#ffffff' },
  pickedText: { flex: 1 },
  name: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[900] },
  meta: { fontSize: TYPE.caption, lineHeight: leading(TYPE.caption), color: SLATE[600], marginTop: 2 },
  link: { fontSize: TYPE.label, fontWeight: '800', marginTop: SPACING.xs, marginBottom: SPACING.md },
  result: { borderWidth: 1, borderColor: SLATE[200], borderRadius: 12, padding: SPACING.sm, marginBottom: SPACING.xs, backgroundColor: '#ffffff' },
  pressed: { opacity: 0.8 },
  error: { fontSize: TYPE.caption, color: FEEDBACK.errorText, marginBottom: SPACING.sm },
});
