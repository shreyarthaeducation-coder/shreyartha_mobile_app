import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * The search box above a list of students on a staff screen (10 Oct 2026). Pass it what
 * `useStudentSearch` (utils/studentSearch.js) returns.
 *
 * Shows "12 of 45 shown" while a search is on, and says so when nobody matches. Searching only
 * hides rows — a screen's "all students" actions still act on all of them.
 */
export default function StudentSearchBar({ search, placeholder = 'Search by name, roll number or phone' }) {
  const styles = useStyles();
  const { query, setQuery, total, shown, active } = search;
  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Ionicons name="search" size={17} color={SLATE[500]} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={SLATE[400]}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search students"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={SLATE[400]} />
          </Pressable>
        ) : null}
      </View>
      {active ? (
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {shown === 0 ? `No student matches “${query.trim()}”.` : `${shown} of ${total} shown`}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { marginBottom: SPACING.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: SLATE[300],
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    backgroundColor: SLATE[50],
  },
  input: { flex: 1, paddingVertical: SPACING.sm, fontSize: TYPE.body, color: SLATE[800] },
  status: { marginTop: SPACING.xs, fontSize: TYPE.caption, color: SLATE[600] },
}));
