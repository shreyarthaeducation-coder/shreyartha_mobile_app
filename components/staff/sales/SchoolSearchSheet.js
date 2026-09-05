import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import useStaffResource from '../../../hooks/useStaffResource';
import { createLead, searchSchools } from '../../../services/sales/salesService';
import { formatGrades } from './salesFormat';

/**
 * Pick the school you are standing outside — from every school the TEAM has entered, not just
 * your own leads.
 *
 * ── WHY THIS IS NOT `Select searchable` ─────────────────────────────────────
 * `Select`'s search filters an array already in memory. This one has to ask the server, which it
 * cannot do: the trigger label is derived from the options array (so a server-driven list blanks
 * the selection between queries), there is no loading state, its empty state is a fixed string
 * with nowhere to put a "create" row, and its rows are single-line with no override. What IS
 * reused is its sheet skeleton — the modal, backdrop, handle and search row below are Select's,
 * deliberately, so the two read as the same control.
 *
 * ── WHAT SELECTING ONE DOES ─────────────────────────────────────────────────
 * Nothing, to the colleague who entered it. The server clones a foreign lead into one of the
 * searcher's own at check-in, which is what keeps every other per-rep query in the module honest.
 * The "added by a colleague" chip is there so the rep knows what they are picking up.
 *
 * @param visible
 * @param onClose
 * @param onSelect  ({ leadId, schoolName, city, pincode, … }) => void
 */
export default function SchoolSearchSheet({ visible, onClose, onSelect }) {
  const palette = usePalette();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [addPincode, setAddPincode] = useState('');
  const [creating, setCreating] = useState(false);

  // One request per pause in typing, not one per keystroke. useStaffResource aborts the previous
  // request when this changes, so a slow reply for "st xav" cannot land after "st xavier".
  const debounced = useDebouncedValue(query.trim(), 300);
  const longEnough = debounced.length >= 2;

  const fetcher = useCallback((signal) => searchSchools({ q: debounced }, signal), [debounced]);
  const { data, loading, error } = useStaffResource(fetcher, { enabled: longEnough });
  const results = Array.isArray(data) ? data : [];

  const reset = () => {
    setQuery('');
    setAdding(false);
    setAddError('');
    setAddPincode('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const choose = (school) => {
    reset();
    onSelect(school);
  };

  /** Creates the school from a name and a PIN, then hands it straight back to the caller. */
  const addNew = async () => {
    setAddError('');
    const schoolName = query.trim();
    if (!schoolName) {
      setAddError('Type the school name first.');
      return;
    }
    if (!/^\d{6}$/.test(addPincode.trim())) {
      setAddError('A valid 6-digit pincode is required.');
      return;
    }
    setCreating(true);
    try {
      const lead = await createLead({ schoolName, pincode: addPincode.trim() });
      // A same-name-same-pincode clash comes back as `duplicateWarning[]` ON the created lead,
      // not as an error — the save succeeded. Treating it as a failure would strand the rep at a
      // gate with a school that now exists.
      choose({
        leadId: lead.id,
        schoolName: lead.schoolName,
        city: lead.city,
        pincode: lead.pincode,
        mine: true,
      });
    } catch (e) {
      setAddError(e?.message || 'Could not add the school.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        {/* Swallow taps on the sheet so they don't reach the backdrop and close it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Find the school</Text>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={SLATE[400]} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                setAdding(false);
              }}
              placeholder="School name or pincode"
              placeholderTextColor={SLATE[400]}
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={17} color={SLATE[400]} />
              </Pressable>
            ) : null}
          </View>

          {adding ? (
            <View style={styles.addBox}>
              <Text style={styles.addTitle}>{`Add “${query.trim()}”`}</Text>
              <Text style={styles.hint}>
                A name and a pincode are all it needs now — the board, contact and grades can go in
                later on the LEAD page.
              </Text>
              <TextInput
                style={styles.addInput}
                value={addPincode}
                onChangeText={(v) => setAddPincode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit pincode"
                placeholderTextColor={SLATE[400]}
                keyboardType="number-pad"
                maxLength={6}
              />
              {addError ? <Text style={styles.error}>{addError}</Text> : null}
              <View style={styles.addActions}>
                <Pressable
                  onPress={addNew}
                  disabled={creating}
                  style={({ pressed }) => [
                    styles.addBtn,
                    { backgroundColor: palette.primaryDark },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.addBtnText}>
                    {creating ? 'Adding…' : 'Add and continue'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setAdding(false)} hitSlop={6}>
                  <Text style={[styles.link, { color: palette.link }]}>Back to search</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <FlatList
              data={longEnough ? results : []}
              keyExtractor={(item) => String(item.leadId)}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <Text style={styles.hint}>
                  Searches every school your team has entered, not just yours.
                </Text>
              }
              ListEmptyComponent={
                <Text style={styles.noMatch}>
                  {!longEnough
                    ? 'Type at least two characters.'
                    : loading
                      ? 'Searching…'
                      : error || 'No school matches that.'}
                </Text>
              }
              // Offered whenever a search has actually run, not only on zero results: a rep may
              // see three near-matches and still be standing at a fourth school.
              ListFooterComponent={
                longEnough && !loading ? (
                  <Pressable
                    onPress={() => {
                      setAdding(true);
                      setAddError('');
                    }}
                    style={({ pressed }) => [styles.addRow, pressed && styles.optionPressed]}
                  >
                    <Ionicons name="add-circle-outline" size={19} color={palette.primaryDark} />
                    <Text style={[styles.addRowText, { color: palette.primaryDark }]}>
                      {`Add “${query.trim()}” as a new school`}
                    </Text>
                  </Pressable>
                ) : null
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => choose(item)}
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.optionName}>{item.schoolName}</Text>
                  <Text style={styles.optionMeta}>
                    {[item.city, item.pincode, item.board].filter(Boolean).join(' · ')}
                    {item.grades ? ` · ${formatGrades(item.grades)}` : ''}
                  </Text>
                  {item.mine === false ? (
                    <Text style={styles.colleague}>Added by a colleague</Text>
                  ) : null}
                </Pressable>
              )}
            />
          )}

          {loading && longEnough && !adding ? (
            <ActivityIndicator style={styles.spinner} color={palette.primary} />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// The backdrop / sheet / handle / searchRow block below is Select.js's, on purpose — the two
// controls should look identical to a rep.
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: SPACING.lg,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: SLATE[300],
    marginBottom: SPACING.sm,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: SLATE[800],
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    backgroundColor: SLATE[50],
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14.5, color: SLATE[900] },

  hint: {
    fontSize: 12,
    color: SLATE[400],
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  noMatch: {
    fontSize: 13,
    color: SLATE[400],
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },

  option: {
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  optionPressed: { backgroundColor: SLATE[50] },
  optionName: { fontSize: 15, color: SLATE[800], fontWeight: '600' },
  optionMeta: { fontSize: 12.5, color: SLATE[500], marginTop: 2 },
  colleague: { fontSize: 11.5, color: SLATE[400], fontStyle: 'italic', marginTop: 2 },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  addRowText: { fontSize: 14, fontWeight: '600', flex: 1 },

  addBox: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  addTitle: { fontSize: 15, fontWeight: '700', color: SLATE[800], marginBottom: 4 },
  addInput: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: SLATE[900],
    backgroundColor: '#ffffff',
    marginTop: SPACING.sm,
  },
  error: { marginTop: 6, fontSize: 12.5, color: '#b91c1c', fontWeight: '500' },
  addActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  addBtn: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 18 },
  addBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  link: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  spinner: { paddingVertical: SPACING.sm },
});
