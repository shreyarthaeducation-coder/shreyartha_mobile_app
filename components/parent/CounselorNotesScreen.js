import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { SLATE, SPACING } from '../../constants/theme';
import { Card, EmptyState, ScreenScaffold, StatusChip } from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import { fetchCounselorNotes } from '../../services/parent/insightsService';
import { formatLongDate } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Counselor Notes — what the school counsellor has shared about this child.
 *
 * Read-only, and one flat list; the web has no filtering, sorting or detail view here either.
 *
 * `useStaffResource` despite the name — it is transport-agnostic (it takes a fetcher and imports
 * nothing but React), so it serves every panel. Renaming it would touch ~40 shipped files.
 */

export default function CounselorNotesScreen() {
  const styles = useStyles();

  const fetcher = useCallback((signal) => fetchCounselorNotes(signal), []);
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher, {
    initialData: [],
  });

  const notes = data || [];

  return (
    <ScreenScaffold
      title="Counselor Notes"
      fallbackRoute="/parent"
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {notes.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="No counsellor notes"
          message="Nothing has been shared about your child yet."
        />
      ) : (
        notes.map((note) => (
          <Card key={note.id} style={styles.item}>
            <View style={styles.head}>
              <Text style={styles.counselor} numberOfLines={1}>
                {note.counselorName || 'Counsellor'}
              </Text>
              {note.counsellingType ? (
                <StatusChip label={note.counsellingType} tone="info" />
              ) : null}
            </View>

            <Text style={styles.date}>
              {/* The web prefers a `date` field the DTO never sends, so this falls to the two that
                  do exist. */}
              {formatLongDate(note.sessionDate || note.createdAt) || '—'}
            </Text>

            {note.counselorNotes ? (
              <Text style={styles.notes}>{note.counselorNotes}</Text>
            ) : null}

            {note.caseStatus ? (
              <View style={styles.footer}>
                <StatusChip label={`Status: ${note.caseStatus}`} tone="neutral" />
              </View>
            ) : null}
          </Card>
        ))
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  item: { marginBottom: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counselor: { flex: 1, fontSize: 15, fontWeight: '700', color: SLATE[800] },
  date: { fontSize: 12.5, color: SLATE[500], marginTop: 3, fontWeight: '600' },
  notes: { fontSize: 13.5, color: SLATE[600], lineHeight: 20, marginTop: SPACING.sm },
  footer: { flexDirection: 'row', marginTop: SPACING.sm },
}));
