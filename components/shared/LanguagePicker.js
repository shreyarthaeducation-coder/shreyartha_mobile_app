import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Change Language — the control the student panel has never had.
 *
 * Everything underneath it already shipped and works: `LanguageProvider` is mounted app-wide in
 * app/_layout.js, it restores the saved code from AsyncStorage, refreshes the list from the public
 * `GET /api/v1/translate/languages`, and `translateBatch` batches through
 * `POST /api/v1/translate/batch` behind a two-layer 24 h cache. The only missing piece was a way for
 * a student to pick. This is that.
 *
 * ── THIS COMPONENT'S OWN WORDS ARE NEVER TRANSLATED ─────────────────────────
 * "Change Language", "Choose your language" and the search placeholder stay English, and every
 * option is shown in its OWN script rather than the current one. The web marks the same component
 * `data-no-translate="true"` for the same reason: a student who lands in Kannada by accident must
 * still be able to find the control that gets them back. A translated language picker is a trap.
 *
 * ── WHY NOT `components/ui/Select` ──────────────────────────────────────────
 * Select's sheet is right, but its two triggers are both light-on-white and neither fits a dark
 * brand bar, and its rows are single-line while a language list needs the native name over the
 * English one. Serving this from there would mean a third trigger variant plus a `renderOption`
 * escape hatch on a component eleven screens already depend on. The sheet ANATOMY is copied
 * deliberately — backdrop, handle, title, search row, list — so the two feel like one control.
 *
 * ── `tone` REACHES THE SHEET, NOT JUST THE TRIGGER ──────────────────────────
 * It originally styled only the trigger, and the sheet was hardcoded dark: `#ffffff` title, `#ffffff`
 * language names, `#ffffff` search text, over `p.pageBg`. Three of the four panels pass
 * tone="light" — parent, partner and teacher — and on parent/partner `pageBg` is `#f8fafc`, so the
 * entire language list was **white text on a near-white sheet**. On teacher (PORTALS.school) it was
 * worse: `pageBg` is not defined at all, so the sheet had no surface whatsoever.
 *
 * The picker is the one control a student who lands in the wrong language must be able to operate,
 * which is why its own words are never translated — an unreadable list defeats that for the same
 * reason a translated one would.
 *
 * ── THE CODES ARE THE BACKEND'S ─────────────────────────────────────────────
 * Konkani is `gom` and Meitei is `mni-Mtei` here, where the website's i18next bundles call them
 * `kok` and `mni`. The mobile app has no bundles — every string goes through the translate API — so
 * the backend enum is the only spelling that can work. Do not "align" these with the web.
 */

