import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TOUCH, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { Card, EmptyState, FormSheet, StatusChip, TextField } from '../../ui';
import ReportFormSheet from '../counsellor/ReportFormSheet';
import RecorderBar from './RecorderBar';
import StudentBasket from './StudentBasket';
import useTurnRecorder from '../../../hooks/useTurnRecorder';
import {
  GRIFFIN_SECTION_KEY,
  REPORT_SECTIONS,
  buildEmptyForm,
  hydrateForm,
} from '../../../constants/counsellorReportConfig';
import {
  createSession,
  fetchState,
  fetchTranscript,
  finishTurn,
  grantMic,
  removeParticipant,
  revokeMic,
  setConsent,
  setSessionStatus,
  skipParticipant,
  uploadSegment,
  walkIn,
} from '../../../services/counsellor/f2fService';
import {
  generateReport,
  publishReport,
  saveReport,
} from '../../../services/counsellor/activityReportService';

/**
 * The face-to-face counselling room.
 *
 * One session, a queue of students, one microphone, and an AI-drafted narrative per student.
 * Native port of `frontendmain/src/School/shared/F2F/F2FLiveSession.js`.
 *
 * ══ THE ORDERINGS BELOW ARE LOAD-BEARING ═══════════════════════════════════
 * Three of them have each already caused a real defect on the web, and every one is invisible to a
 * build:
 *
 *   1. `await recorder.stop()` BEFORE `/finish`. Finishing a turn nulls its mic token server-side
 *      and `uploadSegment` then refuses the audio permanently. Fire-and-forget here loses the
 *      entire recording, not merely its tail.
 *   2. The turn identity is pinned when RECORDING starts, not when a student is seated — see
 *      `useTurnRecorder`. Seating is too early, and the failure mode is a recording filed under
 *      another child's name.
 *   3. `saveReport()` BEFORE `generate`. The model reads the stored row, so anything ticked in the
 *      last two seconds has to be on it before drafting starts.
 *
 * ══ THE QUEUE ARRIVES ON THE STATE POLL ════════════════════════════════════
 * There is no participants endpoint to call. `GET /sessions/{uuid}/state?since=` returns
 * `participants` and `activeParticipantId` alongside the revision, and it is applied ONLY when
 * `changed` is true — re-rendering every three seconds would discard whatever is being typed.
 *
 * ══ A QUEUE ROW AND A WALK-IN REQUEST USE DIFFERENT FIELD NAMES ════════════
 * They are two DTOs and they do not agree, which cost a device round-trip to find:
 *
 *   READ  `F2FParticipantResponse` → `id`, `name`, `grade`
 *   WRITE `F2FParticipantRequest`  → `displayName`, `gradeLabel`
 *
 * Reading the request's vocabulary off a response yields `undefined` three times over, and only
 * ONE of those three is loud: React warns about the missing `key`. The other two are silent — a
 * blank name renders as nothing, and `undefined` as the participant id makes every Start and Skip
 * call a URL ending in `/undefined`. `turnStatus` has the same trap: there is no `DONE`, the two
 * terminal values are `DRAFTED` and `COMPLETED`, so testing for `DONE` leaves the queue looking
 * permanently unfinished and the "n of m done" counter pinned at zero.
 *
 * ══ TURN STATUS, IN FULL ═══════════════════════════════════════════════════
 * Nine values, from `F2FParticipant.TurnStatus`:
 *
 *   WAITING → MIC_GRANTED → RECORDING → ENDED → TRANSCRIBING → DRAFTED | COMPLETED
 *   plus SKIPPED and FAILED, off to the side.
 *
 * `DRAFTED` and `COMPLETED` are the two terminal values — the split is whether a report row came
 * out of it — and only those two count as done. Only `WAITING` may be removed: anything past it
 * owns a turn row that removal would orphan, and the server refuses. A finished student can be
 * started AGAIN, which opens a second turn and a second report for the same child on the same day;
 * nothing in the schema prevents that, so it is warned about rather than blocked.
 *
 * @param variant 'queue' (the Live tab) or 'walkin' — the same room, different enrolment
 */
