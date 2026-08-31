import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * The dashboard's search bar.
 *
 * ── IT IS A REAL INPUT, NOT A BUTTON DRESSED AS ONE ─────────────────────────
 * The common shortcut here is to render a fake field that pushes a search screen on tap, so the
 * student types twice — once to open it, once for real. This one takes the query where it stands and
 * hands it to the results screen, so a student who types "photosynthesis" and hits the keyboard's
 * search key lands on results for it. Tapping Search with an empty box still opens the screen, so
 * browsing works too.
 *
 * `onSubmitEditing` and the button share one handler, and the field is uncontrolled from the
 * dashboard's point of view — its state lives here. Nothing above it re-renders per keystroke, which
 * is the rule that keeps the Android keyboard from closing mid-word (see components/auth/FormField).
 */

export default function SearchEntry({ placeholder, buttonLabel, onSearch, tone = 'dark' }) {
  const styles = useStyles();
  const palette = usePalette();
  const light = tone === 'light';
  const [query, setQuery] = useState('');

  const submit = () => onSearch?.(query.trim());

  return (
    <View style={[styles.wrap, light && styles.wrapLight]}>
      <Ionicons name="search" size={18} color={light ? SLATE[400] : palette.onDark} />
      <TextInput
        style={[styles.input, light && styles.inputLight]}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={submit}
        placeholder={placeholder || 'Search to explore topics, resources, courses and more…'}
        placeholderTextColor={light ? SLATE[400] : palette.onDark}
        autoCorrect={false}
        returnKeyType="search"
      />
      <Pressable
        onPress={submit}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Search"
      >
        <Text style={styles.buttonText}>{buttonLabel || 'Search'}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingLeft: SPACING.md,
    paddingRight: 5,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: p.glassDark,
    borderWidth: 1,
    borderColor: p.glassDarkBorder,
    marginTop: SPACING.sm,
  },
  // tone="light" — the parent panel, whose palette carries no dark tokens.
  wrapLight: { backgroundColor: '#ffffff', borderColor: SLATE[200] },
  input: { flex: 1, paddingVertical: 10, fontSize: TYPE.label, color: '#ffffff' },
  inputLight: { color: SLATE[800] },
  button: {
    minHeight: TOUCH.min,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: p.primaryDark,
  },
  buttonText: { fontSize: TYPE.label, fontWeight: '800', color: '#ffffff' },
  pressed: { opacity: 0.8 },
}));