export default function LanguagePicker({ compact = false, tone = 'dark' }) {
  const styles = useStyles();
  const palette = usePalette();
  const { language, supportedLanguages, setLanguage, isTranslating } = useLanguage();

  const light = tone === 'light';
  // Secondary ink for the icons and the placeholder, which are set inline rather than through a
  // stylesheet. `palette.onDark` exists only on the student palette; on parent and school it is
  // undefined, which React Native renders as its default BLACK on a light sheet — legible by luck
  // rather than by design, and invisible on the dark one if the tones were ever swapped.
  const muted = light ? SLATE[400] : palette.onDark;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return supportedLanguages;
    return supportedLanguages.filter(
      (l) =>
        String(l.englishName || '').toLowerCase().includes(needle) ||
        String(l.nativeName || '').toLowerCase().includes(needle) ||
        String(l.code || '').toLowerCase().includes(needle),
    );
  }, [query, supportedLanguages]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = async (lang) => {
    close();
    // setLanguage persists to AsyncStorage and never throws — it swallows its own storage errors —
    // so there is nothing to catch here. The screens re-translate off the context change.
    await setLanguage(lang);
  };

  const current = language?.nativeName || language?.englishName || 'English';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, light && styles.triggerLight, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Change language. Current language ${language?.englishName || 'English'}`}
      >
        <Ionicons name="globe-outline" size={16} color={palette.primary} />
        {/* The label collapses to just the language name on a narrow bar, but the globe and the
            caret stay — they are what makes it read as a picker rather than a status line. */}
        {!compact ? (
          <Text style={[styles.triggerLabel, light && styles.triggerLabelLight]}>Change Language</Text>
        ) : null}
        <Text style={[styles.triggerValue, light && styles.triggerValueLight]} numberOfLines={1}>
          {current}
        </Text>
        {isTranslating ? (
          <ActivityIndicator size="small" color={palette.primary} />
        ) : (
          <Ionicons name="chevron-down" size={14} color={palette.primary} />
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          {/* Swallow taps on the sheet so they don't reach the backdrop and close it. */}
          <Pressable style={[styles.sheet, light && styles.sheetLight]} onPress={() => {}}>
            <View style={[styles.handle, light && styles.handleLight]} />
            <Text style={[styles.sheetTitle, light && styles.sheetTitleLight]}>Choose your language</Text>
            <Text style={[styles.sheetNote, light && styles.sheetNoteLight]}>
              English and the 22 scheduled Indian languages.
            </Text>

            <View style={[styles.searchRow, light && styles.searchRowLight]}>
              <Ionicons name="search" size={16} color={muted} />
              <TextInput
                style={[styles.searchInput, light && styles.searchInputLight]}
                value={query}
                onChangeText={setQuery}
                placeholder="Search languages"
                placeholderTextColor={muted}
                autoCorrect={false}
                returnKeyType="search"
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={17} color={muted} />
                </Pressable>
              ) : null}
            </View>

            <FlatList
              data={visible}
              keyExtractor={(item) => String(item.code)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={[styles.noMatch, light && styles.noMatchLight]}>No matches.</Text>
              }
              renderItem={({ item }) => {
                const active = language?.code === item.code;
                return (
                  <Pressable
                    onPress={() => pick(item)}
                    style={({ pressed }) => [
                      styles.option,
                      light && styles.optionLight,
                      active && styles.optionActive,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={styles.optionText}>
                      <Text
                        style={[styles.native, light && styles.nativeLight, active && styles.nativeActive]}
                      >
                        {item.nativeName || item.englishName || item.code}
                      </Text>
                      <Text style={[styles.english, light && styles.englishLight]}>
                        {item.englishName || item.code}
                      </Text>
                    </View>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={20} color={palette.primary} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: p.tint,
    borderWidth: 1,
    borderColor: p.glassDarkBorder,
    maxWidth: '100%',
  },
  // tone="light" — the parent panel, whose palette carries no dark tokens.
  triggerLight: { backgroundColor: p.tint, borderColor: SLATE[200] },
  triggerLabel: { fontSize: TYPE.caption, fontWeight: '600', color: p.onDark },
  triggerLabelLight: { color: SLATE[500] },
  triggerValue: { fontSize: TYPE.caption, fontWeight: '800', color: '#ffffff', flexShrink: 1 },
  triggerValueLight: { color: p.primaryDark },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '78%',
    backgroundColor: p.pageBg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: p.glassDarkBorder,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  // tone="light" — parent, partner and teacher. An explicit opaque surface: two of those three
  // palettes have no `pageBg` value that suits a sheet, and one has none at all.
  sheetLight: { backgroundColor: '#ffffff', borderColor: SLATE[200] },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: p.glassDarkBorder,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  handleLight: { backgroundColor: SLATE[300] },
  sheetTitle: { fontSize: TYPE.title, fontWeight: '800', color: '#ffffff' },
  sheetTitleLight: { color: SLATE[800] },
  sheetNote: { fontSize: TYPE.caption, color: p.onDark, marginTop: 2, marginBottom: SPACING.md },
  sheetNoteLight: { color: SLATE[500] },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: p.glassDarkRaised,
    borderWidth: 1,
    borderColor: p.glassDarkBorder,
    marginBottom: SPACING.sm,
  },
  searchRowLight: { backgroundColor: SLATE[100], borderColor: SLATE[200] },
  // No per-focus setState anywhere near this input — see components/auth/FormField's note on the
  // Android keyboard-dismiss bug. The border never changes, so the field cannot re-render on focus.
  searchInput: { flex: 1, paddingVertical: 11, fontSize: TYPE.body, color: '#ffffff' },
  searchInputLight: { color: SLATE[800] },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: p.glassDarkRaised,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionLight: { backgroundColor: SLATE[50] },
  // Last in the cascade at both tones, so the selected language always reads as selected.
  optionActive: { borderColor: p.primary, backgroundColor: p.tint },
  optionText: { flex: 1 },
  native: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  nativeLight: { color: SLATE[800] },
  nativeActive: { color: p.primary },
  english: { fontSize: TYPE.caption, color: p.onDark, marginTop: 1 },
  englishLight: { color: SLATE[500] },
  noMatch: { fontSize: TYPE.body, color: p.onDark, textAlign: 'center', paddingVertical: SPACING.lg },
  noMatchLight: { color: SLATE[500] },

  pressed: { opacity: 0.75 },
}));
