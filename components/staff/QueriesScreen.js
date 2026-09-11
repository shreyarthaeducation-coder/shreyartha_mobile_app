import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import {
  DateTimeField,
  EmptyState,
  FormSheet,
  ScreenScaffold,
  SegmentedTabs,
  StatusChip,
  TextField,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  QUERY_STREAMS,
  fetchQueries,
  getStream,
  sendMeetLink,
  statusTone,
  submitSolution,
} from '../../services/counsellor/queriesService';
import { formatLongDateTime } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Queries — the Shreyartha counsellor's inbox. Portal B only; the school-bound counsellor has no
 * such tab, and its role cannot reach these endpoints.
 *
 * Three independent streams (website / student / chatbot) with identical verbs, so one component
 * serves all three behind the stream descriptor in queriesService.
 */


export default function QueriesScreen({ homeRoute = '/staff/shreyartha_councellor' }) {
  const styles = useStyles();
  const [streamKey, setStreamKey] = useState(QUERY_STREAMS[0].key);
  const [active, setActive] = useState(null);
  const [solution, setSolution] = useState('');
  const [saving, setSaving] = useState(false);

  const [meetOpen, setMeetOpen] = useState(false);
  const [meetForm, setMeetForm] = useState(null);
  const [sendingMeet, setSendingMeet] = useState(false);

  const { toast, showToast } = useToast();

  const fetcher = useCallback((signal) => fetchQueries(streamKey, signal), [streamKey]);
  const { data, loading, refreshing, error, reload, refresh, revalidate } = useStaffResource(
    fetcher,
    { initialData: [] },
  );
  const queries = data || [];
  const stream = getStream(streamKey);

  const open = (query) => {
    setActive(query);
    setSolution(query.solutionProvided || '');
  };

  const save = async () => {
    if (!solution.trim()) {
      showToast('Write a solution before submitting.', 'error');
      return;
    }
    setSaving(true);
    try {
      await submitSolution({ streamKey, id: active.id, solutionProvided: solution.trim() });
      showToast('Solution submitted.', 'success');
      setActive(null);
      await revalidate();
    } catch (e) {
      // A 403 here is real and specific: the query belongs to another counsellor.
      showToast(e?.message || 'Could not submit the solution.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openMeet = () => {
    setMeetForm({ meetLink: '', scheduledAt: null, durationMinutes: '30', message: '' });
    setMeetOpen(true);
  };

  const submitMeet = async () => {
    setSendingMeet(true);
    try {
      const res = await sendMeetLink({
        streamKey,
        id: active.id,
        meetLink: meetForm.meetLink || undefined,
        scheduledAt: meetForm.scheduledAt || undefined,
        durationMinutes: Number(meetForm.durationMinutes) || undefined,
        message: meetForm.message || undefined,
      });
      showToast(res?.message || 'Meet link sent.', 'success');
      setMeetOpen(false);
      setActive(null);
      await revalidate();
    } catch (e) {
      showToast(e?.message || 'Could not send the meet link.', 'error');
    } finally {
      setSendingMeet(false);
    }
  };

  const person = active ? stream.person(active) : null;
  // The server rejects a meet link on anything but a VIDEO query, so don't offer it.
  const canSendMeet = String(active?.preferredMode || '').toUpperCase() === 'VIDEO';

  return (
    <ScreenScaffold
      title="Queries"
      fallbackRoute={homeRoute}
      loading={loading}
      error={queries.length === 0 ? error : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <SegmentedTabs
        options={QUERY_STREAMS.map((s) => ({ value: s.key, label: s.label, icon: s.icon }))}
        value={streamKey}
        onChange={(next) => {
          setStreamKey(next);
          setActive(null);
        }}
        style={styles.tabs}
      />

      {queries.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          title="Nothing assigned"
          message={`No ${stream.label.toLowerCase()} queries are assigned to you right now.`}
        />
      ) : (
        queries.map((query) => {
          const who = stream.person(query);
          return (
            <Pressable
              key={query.id}
              onPress={() => open(query)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View style={styles.cardTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {who.name || 'Unknown'}
                </Text>
                <StatusChip label={query.status || 'NEW'} tone={statusTone(query.status)} />
              </View>
              {query.subject ? (
                <Text style={styles.subject} numberOfLines={1}>
                  {query.subject}
                </Text>
              ) : null}
              {query.message ? (
                <Text style={styles.preview} numberOfLines={2}>
                  {query.message}
                </Text>
              ) : null}
              <View style={styles.cardMeta}>
                {query.preferredMode ? (
                  <Text style={styles.mode}>{query.preferredMode}</Text>
                ) : null}
                {query.createdAt ? (
                  <Text style={styles.date}>{formatLongDateTime(query.createdAt)}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}

      <FormSheet
        visible={!!active && !meetOpen}
        title={person?.name || 'Query'}
        subtitle={active?.subject || undefined}
        onClose={() => setActive(null)}
        onSubmit={save}
        submitting={saving}
        submitLabel={active?.solutionProvided ? 'Update solution' : 'Submit solution'}
        fullHeight
        headerAction={canSendMeet ? { label: '📹 Meet', onPress: openMeet } : undefined}
      >
        <View style={styles.detailBlock}>
          {person?.email ? <Text style={styles.detail}>{person.email}</Text> : null}
          {person?.phone ? <Text style={styles.detail}>{person.phone}</Text> : null}
          {active?.preferredMode ? (
            <Text style={styles.detail}>Prefers {active.preferredMode.toLowerCase()}</Text>
          ) : null}
          {active?.meetLinkSent ? (
            <Text style={styles.detailStrong}>A meet link has already been sent.</Text>
          ) : null}
        </View>

        {active?.message ? (
          <View style={styles.messageBlock}>
            <Text style={styles.messageLabel}>Their question</Text>
            <Text style={styles.message}>{active.message}</Text>
          </View>
        ) : null}

        <TextField
          label="Your solution"
          value={solution}
          onChangeText={setSolution}
          multiline
          inputStyle={styles.solutionInput}
          placeholder="Write the answer you want to send back."
        />
      </FormSheet>

      <FormSheet
        visible={meetOpen}
        title="Send a meet link"
        subtitle={person?.name}
        onClose={() => setMeetOpen(false)}
        onSubmit={submitMeet}
        submitting={sendingMeet}
        submitLabel="Send"
      >
        {meetForm ? (
          <>
            <DateTimeField
              label="When"
              mode="datetime"
              value={meetForm.scheduledAt}
              onChange={(v) => setMeetForm((f) => ({ ...f, scheduledAt: v }))}
            />
            <TextField
              label="Duration (minutes)"
              value={meetForm.durationMinutes}
              onChangeText={(v) =>
                setMeetForm((f) => ({ ...f, durationMinutes: v.replace(/[^0-9]/g, '') }))
              }
              keyboardType="number-pad"
            />
            <TextField
              label="Meet link (optional)"
              value={meetForm.meetLink}
              onChangeText={(v) => setMeetForm((f) => ({ ...f, meetLink: v }))}
              autoCapitalize="none"
              placeholder="Leave blank to let the server create one"
            />
            <TextField
              label="Message (optional)"
              value={meetForm.message}
              onChangeText={(v) => setMeetForm((f) => ({ ...f, message: v }))}
              multiline
              inputStyle={styles.noteInput}
            />
          </>
        ) : null}
      </FormSheet>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  tabs: { marginBottom: SPACING.sm },
  card: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: '#ffffff',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  name: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  subject: { fontSize: TYPE.body, fontWeight: '600', color: SLATE[700], marginTop: 3 },
  preview: { fontSize: TYPE.label, color: SLATE[500], marginTop: 3, lineHeight: leading(TYPE.label) },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 6 },
  mode: {
    fontSize: TYPE.micro,
    fontWeight: '700',
    color: p.primaryDark,
    backgroundColor: p.tint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  date: { fontSize: TYPE.caption, color: SLATE[500] },

  detailBlock: { marginBottom: SPACING.sm, gap: 2 },
  detail: { fontSize: TYPE.label, color: SLATE[600] },
  detailStrong: { fontSize: TYPE.label, fontWeight: '700', color: p.primaryDark, marginTop: 4 },
  messageBlock: {
    backgroundColor: SLATE[50],
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  messageLabel: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  message: { fontSize: TYPE.body, lineHeight: leading(TYPE.body), color: SLATE[700] },
  solutionInput: { height: 130, textAlignVertical: 'top' },
  noteInput: { height: 80, textAlignVertical: 'top' },
  pressed: { opacity: 0.75 },
}));