export default function LiveSessionTab({ portal, variant = 'queue', schoolName }) {
  const styles = useStyles();
  const palette = usePalette();
  const isWalkIn = variant === 'walkin';

  const f2f = portal.f2f;
  const reports = portal.activityReports;

  const [session, setSession] = useState(null);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  /** The student on screen. `reportId` lives INSIDE this so it dies with them — see openChair. */
  const [active, setActive] = useState(null);
  const [form, setForm] = useState(buildEmptyForm());
  const [notes, setNotes] = useState('');
  const [turnFinished, setTurnFinished] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [steer, setSteer] = useState('');
  const [missingSignals, setMissingSignals] = useState([]);
  const [addOpen, setAddOpen] = useState(false);

  const savedRef = useRef('');
  const transcriptRef = useRef({ transcript: null, speakerCount: null, minorityShare: null });

  const sttAvailable = state?.sttAvailable !== false;
  const consentObtained = !!session?.consentObtained;

  // ── Recording ───────────────────────────────────────────────────────────
  const uploadTurn = useCallback(
    async ({ file, identity, durationMs }) => {
      await uploadSegment(f2f, identity.turnId, {
        file,
        micToken: identity.micToken,
        // One file per turn, so always index 0. The server keys segments on
        // (turnId, segmentIndex) and is idempotent, which makes a retry safe.
        segmentIndex: 0,
        durationMs,
        // Never "STUDENT". Nothing tagged this, and a confidently wrong label is what puts the
        // counsellor's own question into the record as the child's answer.
        speaker: 'UNKNOWN',
      });
    },
    [f2f],
  );

  const recorder = useTurnRecorder({ uploadTurn });

  // ── The state poll ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.sessionUuid) return undefined;
    let alive = true;
    let revision = 0;

    const tick = async () => {
      try {
        const next = await fetchState(f2f, session.sessionUuid, revision || undefined);
        if (!alive || !next) return;
        // Applied only on a real change. The revision short-circuit is the whole point of `since`.
        if (next.changed !== false) {
          revision = next.revision ?? revision;
          setState(next);
        }
      } catch {
        // A dropped poll is not worth an error banner — the next one is three seconds away.
      }
    };

    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [f2f, session?.sessionUuid]);

  /** Force a full re-read, for changes a revision diff cannot express (skip, revoke). */
  const revalidate = useCallback(async () => {
    if (!session?.sessionUuid) return;
    try {
      const next = await fetchState(f2f, session.sessionUuid);
      if (next) setState(next);
    } catch {
      /* the poll will catch up */
    }
  }, [f2f, session?.sessionUuid]);

  // ── Starting a session ──────────────────────────────────────────────────
  const startSession = async ({ schoolId, studentIds, title }) => {
    setBusy(true);
    setError('');
    try {
      const created = await createSession(f2f, {
        mode: isWalkIn ? 'WALK_IN' : 'FACE_TO_FACE',
        title: title || (isWalkIn ? 'Walk-in counselling' : 'Face-to-face counselling'),
        sessionDate: new Date().toISOString().slice(0, 10),
        // A walk-in sends NO schoolId — the server falls back to the counsellor's own school code.
        // Sending one is wrong for the Shreyartha portal, where the counsellor covers several.
        ...(isWalkIn ? {} : { schoolId }),
        ...(isWalkIn ? {} : { studentIds }),
        recordingEnabled: true,
        consentObtained: false,
      });
      setSession(created);
      setState(null);
    } catch (e) {
      setError(e?.message || 'Could not start the session.');
    } finally {
      setBusy(false);
    }
  };

  const toggleConsent = async (next) => {
    if (!session) return;
    try {
      const updated = await setConsent(f2f, session.sessionUuid, next);
      setSession((s) => ({ ...s, ...updated, consentObtained: next }));
    } catch (e) {
      setError(e?.message || 'Could not record consent.');
    }
  };

  // ── Seating a student ───────────────────────────────────────────────────

  /**
   * Reset EVERYTHING that belongs to the previous student, then set the new one last.
   *
   * `setActive` goes last on purpose: it is what the render keys off, so setting it first would
   * paint the new child's name over the previous child's form for a frame.
   */
  const openChair = useCallback((who) => {
    setForm(buildEmptyForm());
    setNotes('');
    setTurnFinished(false);
    setSteer('');
    setMissingSignals([]);
    setNotice('');
    setError('');
    savedRef.current = '';
    transcriptRef.current = { transcript: null, speakerCount: null, minorityShare: null };
    setActive(who);
  }, []);

  const seatStudent = async (participant) => {
    if (!session) return;
    setBusy(true);
    setError('');

    // grantMic opens a NEW turn every time, so restarting someone who already has a report in this
    // session creates a second turn and a second report row for the same child on the same day.
    // Nothing in the schema prevents it, so it is said out loud rather than blocked.
    if (participant.reportId) {
      setNotice(
        `${participant.name} already has a report in this session. Continuing will start a second one.`,
      );
    }

    // The response DTO's vocabulary — see the field-names note in the header.
    const who = {
      participantId: participant.id,
      studentId: participant.studentId ?? null,
      studentName: participant.name,
      grade: participant.grade,
      reportId: null,
    };

    try {
      const granted = await grantMic(f2f, session.sessionUuid, participant.id);
      openChair({
        ...who,
        turnId: granted?.turnId ?? null,
        micToken: granted?.micToken ?? null,
      });
    } catch (e) {
      // STILL SEAT THEM. A microphone that could not be granted — recording off, consent missing,
      // somebody else holding it — must not block the counselling itself; the turn degrades to
      // typed notes, which the AI can still work from.
      openChair({ ...who, turnId: null, micToken: null });
      setNotice(e?.message || 'The microphone is unavailable — type your notes instead.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Takes the microphone back from a turn nobody is holding any more.
   *
   * A phone that slept or an app killed mid-turn leaves `activeParticipantId` set server-side, and
   * every later grantMic then fails with "Someone else is recording" — permanently, because the
   * turn's owner is gone. Without this the only escape is abandoning the session.
   */
  const takeMicBack = async (participant) => {
    if (!participant?.turnId) return;
    try {
      await revokeMic(f2f, participant.turnId);
      await revalidate();
    } catch (e) {
      setError(e?.message || 'Could not take the microphone back.');
    }
  };

  const dropParticipant = async (participant) => {
    if (!session) return;
    try {
      await removeParticipant(f2f, session.sessionUuid, participant.id);
      await revalidate();
    } catch (e) {
      setError(e?.message || 'Could not remove that student.');
    }
  };

  const addWalkIn = async ({ displayName, gradeLabel }) => {
    if (!session) return;
    setBusy(true);
    try {
      const res = await walkIn(f2f, session.sessionUuid, { displayName, gradeLabel });
      openChair({
        participantId: res?.participantId ?? null,
        studentId: null,
        studentName: displayName,
        grade: gradeLabel,
        turnId: res?.turnId ?? null,
        micToken: res?.micToken ?? null,
        reportId: null,
      });
      setAddOpen(false);
      await revalidate();
    } catch (e) {
      setError(e?.message || 'Could not add that student.');
    } finally {
      setBusy(false);
    }
  };

  // ── Saving ──────────────────────────────────────────────────────────────
  const persist = useCallback(async () => {
    if (!active) return null;
    const saved = await saveReport(reports, active.reportId, {
      form,
      studentId: active.studentId,
      studentName: active.studentName,
      grade: active.grade,
      counsellorNotes: notes,
      source: isWalkIn ? 'WALK_IN' : 'FACE_TO_FACE',
      f2fTurnId: active.turnId,
      // Only a walk-in carries a school name of its own; a rostered student's school is implied
      // by the session.
      ...(isWalkIn && schoolName ? { schoolName } : {}),
    });
    if (saved?.id && !active.reportId) {
      setActive((a) => (a ? { ...a, reportId: saved.id } : a));
    }
    return saved?.id || active.reportId || null;
  }, [active, form, notes, isWalkIn, reports, schoolName]);

  // Debounced autosave, and only while a turn is live. `turnFinished` stops it so a published
  // draft is not overwritten by a stale form.
  useEffect(() => {
    if (!active || turnFinished) return undefined;
    const serialised = JSON.stringify({ form, notes });
    if (serialised === savedRef.current) return undefined;
    const timer = setTimeout(async () => {
      try {
        await persist();
        savedRef.current = serialised;
      } catch {
        // Left for the explicit save at turn end — a failed autosave must not interrupt a session.
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [active, form, notes, turnFinished, persist]);

  // ── Ending the turn ─────────────────────────────────────────────────────
  const endTurn = async () => {
    if (!active) return;
    setGenerating(true);
    setError('');
    try {
      // (1) AWAITED. See the class note — this is the difference between a recorded session and a
      // lost one, because `/finish` below invalidates the mic token.
      await recorder.stop();

      // (3) The row before the model reads it.
      const reportId = await persist();

      let transcript = null;
      let speakerCount = null;
      let minorityShare = null;

      if (active.turnId) {
        await finishTurn(f2f, active.turnId, false);
        try {
          const t = await fetchTranscript(f2f, active.turnId);
          // `labelledText`, NOT `text`. The flat blob discards the speaker tags the prompt is told
          // to rely on.
          transcript = t?.labelledText?.trim() ? t.labelledText : null;
          speakerCount = t?.distinctSpeakers ?? null;
          minorityShare = t?.minorityShare ?? null;
        } catch {
          // A transcript that cannot be fetched degrades to the notes, exactly as STT being off does.
        }
      }
      transcriptRef.current = { transcript, speakerCount, minorityShare };

      const outcome = await generateReport(reports, {
        reportId,
        f2fTurnId: active.turnId,
        studentName: active.studentName,
        grade: active.grade,
        pronoun: form.pronoun,
        transcript,
        transcriptSpeakerCount: speakerCount,
        transcriptMinorityShare: minorityShare,
        // ALONGSIDE the transcript, never as a fallback for it.
        typedObservation: notes,
        source: isWalkIn ? 'WALK_IN' : 'FACE_TO_FACE',
      });

      if (outcome?.report) {
        setForm((prev) => hydrateForm(prev, outcome.report));
        if (outcome.report.id) {
          setActive((a) => (a && !a.reportId ? { ...a, reportId: outcome.report.id } : a));
        }
      }
      setMissingSignals(outcome?.missingSignals || []);
      setTurnFinished(true);
      // The server's own message. `aiAvailable:false` covers three different situations and it is
      // the one that knows which — replacing it with "the AI could not be reached" has told
      // counsellors the model was down when the truth was that no audio and no notes reached it.
      if (outcome && outcome.aiAvailable === false) {
        setNotice(outcome.message || 'The AI could not draft this one — write it from your notes.');
      }
      setReportOpen(true);
    } catch (e) {
      setError(e?.message || 'Could not finish this turn.');
    } finally {
      setGenerating(false);
    }
  };

  const regenerate = async () => {
    if (!active) return;
    setGenerating(true);
    try {
      const reportId = await persist();
      const { transcript, speakerCount, minorityShare } = transcriptRef.current;
      const outcome = await generateReport(reports, {
        reportId,
        f2fTurnId: active.turnId,
        studentName: active.studentName,
        grade: active.grade,
        pronoun: form.pronoun,
        transcript,
        transcriptSpeakerCount: speakerCount,
        transcriptMinorityShare: minorityShare,
        typedObservation: notes,
        steer,
        source: isWalkIn ? 'WALK_IN' : 'FACE_TO_FACE',
      });
      if (outcome?.report) setForm((prev) => hydrateForm(prev, outcome.report));
      setMissingSignals(outcome?.missingSignals || []);
    } catch (e) {
      setError(e?.message || 'Could not redraft this one.');
    } finally {
      setGenerating(false);
    }
  };

  const publishAndClear = async (next) => {
    if (!active) return;
    setBusy(true);
    try {
      const reportId = await persist();
      if (reportId) await publishReport(reports, reportId);
      setActive(null);
      setReportOpen(false);
      await revalidate();
      if (next) await seatStudent(next);
      else setNotice('Published.');
    } catch (e) {
      setError(e?.message || 'Could not publish that report.');
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    if (!session) return;
    // The recorder is stopped but NOT awaited into a finish here: there is no turn to attach a
    // late upload to once the session is closed, and the mic must be released either way.
    recorder.stop();
    try {
      await setSessionStatus(f2f, session.sessionUuid, 'COMPLETED');
    } catch {
      /* closing is best-effort — the counsellor is leaving the room */
    }
    setSession(null);
    setState(null);
    setActive(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <StudentBasket
        portal={portal}
        isWalkIn={isWalkIn}
        busy={busy}
        error={error}
        onStart={startSession}
      />
    );
  }

  // `session.participants` covers the first render, before the first poll lands: create and
  // addParticipants both return the full session, so the queue is populated immediately rather
  // than showing "nobody is enrolled" for up to three seconds.
  const participants = state?.participants || session.participants || [];
  const isDone = (p) => p.turnStatus === 'DRAFTED' || p.turnStatus === 'COMPLETED';
  const queue = participants.filter(
    (p) => !isDone(p) && p.turnStatus !== 'SKIPPED' && p.id !== active?.participantId,
  );
  const done = participants.filter(isDone).length;

  return (
    <View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Card>
        <View style={styles.sessionHead}>
          <Text style={styles.sessionTitle}>Live session</Text>
          <StatusChip label={state?.sessionStatus || session.sessionStatus || 'ONGOING'} tone="info" />
          <Pressable
            onPress={endSession}
            style={({ pressed }) => [styles.endBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="End session"
          >
            <Text style={styles.endBtnText}>End session</Text>
          </Pressable>
        </View>

        {/* Consent gates the microphone SERVER-side — grantMic refuses without it and every upload
            re-checks it. It is not a formality the UI can skip. */}
        <Pressable
          onPress={() => toggleConsent(!consentObtained)}
          style={({ pressed }) => [styles.consent, pressed && styles.pressed]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consentObtained }}
        >
          <Ionicons
            name={consentObtained ? 'checkbox' : 'square-outline'}
            size={22}
            color={consentObtained ? palette.primary : SLATE[400]}
          />
          <Text style={styles.consentText}>
            Consent to record has been given for this session.
          </Text>
        </Pressable>

        {!isWalkIn ? (
          <Text style={styles.queueMeta}>
            {`${done} of ${participants.length} done`}
            {queue[0] ? ` · next: ${queue[0].name}` : ''}
          </Text>
        ) : null}
      </Card>

      {/* The queue. Absent for a walk-in, which has no roster by definition. */}
      {!isWalkIn ? (
        <Card>
          <Text style={styles.blockTitle}>Students</Text>
          {participants.length === 0 ? (
            <EmptyState message="Nobody is enrolled in this session yet." />
          ) : (
            participants.map((p) => {
              const rowDone = isDone(p);
              // A turn the server still thinks is open. Its owner may be this very phone after a
              // sleep, so the way out has to be offered on the row itself.
              const stranded = state?.activeParticipantId === p.id;
              return (
                <View key={p.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{p.name}</Text>
                    {p.grade ? <Text style={styles.rowMeta}>{p.grade}</Text> : null}
                  </View>
                  <StatusChip label={p.turnStatus || 'WAITING'} tone={toneFor(p.turnStatus)} />

                  {stranded ? (
                    <Pressable
                      onPress={() => takeMicBack(p)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.seat, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Take the microphone back from ${p.name}`}
                    >
                      {/* warningText, not `warning` — FEEDBACK has no such key, and an undefined
                          colour is a LEGAL RN style value that renders as the default. */}
                      <Text style={[styles.seatText, { color: FEEDBACK.warningText }]}>
                        Take mic back
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => seatStudent(p)}
                      // Consent gates grantMic AND uploadSegment server-side, so starting without
                      // it produces a turn that can never receive audio.
                      disabled={busy || !!active || !consentObtained}
                      hitSlop={6}
                      style={({ pressed }) => [styles.seat, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        consentObtained
                          ? `${rowDone ? 'Start again' : 'Start'} ${p.name}`
                          : 'Record consent for this session first'
                      }
                      accessibilityState={{ disabled: busy || !!active || !consentObtained }}
                    >
                      <Text
                        style={[
                          styles.seatText,
                          { color: consentObtained && !active ? palette.primary : SLATE[400] },
                        ]}
                      >
                        {rowDone ? 'Start again' : 'Start'}
                      </Text>
                    </Pressable>
                  )}

                  {!rowDone && !stranded ? (
                    <Pressable
                      onPress={async () => {
                        try {
                          await skipParticipant(f2f, session.sessionUuid, p.id);
                          await revalidate();
                        } catch (e) {
                          setError(e?.message || 'Could not skip that student.');
                        }
                      }}
                      hitSlop={6}
                      style={({ pressed }) => [styles.seat, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Skip ${p.name}`}
                    >
                      <Text style={styles.skipText}>Skip</Text>
                    </Pressable>
                  ) : null}

                  {/* Only a student who has never been recorded. Anything past WAITING owns a turn
                      row, and removing them would orphan it. */}
                  {p.turnStatus === 'WAITING' ? (
                    <Pressable
                      onPress={() => dropParticipant(p)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.seat, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${p.name}`}
                    >
                      <Text style={styles.skipText}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}

          <Pressable
            onPress={() => setAddOpen(true)}
            style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Add a student who is not on the list"
          >
            <Ionicons name="person-add-outline" size={18} color={palette.primary} />
            <Text style={[styles.addText, { color: palette.primary }]}>
              Add a student not on the list
            </Text>
          </Pressable>
        </Card>
      ) : null}

      {/* The chair. Everything below belongs to ONE student. */}
      {active ? (
        <Card>
          <Text style={styles.blockTitle}>
            {active.studentName}
            {active.grade ? ` · ${active.grade}` : ''}
          </Text>

          <RecorderBar
            recorder={recorder}
            sttAvailable={sttAvailable}
            consentObtained={consentObtained}
            onStart={() => recorder.start({ turnId: active.turnId, micToken: active.micToken })}
            onStop={recorder.stop}
            disabled={!active.turnId || !active.micToken || turnFinished}
            disabledReason={
              turnFinished
                ? 'This turn has ended.'
                : 'The microphone was not granted for this student — type your notes instead.'
            }
          />

          <TextField
            label="Your notes during the conversation"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Anything the recording will not capture. The AI reads this alongside the transcript."
          />

          <View style={styles.actions}>
            <Pressable
              onPress={() => setReportOpen(true)}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Open report</Text>
            </Pressable>

            {!turnFinished ? (
              <Pressable
                onPress={endTurn}
                disabled={generating}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: palette.primary },
                  generating && styles.btnDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>{generating ? 'Finishing…' : 'Finish turn'}</Text>
              </Pressable>
            ) : (
              // `queue` already excludes whoever is seated, so its head IS the next child.
              <Pressable
                onPress={() => publishAndClear(queue[0])}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: palette.primary },
                  busy && styles.btnDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>Publish &amp; next</Text>
              </Pressable>
            )}
          </View>
        </Card>
      ) : null}

      {/* The eleven sections. A modal rather than inline: on a phone the queue, consent bar,
          recorder and notes already fill the screen, and an eleven-section form underneath them
          would bury the controls the counsellor needs while talking. */}
      <ReportFormSheet
        visible={reportOpen && !!active}
        title={active?.studentName || 'Report'}
        subtitle={active?.grade || undefined}
        submitLabel="Save"
        form={form}
        onPatch={(key, value) => setForm((f) => ({ ...f, [key]: value }))}
        onClose={() => setReportOpen(false)}
        onSubmit={async () => {
          try {
            await persist();
            setReportOpen(false);
          } catch (e) {
            setError(e?.message || 'Could not save the report.');
          }
        }}
        sections={REPORT_SECTIONS}
        // Griffin is locked until the turn ends, because until then there is no transcript and
        // anything typed there would be overwritten by the draft.
        disabledKeys={turnFinished ? [] : [GRIFFIN_SECTION_KEY]}
      />

      {turnFinished ? (
        <Card>
          <Text style={styles.blockTitle}>Redraft</Text>
          {missingSignals.length ? (
            <Text style={styles.rowMeta}>
              {`The model never heard: ${missingSignals.join(', ')}. This is the moment to ask.`}
            </Text>
          ) : null}
          <TextField
            label="Nudge the AI"
            value={steer}
            onChangeText={setSteer}
            placeholder="e.g. say more about the maths anxiety"
          />
          <Pressable
            onPress={regenerate}
            disabled={generating}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>{generating ? 'Redrafting…' : 'Redraft'}</Text>
          </Pressable>
        </Card>
      ) : null}

      <AddStudentSheet visible={addOpen} onClose={() => setAddOpen(false)} onAdd={addWalkIn} busy={busy} />
    </View>
  );
}

/** Name and grade, both required — the server needs a display name to file the turn under. */
function AddStudentSheet({ visible, onClose, onAdd, busy }) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');

  useEffect(() => {
    if (!visible) {
      setName('');
      setGrade('');
    }
  }, [visible]);

  return (
    <FormSheet
      visible={visible}
      title="Add a student"
      onClose={onClose}
      onSubmit={name.trim() && grade.trim() ? () => onAdd({ displayName: name.trim(), gradeLabel: grade.trim() }) : undefined}
      submitting={busy}
      submitLabel="Add and seat"
    >
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Full name" />
      <TextField label="Grade" value={grade} onChangeText={setGrade} placeholder="e.g. 9 A" />
    </FormSheet>
  );
}

/**
 * The chip colour for a turn status.
 *
 * The terminal values are `DRAFTED` and `COMPLETED` — there is no `DONE`. Keying off one leaves
 * every finished student showing a grey "waiting" chip, which is the same wrong-but-plausible
 * screen the `DONE` filter produced in the queue.
 */
function toneFor(status) {
  if (status === 'DRAFTED' || status === 'COMPLETED') return 'success';
  if (status === 'FAILED') return 'error';
  if (
    status === 'MIC_GRANTED' ||
    status === 'RECORDING' ||
    status === 'ENDED' ||
    status === 'TRANSCRIBING'
  ) {
    return 'warning';
  }
  return 'neutral';
}

const useStyles = makeStyles((p) => ({
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
    color: FEEDBACK.warningOnBg,
    backgroundColor: FEEDBACK.warningBg,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  sessionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sessionTitle: { flex: 1, fontSize: TYPE.title, fontWeight: '800', color: SLATE[900] },
  endBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[300],
  },
  endBtnText: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[600] },

  consent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    marginTop: SPACING.sm,
  },
  consentText: { flex: 1, fontSize: TYPE.body, color: SLATE[700] },
  queueMeta: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 4 },

  blockTitle: { fontSize: TYPE.title, fontWeight: '800', color: SLATE[900], marginBottom: SPACING.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  rowMeta: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 1 },
  seat: { paddingHorizontal: 8, paddingVertical: 6 },
  seatText: { fontSize: TYPE.label, fontWeight: '700' },
  skipText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[500] },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: TOUCH.min,
    marginTop: SPACING.sm,
  },
  addText: { fontSize: TYPE.label, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  primary: {
    flex: 1,
    minHeight: TOUCH.min,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  secondary: {
    flex: 1,
    minHeight: TOUCH.min,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[700] },
  btnDisabled: { opacity: 0.5 },

  pressed: { opacity: 0.8 },
}));
