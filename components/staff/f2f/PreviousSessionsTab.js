import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SLATE, SPACING, TOUCH, TYPE, FEEDBACK } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { Card, EmptyState, Select, StatusChip, TextField } from '../../ui';
import { listSessions } from '../../../services/counsellor/f2fService';
import {
  fetchWrapUpStudents,
  saveWrapUp,
} from '../../../services/counsellor/activityReportService';

/**
 * Previous sessions, and the wrap-up each one still needs.
 *
 * Two screens in one: a list of finished sessions, and — once one is opened — its roster with the
 * attendance and counselling note the counsellor owes for each student.
 *
 * ══ THE BATCH SAVE ALWAYS ANSWERS 200 ══════════════════════════════════════
 * `POST /wrap-up` returns a per-student `results` array rather than failing the request. That is
 * deliberate: one student erroring must not discard the other twenty-nine entries a counsellor has
 * just typed. So the status code says nothing useful — read `results` and report what actually
 * failed, by name.
 */
export default function PreviousSessionsTab({ portal }) {
  const styles = useStyles();
  const palette = usePalette();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [roster, setRoster] = useState([]);
  const [entries, setEntries] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await listSessions(portal.f2f, { page: 0 });
        const rows = Array.isArray(res) ? res : res?.content || res?.items || [];
        if (alive) setSessions(rows);
      } catch (e) {
        if (alive) setError(e?.message || 'Could not load your sessions.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [portal.f2f]);

  const openSession = useCallback(
    async (session) => {
      setOpen(session);
      setRoster([]);
      setEntries({});
      setNotice('');
      try {
        const rows = await fetchWrapUpStudents(portal.activityReports, {
          source: 'LIVE',
          sessionId: session.sessionUuid || session.id,
        });
        setRoster(Array.isArray(rows) ? rows : []);
      } catch (e) {
        setError(e?.message || 'Could not load that session.');
      }
    },
    [portal.activityReports],
  );

  const patch = (studentId, key, value) =>
    setEntries((e) => ({ ...e, [studentId]: { ...(e[studentId] || {}), [key]: value } }));

  const save = async () => {
    if (!open) return;
    setSaving(true);
    setNotice('');
    try {
      const payload = {
        source: 'LIVE',
        sessionId: open.sessionUuid || open.id,
        date: open.sessionDate || new Date().toISOString().slice(0, 10),
        entries: roster.map((s) => {
          const e = entries[s.studentId] || {};
          return {
            studentId: s.studentId,
            attendanceStatus: e.attendanceStatus || s.attendanceStatus || 'PRESENT',
            counselling: {
              sessionId: open.sessionUuid || open.id,
              counsellingType: e.counsellingType || 'GENERAL',
              counselorNotes: e.counselorNotes || '',
              caseStatus: e.caseStatus || 'OPEN',
            },
          };
        }),
      };
      const res = await saveWrapUp(portal.activityReports, payload);
      // Per-student, because the request succeeds even when individual rows do not.
      const failures = (res?.results || []).filter((r) => r && r.success === false);
      setNotice(
        failures.length
          ? `Saved, except for ${failures.length} student${failures.length === 1 ? '' : 's'}.`
          : 'Wrap-up saved.',
      );
    } catch (e) {
      setError(e?.message || 'Could not save the wrap-up.');
    } finally {
      setSaving(false);
    }
  };

  if (open) {
    return (
      <View>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <Pressable
          onPress={() => setOpen(null)}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={[styles.backText, { color: palette.primary }]}>← All sessions</Text>
        </Pressable>

        <Card>
          <Text style={styles.title}>{open.title || 'Session'}</Text>
          <Text style={styles.meta}>{open.sessionDate || ''}</Text>
        </Card>

        {roster.length === 0 ? (
          <EmptyState message="Nobody was enrolled in this session." />
        ) : (
          roster.map((s) => {
            const e = entries[s.studentId] || {};
            return (
              <Card key={s.studentId}>
                <Text style={styles.name}>{s.studentName || s.fullName}</Text>
                <Select
                  label="Attendance"
                  value={e.attendanceStatus || s.attendanceStatus || 'PRESENT'}
                  options={[
                    { value: 'PRESENT', label: 'Present' },
                    { value: 'ABSENT', label: 'Absent' },
                    { value: 'LATE', label: 'Late' },
                  ]}
                  onChange={(v) => patch(s.studentId, 'attendanceStatus', v)}
                />
                <TextField
                  label="Counselling note"
                  value={e.counselorNotes || ''}
                  onChangeText={(v) => patch(s.studentId, 'counselorNotes', v)}
                  multiline
                  placeholder="What was discussed"
                />
              </Card>
            );
          })
        )}

        {roster.length ? (
          <Pressable
            onPress={save}
            disabled={saving}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: palette.primary },
              saving && styles.disabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save wrap-up'}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <Text style={styles.meta}>Loading your sessions…</Text>
      ) : sessions.length === 0 ? (
        <EmptyState message="You have not run a face-to-face session yet." />
      ) : (
        sessions.map((s) => (
          <Pressable
            key={s.sessionUuid || s.id}
            onPress={() => openSession(s)}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Card>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{s.title || 'Session'}</Text>
                  <Text style={styles.meta}>{s.sessionDate || ''}</Text>
                </View>
                <StatusChip
                  label={s.sessionStatus || 'COMPLETED'}
                  tone={s.sessionStatus === 'COMPLETED' ? 'success' : 'neutral'}
                />
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  title: { fontSize: TYPE.title, fontWeight: '800', color: SLATE[900] },
  name: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  meta: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  rowText: { flex: 1, minWidth: 0 },

  back: { minHeight: TOUCH.min, justifyContent: 'center' },
  backText: { fontSize: TYPE.label, fontWeight: '700' },

  error: {
    fontSize: TYPE.caption,
    color: FEEDBACK.errorOnBg,
    backgroundColor: FEEDBACK.errorBg,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  notice: {
    fontSize: TYPE.caption,
    color: FEEDBACK.successOnBg,
    backgroundColor: FEEDBACK.successBg,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  primary: {
    minHeight: TOUCH.min,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
}));
