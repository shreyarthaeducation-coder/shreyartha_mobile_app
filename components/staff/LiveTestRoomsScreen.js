import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { Card, CardTitle, EmptyState, ScreenScaffold, Select, useToast } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { downloadAndShare } from '../../utils/downloadFile';
import PsychometricReport from '../student/psychometric/PsychometricReport';
import { getTopicType, processAssessmentResults } from '../../constants/psychometricScoring';
import {
  LIVE_TEST_LEVELS,
  LIVE_TEST_TYPES,
  MAX_PAPERS,
  cascadeFor,
  clock,
  createLiveTestRoom,
  enrolParticipant,
  extendLiveTest,
  fetchSchoolLiveTestParticipant,
  fetchSchoolLiveTestRoom,
  fetchSchoolLiveTestRooms,
  schoolLiveTestCsvEndpoint,
  fetchAcademicTree,
  fetchLiveTestClasses,
  fetchLiveTestMatches,
  fetchLiveTestParticipant,
  fetchLiveTestRoom,
  fetchLiveTestRooms,
  fetchMockPapers,
  fetchPsychometricTests,
  joinLabel,
  liveTestCsvEndpoint,
  liveTestCsvName,
  mergeLiveTestResults,
  previewLiveTest,
  psychometricInput,
  psychometricTests,
  resultLine,
  resultsAsText,
  roomEntryAddress,
  roomLink,
  roomPayload,
  setParticipantMatch,
  setParticipantRemoved,
  setRoomLocked,
  startLiveTest,
  stopLiveTest,
} from '../../services/teacher/liveTestService';
import StudentSearchBar from './shared/StudentSearchBar';
import { useStudentSearch } from '../../utils/studentSearch';

const POLL_MS = 3000;
const STATUS = { LOBBY: 'Waiting to start', RUNNING: 'Running now', ENDED: 'Ended' };

/**
 * Live Test Rooms — host a test for a whole class with no student logins.
 *
 * Mirrors frontendmain/src/School/Teacher/pages/LiveTests/. The teacher picks the class and the
 * test, shares one link, and the test starts on every student's screen when they press Start.
 *
 * THE APP IS THE TEACHER'S SIDE ONLY. Students join in a web browser — a lab computer, a tablet —
 * because the reason this exists is that they have no phone in class and no login they remember.
 * There is no student screen for this in the app and there should not be one.
 *
 * Three views in one screen, because a phone has no room for the web's side-by-side layout:
 *   list   → the teacher's rooms, and "New room"
 *   create → class, section, kind of test, the test, time limit
 *   room   → share the link · who has joined · Start / Stop · results · merge into profiles
 *
 * Everything the website's room does is here, in a phone's shape: the results file is handed to the
 * share sheet rather than downloaded, and a psychometric report opens with the app's own report
 * renderer (the one the student panel uses) rather than the website's six wide-page components.
 */
export default function LiveTestRoomsScreen({ homeRoute, oversight = false }) {
  const [view, setView] = useState({ name: 'list' });
  const { toast, showToast } = useToast();

  if (view.name === 'create') {
    return (
      <CreateRoom
        homeRoute={homeRoute}
        toast={toast}
        onCancel={() => setView({ name: 'list' })}
        onCreated={(room) => {
          showToast('Room opened. Share the link with your class.', 'success');
          setView({ name: 'room', roomId: room.id });
        }}
      />
    );
  }
  if (view.name === 'room') {
    return (
      <Room
        roomId={view.roomId}
        readOnly={!!view.readOnly}
        homeRoute={homeRoute}
        toast={toast}
        showToast={showToast}
        onBack={() => setView({ name: 'list', school: !!view.readOnly })}
      />
    );
  }
  return (
    <RoomList
      homeRoute={homeRoute}
      toast={toast}
      oversight={oversight}
      initialSchool={!!view.school}
      onCreate={() => setView({ name: 'create' })}
      onOpen={(room) => setView({ name: 'room', roomId: room.id })}
      onFollow={(room) => setView({ name: 'room', roomId: room.id, readOnly: true })}
    />
  );
}

// ─── List ────────────────────────────────────────────────────────────────────

/**
 * @param oversight principal / vice principal: a second tab with every room of the school, opened
 *                  read-only (only the host runs a room).
 */
function RoomList({ homeRoute, toast, oversight, initialSchool, onCreate, onOpen, onFollow }) {
  const styles = useStyles();
  const palette = usePalette();
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [school, setSchool] = useState(oversight && initialSchool);

  const load = useCallback((signal) => {
    setRooms(null);
    return (school ? fetchSchoolLiveTestRooms(signal) : fetchLiveTestRooms(signal))
      .then((r) => {
        setRooms(Array.isArray(r) ? r : []);
        setError('');
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setError(e?.message || 'Could not load the rooms.');
      });
  }, [school]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <ScreenScaffold
      title="Live Test Rooms"
      fallbackRoute={homeRoute}
      loading={rooms == null && !error}
      error={rooms == null ? error : ''}
      onRetry={() => load()}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load().finally(() => setRefreshing(false));
      }}
      toast={toast}
    >
      <Text style={styles.intro}>
        Run a test for a whole class together. Students open one link in a browser and sign in — or type their
        name, class and roll number if they cannot — and the test starts for everyone when you press Start.
      </Text>
      {oversight ? (
        <View style={styles.tabs} accessibilityRole="tablist">
          {[
            [false, 'My rooms'],
            [true, 'All rooms in school'],
          ].map(([value, label]) => (
            <Pressable
              key={label}
              onPress={() => setSchool(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: school === value }}
              style={[styles.tab, school === value && { borderBottomColor: palette.primaryDark }]}
            >
              <Text style={[styles.tabText, school === value && { color: palette.primaryDark }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {school ? null : <Button label="New room" icon="add" onPress={onCreate} color={palette.primaryDark} />}

      {(rooms || []).length === 0 ? (
        <EmptyState
          icon="easel-outline"
          title="No rooms yet"
          message={school ? 'No rooms have been opened in your school yet.' : 'Open a room to host your first test.'}
        />
      ) : (
        (rooms || []).map((room) => (
          <Pressable
            key={room.id}
            onPress={() => (school && !room.mine ? onFollow(room) : onOpen(room))}
            accessibilityRole="button"
            accessibilityLabel={`${room.title}, ${room.classLabel}, ${STATUS[room.status] || room.status}`}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Card style={styles.roomCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.roomTitle}>{room.title}</Text>
                <StatusPill status={room.status} />
              </View>
              <Text style={styles.muted}>
                {room.classLabel} · {room.testTypeLabel} · {room.participantCount ?? 0} students
              </Text>
              {school ? <Text style={styles.muted}>Hosted by {room.mine ? 'you' : room.teacherName}</Text> : null}
            </Card>
          </Pressable>
        ))
      )}
    </ScreenScaffold>
  );
}

// ─── Create ──────────────────────────────────────────────────────────────────

function CreateRoom({ homeRoute, toast, onCancel, onCreated }) {
  const styles = useStyles();
  const palette = usePalette();
  const [classes, setClasses] = useState(null);
  const [classId, setClassId] = useState(null);
  const [sectionId, setSectionId] = useState(null);
  const [testType, setTestType] = useState('MOCK');
  const [tree, setTree] = useState(null);
  const [path, setPath] = useState([]);
  const [sourceId, setSourceId] = useState(null);
  const [level, setLevel] = useState('BASIC');
  const [minutes, setMinutes] = useState('');
  const [lateEntry, setLateEntry] = useState(false);
  // The papers of the session, in the order they will be sat. Empty = just the one being picked.
  const [papers, setPapers] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetchLiveTestClasses(controller.signal)
      .then((c) => setClasses(Array.isArray(c) ? c : []))
      .catch((e) => e?.name !== 'AbortError' && setError(e?.message || 'Could not load your classes.'));
    return () => controller.abort();
  }, []);

  // The list to choose the test from depends on the kind of test.
  useEffect(() => {
    const controller = new AbortController();
    setTree(null);
    setPath([]);
    setSourceId(null);
    setMinutes('');
    // A session is one kind of test: changing the kind starts the list again.
    setPapers([]);
    const loader = testType === 'MOCK' ? fetchMockPapers : testType === 'PSYCHOMETRIC' ? fetchPsychometricTests : fetchAcademicTree;
    loader(controller.signal)
      .then((t) => setTree(Array.isArray(t) ? t : []))
      .catch((e) => e?.name !== 'AbortError' && setError(e?.message || 'Could not load the list of tests.'));
    return () => controller.abort();
  }, [testType]);

  useEffect(() => {
    setPreview(null);
    if (!sourceId) return undefined;
    const controller = new AbortController();
    previewLiveTest({ testType, sourceId, level: testType === 'PRACTICE' ? level : '', sectionId }, controller.signal)
      .then((p) => {
        setPreview(p);
        if (p?.suggestedMinutes) setMinutes(String(p.suggestedMinutes));
      })
      .catch((e) => e?.name !== 'AbortError' && setPreview({ error: e?.message || 'Could not check this test.' }));
    return () => controller.abort();
  }, [testType, sourceId, level, sectionId]);

  const sections = useMemo(
    () => (classes || []).find((c) => c.classId === classId)?.sections || [],
    [classes, classId],
  );

  // Each dropdown of the chain shows the children of the one chosen above it.
  const levels = cascadeFor(testType);
  const pickers = [];
  let options = tree || [];
  levels.forEach(({ label, children }, depth) => {
    const last = depth === levels.length - 1;
    const current = options;
    pickers.push(
      <Select
        key={`${testType}-${label}`}
        label={label}
        value={last ? sourceId : path[depth] ?? null}
        options={current.map((o) => ({
          value: o.id,
          label: o.questionCount != null ? `${o.name} (${o.questionCount} questions)` : o.name,
        }))}
        placeholder={tree == null ? 'Loading…' : current.length === 0 ? '—' : `Choose ${label.toLowerCase()}`}
        disabled={tree == null || current.length === 0}
        searchable={current.length > 8}
        onChange={(value) => {
          if (last) {
            setSourceId(value);
          } else {
            setPath([...path.slice(0, depth), value]);
            setSourceId(null);
          }
        }}
        style={styles.field}
      />,
    );
    if (!last) options = current.find((o) => o.id === path[depth])?.[children] || [];
  });

  const pickLevel = testType === 'PRACTICE' ? level : null;
  const pickIsListed = papers.some((p) => p.sourceId === sourceId && p.level === pickLevel);
  const canAdd = !!sourceId && !!preview && !preview.error && preview.questionCount > 0 && !pickIsListed;

  /** Puts the paper being picked onto the session's list, and clears the picker for the next one. */
  const addPaper = () => {
    if (!canAdd) return;
    if (papers.length >= MAX_PAPERS) {
      setError(`A session can run at most ${MAX_PAPERS} papers.`);
      return;
    }
    setError('');
    setPapers([...papers, { sourceId, level: pickLevel, title: preview.title, questionCount: preview.questionCount }]);
    setSourceId(null);
  };

  const submit = async () => {
    if (!sectionId) return setError('Choose the class and section.');
    // What is on the list, plus a paper picked but not yet added — so one paper needs no extra tap.
    const chosen = canAdd ? [...papers, { sourceId, level: pickLevel }] : papers;
    if (chosen.length === 0) {
      if (preview && preview.questionCount === 0) return setError('That test has no questions yet.');
      return setError('Choose the test.');
    }
    const limit = minutes.trim() === '' ? null : Number(minutes);
    if (limit != null && (!Number.isFinite(limit) || limit < 1 || limit > 300)) {
      return setError('The time limit must be between 1 and 300 minutes.');
    }
    setBusy(true);
    setError('');
    try {
      onCreated(
        await createLiveTestRoom(roomPayload({ sectionId, testType, papers: chosen, durationMinutes: limit, lateEntry })),
      );
    } catch (e) {
      setError(e?.message || 'The room could not be opened.');
      setBusy(false);
    }
    return undefined;
  };

  return (
    <ScreenScaffold title="New room" fallbackRoute={homeRoute} loading={classes == null && !error} toast={toast}>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Card>
        <Select
          label="Class"
          value={classId}
          options={(classes || []).map((c) => ({ value: c.classId, label: c.className }))}
          placeholder={(classes || []).length === 0 ? 'No classes assigned this year' : 'Choose a class'}
          onChange={(value) => {
            setClassId(value);
            setSectionId(null);
          }}
          style={styles.field}
        />
        <Select
          label="Section"
          value={sectionId}
          options={sections.map((s) => ({ value: s.sectionId, label: s.sectionName }))}
          placeholder="Choose a section"
          disabled={!classId}
          onChange={setSectionId}
          style={styles.field}
        />
        <Select label="Kind of test" value={testType} options={LIVE_TEST_TYPES} onChange={setTestType} style={styles.field} />
        {pickers}
        {testType === 'PRACTICE' ? (
          <Select label="Level" value={level} options={LIVE_TEST_LEVELS} onChange={setLevel} style={styles.field} />
        ) : null}

        {testType !== 'ADAPTIVE' ? (
          <>
            <Button label="Add this to the session" icon="add" secondary onPress={addPaper} disabled={!canAdd} />
            <Text style={styles.hint}>
              Add several {testType === 'PSYCHOMETRIC' ? 'tests' : 'papers'} to run them back to back in one sitting, with one
              combined report.
            </Text>
            {papers.map((p, index) => (
              <View key={`${p.sourceId}-${p.level}`} style={styles.paperRow}>
                <Text style={styles.paperText}>
                  {index + 1}. {p.title} · {p.questionCount} questions
                </Text>
                <Pressable
                  onPress={() => setPapers(papers.filter((_, i) => i !== index))}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${p.title}`}
                  hitSlop={10}
                >
                  <Text style={[styles.rowAction, { color: FEEDBACK.errorText }]}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.label}>Time limit (minutes)</Text>
        <TextInput
          value={minutes}
          onChangeText={(text) => setMinutes(text.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="No limit"
          placeholderTextColor={SLATE[400]}
          maxLength={3}
          style={styles.input}
          accessibilityLabel="Time limit in minutes"
        />
        <Text style={styles.hint}>
          {testType === 'PSYCHOMETRIC'
            ? 'Usually left blank — it is not a speed test. You end it when the class is done.'
            : testType === 'ADAPTIVE'
              ? 'Each student gets their own questions, easier or harder as they answer, until the questions run out, the time is up, or you stop the test.'
              : 'Leave blank for no limit; you can stop the test yourself at any time.'}
        </Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Let students join after the test has started</Text>
          <Switch
            value={lateEntry}
            onValueChange={setLateEntry}
            trackColor={{ true: palette.primary }}
            accessibilityLabel="Let students join after the test has started"
          />
        </View>

        {preview ? (
          <Text style={[styles.preview, (preview.error || preview.questionCount === 0) && styles.previewBad]}>
            {preview.error
              ? preview.error
              : preview.questionCount === 0
                ? 'This test has no questions yet, so a room cannot be opened for it.'
                : `${preview.title} — ${preview.questionCount} questions` +
                  (preview.questionSource === 'TEACHER'
                    ? ', from your own adaptive question set for this section.'
                    : preview.questionSource === 'COMPANY'
                      ? ', from the company question bank.'
                      : '.')}
          </Text>
        ) : null}
      </Card>

      <Button label="Open the room" icon="checkmark" onPress={submit} busy={busy} color={palette.primaryDark} />
      <Button label="Cancel" onPress={onCancel} disabled={busy} secondary />
    </ScreenScaffold>
  );
}

// ─── One room ────────────────────────────────────────────────────────────────

/** @param readOnly a room of the school followed by the principal or vice principal: no controls. */
function Room({ roomId, readOnly = false, homeRoute, toast, showToast, onBack }) {
  const styles = useStyles();
  const palette = usePalette();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [report, setReport] = useState(null);
  const deadline = useRef(null);
  const studentSearch = useStudentSearch(room?.participants);

  /** A psychometric child's report, built on the phone from the answers the room saved. */
  const openReport = async (participant) => {
    setBusy(`report-${participant.id}`);
    try {
      const detail = await (readOnly
        ? fetchSchoolLiveTestParticipant(roomId, participant.id)
        : fetchLiveTestParticipant(roomId, participant.id));
      const student = { name: participant.name, class: participant.className };
      if (room.graded === false) {
        // One report for the session: a body per test the child answered, each scored on its own.
        const tests = psychometricTests(detail?.parts, detail?.answers, room.title).map((test) => {
          const { questions, answers } = psychometricInput(test.rows);
          return { ...test, results: processAssessmentResults(questions, answers, test.title) };
        });
        setReport({ student, tests });
      } else {
        setReport({ student, marked: detail });
      }
    } catch (e) {
      showToast(e?.message || 'Could not open this report.', 'error');
    } finally {
      setBusy('');
    }
  };

  const shareFile = async () => {
    setBusy('csv');
    try {
      await downloadAndShare(
        readOnly ? schoolLiveTestCsvEndpoint(roomId) : liveTestCsvEndpoint(roomId),
        liveTestCsvName(room),
        'text/csv',
      );
    } catch (e) {
      showToast(e?.message || 'The results file could not be prepared.', 'error');
    } finally {
      setBusy('');
    }
  };

  const apply = useCallback((next) => {
    setRoom((current) => ({ ...(current || {}), ...next }));
    deadline.current = next.secondsLeft != null ? Date.now() + next.secondsLeft * 1000 : null;
    if (next.secondsLeft == null) setSecondsLeft(null);
  }, []);

  const load = useCallback(
    (signal) =>
      (readOnly ? fetchSchoolLiveTestRoom(roomId, signal) : fetchLiveTestRoom(roomId, signal))
        .then((r) => {
          apply(r);
          setError('');
        })
        .catch((e) => {
          if (e?.name !== 'AbortError') setError(e?.message || 'Could not load this room.');
        }),
    [roomId, apply, readOnly],
  );

  // Poll while the room is open; once it has ended nothing changes by itself.
  const ended = room?.status === 'ENDED';
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    if (ended) return () => controller.abort();
    const timer = setInterval(() => load(), POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load, ended]);

  // The countdown is the server's "this many seconds left", ticked down here between polls.
  useEffect(() => {
    const timer = setInterval(() => {
      if (deadline.current != null) setSecondsLeft(Math.max(0, Math.round((deadline.current - Date.now()) / 1000)));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const run = async (label, action, done) => {
    setBusy(label);
    try {
      const result = await action();
      if (result && result.status) apply(result);
      if (done) showToast(done, 'success');
      load();
    } catch (e) {
      showToast(e?.message || 'That did not work. Please try again.', 'error');
    } finally {
      setBusy('');
    }
  };

  if (!room) {
    return <ScreenScaffold title="Room" fallbackRoute={homeRoute} loading={!error} error={error} onRetry={() => load()} toast={toast} />;
  }

  if (report) {
    return (
      <ScreenScaffold title={report.student.name} fallbackRoute={homeRoute} toast={toast}>
        <Pressable onPress={() => setReport(null)} accessibilityRole="button" style={styles.back}>
          <Ionicons name="chevron-back" size={18} color={palette.primaryDark} />
          <Text style={[styles.backText, { color: palette.primaryDark }]}>Back to the results</Text>
        </Pressable>
        {report.tests
          ? report.tests.map((test) => (
              <View key={test.partNo}>
                {report.tests.length > 1 ? <Text style={styles.section}>{test.title}</Text> : null}
                <PsychometricReport
                  results={test.results}
                  topicType={getTopicType(test.title)}
                  topicName={test.title}
                  studentInfo={report.student}
                />
              </View>
            ))
          : null}
        {report.tests && report.tests.length === 0 ? (
          <EmptyState icon="document-outline" title="Nothing to report" message="No questions were answered." />
        ) : null}
        {report.marked ? <MarkedReport room={room} detail={report.marked} /> : null}
      </ScreenScaffold>
    );
  }

  const everyone = room.participants || [];
  const present = everyone.filter((p) => !p.removed);
  const lobby = room.status === 'LOBBY';
  const running = room.status === 'RUNNING';
  const submittedCount = present.filter((p) => p.finished).length;

  const confirmStart = () =>
    Alert.alert('Start the test?', `It begins on all ${present.length} student screens at once.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start the test', onPress: () => run('start', () => startLiveTest(roomId), 'The test has started.') },
    ]);

  const confirmStop = () =>
    Alert.alert('Stop the test now?', 'It ends for everyone. Answers saved so far are collected and marked.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop the test', style: 'destructive', onPress: () => run('stop', () => stopLiveTest(roomId), 'The test has ended.') },
    ]);

  return (
    <ScreenScaffold title={room.title} fallbackRoute={homeRoute} toast={toast}>
      <Pressable onPress={onBack} accessibilityRole="button" style={styles.back}>
        <Ionicons name="chevron-back" size={18} color={palette.primaryDark} />
        <Text style={[styles.backText, { color: palette.primaryDark }]}>All rooms</Text>
      </Pressable>

      <View style={styles.rowBetween}>
        <Text style={styles.muted}>
          {room.classLabel} · {room.testTypeLabel}
          {room.partCount > 1 ? ` · ${room.partCount} papers` : ''} · {room.questionCount} questions{room.adaptive ? ' in the pool' : ''}
        </Text>
        <StatusPill status={room.status} />
      </View>

      {readOnly ? (
        <Card>
          <Text style={styles.body}>
            Hosted by <Text style={styles.strong}>{room.teacherName || 'another member of staff'}</Text>. You can follow
            it and see the results; only the host can start, stop or merge it.
          </Text>
        </Card>
      ) : null}

      {running ? (
        <View style={[styles.clock, secondsLeft != null && secondsLeft <= 60 && styles.clockLow]}>
          <Text style={styles.clockText}>{secondsLeft == null ? 'No time limit' : `${clock(secondsLeft)} left`}</Text>
        </View>
      ) : null}

      {!ended ? (
        <Card>
          <CardTitle>Students open this link in a browser</CardTitle>
          <Text selectable style={[styles.link, { color: palette.primaryDark }]}>
            {roomLink(room.code)}
          </Text>
          <Text style={styles.hint}>
            Or they go to {roomEntryAddress()} and type the code <Text style={styles.code}>{room.code}</Text>
          </Text>
          <Button
            label="Share the link"
            icon="share-outline"
            secondary
            onPress={() =>
              Share.share({ message: `Join the test "${room.title}": ${roomLink(room.code)}  (room code ${room.code})` }).catch(() => {})
            }
          />
        </Card>
      ) : null}

      {!ended && !readOnly ? (
        <Card>
          <Text style={styles.body}>
            <Text style={styles.strong}>{present.length}</Text> {present.length === 1 ? 'student has' : 'students have'} joined
            {running ? ` · ${submittedCount} submitted` : ''}
          </Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Lock the room (nobody else can join)</Text>
            <Switch
              value={!!room.locked}
              disabled={!!busy}
              onValueChange={(value) => run('lock', () => setRoomLocked(roomId, value))}
              trackColor={{ true: palette.primary }}
              accessibilityLabel="Lock the room"
            />
          </View>
          {lobby ? (
            <>
              <Button
                label="Start the test"
                icon="play"
                onPress={confirmStart}
                busy={busy === 'start'}
                disabled={!!busy || present.length === 0}
                color={palette.primaryDark}
              />
              {present.length === 0 ? <Text style={styles.hint}>Start becomes available once a student has joined.</Text> : null}
            </>
          ) : null}
          {running ? (
            <>
              <Button label="+ 5 minutes" onPress={() => run('extend', () => extendLiveTest(roomId, 5), '5 minutes added.')} disabled={!!busy} secondary />
              <Button label="Stop the test" icon="stop" onPress={confirmStop} busy={busy === 'stop'} disabled={!!busy} color={FEEDBACK.errorText} />
            </>
          ) : null}
        </Card>
      ) : null}

      <Text style={styles.section}>{ended ? 'Results' : lobby ? 'Who has joined' : 'Progress'}</Text>
      {everyone.length > 0 ? <StudentSearchBar search={studentSearch} /> : null}
      {everyone.length === 0 ? (
        <EmptyState icon="people-outline" title="Nobody has joined yet" message="Share the link above with your class." />
      ) : (
        studentSearch.results.map((p, index) => (
          <Card key={p.id} style={[styles.person, p.removed && styles.personRemoved]}>
            <View style={styles.rowBetween}>
              <Text style={styles.personName}>
                {index + 1}. {p.name}
              </Text>
              {!p.merged && !readOnly ? (
                <Pressable
                  onPress={() => run('remove', () => setParticipantRemoved(roomId, p.id, !p.removed))}
                  disabled={!!busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.removed ? 'Put back' : 'Remove'} ${p.name}`}
                  hitSlop={10}
                >
                  <Text style={[styles.rowAction, { color: p.removed ? palette.primaryDark : FEEDBACK.errorText }]}>
                    {p.removed ? 'Put back' : 'Remove'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.muted}>
              {[p.className, p.rollNumber && `Roll ${p.rollNumber}`].filter(Boolean).join(' · ')}
            </Text>
            <Text style={styles.body}>
              {ended
                ? resultLine(room, p)
                : p.removed
                  ? 'Removed'
                  : lobby
                    ? 'Waiting'
                    : `${p.finished ? 'Submitted' : 'Writing'} · answered ${p.answeredCount}${room.adaptive ? '' : ` of ${room.questionCount}`}`}
            </Text>
            <View style={styles.badges}>
              <View style={[styles.badge, p.signedIn ? (p.inClass === false ? styles.badgeOther : styles.badgeIn) : styles.badgeGuest]}>
                <Text style={styles.badgeText}>{joinLabel(p)}</Text>
              </View>
              {p.savedToProfile ? (
                <View style={[styles.badge, styles.badgeSaved]}>
                  <Text style={styles.badgeText}>Saved to profile</Text>
                </View>
              ) : null}
            </View>
            {p.autoSaveError ? <Text style={styles.hint}>Not saved yet: {p.autoSaveError}</Text> : null}
            {ended && !p.removed && p.answeredCount > 0 ? (
              <Button
                label="View report"
                icon="stats-chart-outline"
                secondary
                busy={busy === `report-${p.id}`}
                disabled={!!busy}
                onPress={() => openReport(p)}
              />
            ) : null}
          </Card>
        ))
      )}

      {ended && present.length > 0 ? (
        <>
          <Button
            label="Share results file (Excel / CSV)"
            icon="document-text-outline"
            secondary
            busy={busy === 'csv'}
            disabled={!!busy}
            onPress={shareFile}
          />
          <Button
            label="Share results as a message"
            icon="share-outline"
            secondary
            disabled={!!busy}
            onPress={() => Share.share({ message: resultsAsText(room) }).catch(() => {})}
          />
        </>
      ) : null}

      {ended && !readOnly ? (
        <MergePanel roomId={roomId} graded={room.graded !== false} showToast={showToast} onMerged={() => load()} />
      ) : null}
    </ScreenScaffold>
  );
}

// ─── Merge into profiles ─────────────────────────────────────────────────────

/**
 * The whole class is not checked child by child. When the room ended every child was matched
 * against the section's roster; "Merge all" moves everyone whose roll number AND name both matched.
 * Only what the server could not be sure of is listed for the teacher to settle.
 */
function MergePanel({ roomId, graded, showToast, onMerged }) {
  const styles = useStyles();
  const palette = usePalette();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  // "Add to class list": which row's form is open, what is typed, and the account just made.
  const [enrolling, setEnrolling] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', mobile: '', rollNumber: '' });
  const [created, setCreated] = useState(null);

  const openEnrol = (row) => {
    setCreated(null);
    setEnrolling(row.id);
    setForm({ name: row.name || '', email: row.email || '', mobile: row.phone || '', rollNumber: row.rollNumber || '' });
  };

  /** Creates the student with a login in this class and section, and ties this result to them. */
  const enrol = async () => {
    if (!form.email.trim()) {
      showToast("Enter the student's email address. It is what they will sign in with.", 'error');
      return;
    }
    setBusy(true);
    try {
      const result = await enrolParticipant(roomId, enrolling, form);
      setData(result);
      setCreated(result.created);
      setEnrolling(null);
    } catch (e) {
      showToast(e?.message || 'The student could not be added.', 'error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchLiveTestMatches(roomId, controller.signal)
      .then(setData)
      .catch((e) => e?.name !== 'AbortError' && setError(e?.message || 'Could not load the matches.'));
    return () => controller.abort();
  }, [roomId]);

  const merge = (options, title, message) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Merge',
        onPress: async () => {
          setBusy(true);
          try {
            const result = await mergeLiveTestResults(roomId, { ...options, replaceExisting });
            setData(result);
            const left = (result.skipped || []).length;
            showToast(`${result.merged} result${result.merged === 1 ? '' : 's'} merged.${left ? ` ${left} left to look at.` : ''}`, 'success');
            onMerged?.();
          } catch (e) {
            showToast(e?.message || 'The results could not be merged.', 'error');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  const choose = async (participantId, studentId) => {
    try {
      setData(await setParticipantMatch(roomId, participantId, studentId));
    } catch (e) {
      showToast(e?.message || 'Could not set that student.', 'error');
    }
  };

  if (!data) {
    return (
      <Card>
        <CardTitle>Add results to student profiles</CardTitle>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={palette.primary} />}
      </Card>
    );
  }

  // A student who signed in is saved by the system, not merged here — unless that save failed.
  const rows = (data.participants || []).filter((r) => !(r.signedIn && r.merged));
  const savedBySignIn = (data.participants || []).filter((r) => r.signedIn && r.merged).length;
  const ready = rows.filter((r) => r.ready);
  const merged = rows.filter((r) => r.merged);
  const attention = rows.filter((r) => !r.merged && !r.ready);
  const rosterOptions = [
    { value: null, label: 'Not in my class list — leave unmerged' },
    ...(data.roster || []).map((s) => ({ value: s.studentId, label: `${s.rollNumber ? `${s.rollNumber} · ` : ''}${s.name}` })),
  ];

  return (
    <Card>
      <CardTitle>Add results to student profiles</CardTitle>
      <Text style={styles.hint}>
        Students who signed in are already saved to their profiles. Everyone else was matched to your class list by roll
        number and name; merging copies the result onto the student's profile and tells them. It cannot be undone from here.
      </Text>
      {savedBySignIn > 0 ? (
        <Text style={styles.preview}>
          {savedBySignIn} student{savedBySignIn === 1 ? '' : 's'} signed in and {savedBySignIn === 1 ? 'is' : 'are'} already saved.
        </Text>
      ) : null}
      {created ? (
        <View style={styles.createdBox}>
          <Text style={styles.body}>
            <Text style={styles.strong}>{created.name}</Text> is now on your class list and can sign in with{' '}
            <Text style={styles.strong}>{created.email}</Text> and this password:
          </Text>
          <Text selectable style={styles.password}>{created.password}</Text>
          <Text style={styles.hint}>Write it down now — it is not shown again.</Text>
        </View>
      ) : null}
      <Text style={styles.body}>
        <Text style={styles.strong}>{ready.length}</Text> ready · <Text style={styles.strong}>{attention.length}</Text> need a look ·{' '}
        <Text style={styles.strong}>{merged.length}</Text> merged
      </Text>

      {!graded && ready.some((r) => r.replacesExistingReport) ? (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Replace the report a student already has for this test</Text>
          <Switch value={replaceExisting} onValueChange={setReplaceExisting} trackColor={{ true: palette.primary }} />
        </View>
      ) : null}

      <Button
        label={`Merge all ${ready.length} ready`}
        icon="git-merge-outline"
        onPress={() => merge({}, 'Merge the results?', `${ready.length} result(s) will be added to the students' profiles.`)}
        busy={busy}
        disabled={busy || ready.length === 0}
        color={palette.primaryDark}
      />

      {attention.length > 0 ? <Text style={styles.section}>Needs a look</Text> : null}
      {attention.map((r) => (
        <View key={r.id} style={styles.attention}>
          <Text style={styles.personName}>{r.name}</Text>
          <Text style={styles.muted}>{[r.className, r.rollNumber && `Roll ${r.rollNumber}`].filter(Boolean).join(' · ')}</Text>
          <Text style={styles.hint}>{r.attention || 'Only the roll number or the name matched — please confirm who this is.'}</Text>
          <Select
            label="Which student is this?"
            value={r.matchedStudentId ?? null}
            options={rosterOptions}
            searchable
            onChange={(value) => choose(r.id, value)}
            style={styles.field}
          />
          {!r.matchedStudentId && !r.signedIn && enrolling !== r.id ? (
            <Button label="Add to class list" icon="person-add-outline" secondary disabled={busy} onPress={() => openEnrol(r)} />
          ) : null}
          {enrolling === r.id ? (
            <View style={styles.enrol}>
              {[
                ['name', 'Full name', 'default', 120],
                ['email', 'Email (they sign in with it)', 'email-address', 180],
                ['mobile', 'Mobile (optional)', 'phone-pad', 20],
                ['rollNumber', 'Roll number', 'default', 30],
              ].map(([key, label, keyboardType, max]) => (
                <View key={key}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    value={form[key]}
                    onChangeText={(text) => setForm({ ...form, [key]: text })}
                    keyboardType={keyboardType}
                    autoCapitalize={key === 'name' ? 'words' : 'none'}
                    maxLength={max}
                    style={styles.input}
                    accessibilityLabel={label}
                  />
                </View>
              ))}
              <Button label="Add student and create login" onPress={enrol} busy={busy} color={palette.primaryDark} />
              <Button label="Cancel" secondary disabled={busy} onPress={() => setEnrolling(null)} />
            </View>
          ) : null}
          {r.matchedStudentId && !r.attention ? (
            <Button
              label={`Merge into ${r.studentName || 'this student'}`}
              secondary
              disabled={busy}
              onPress={() =>
                merge({ participantIds: [r.id] }, 'Merge this result?', `${r.name}'s result will be added to ${r.studentName || 'this student'}'s profile.`)
              }
            />
          ) : null}
        </View>
      ))}
    </Card>
  );
}

// ─── A marked report ─────────────────────────────────────────────────────────

/**
 * One student's marked test: the total, each paper of the session, and every question with what
 * they chose and what was right. The website's `RoomResultReport`, in a phone's shape.
 */
function MarkedReport({ room, detail }) {
  const styles = useStyles();
  const papers = detail?.parts || [];
  const rows = detail?.answers || [];
  return (
    <>
      <Card>
        <CardTitle>{room.title}</CardTitle>
        <Text style={styles.body}>{resultLine(room, detail || {})}</Text>
        {papers.length > 1
          ? papers.map((p) => (
              <Text key={p.partNo} style={styles.muted}>
                {p.title}: {p.scoredMarks ?? '—'} / {p.totalMarks ?? '—'}
              </Text>
            ))
          : null}
      </Card>
      {rows.length === 0 ? (
        <EmptyState icon="document-outline" title="Nothing to report" message="No questions were answered." />
      ) : (
        rows.map((row, index) => (
          <Card key={`${row.partNo}-${row.id}-${index}`} style={styles.person}>
            <View style={styles.rowBetween}>
              <Text style={styles.personName}>Q{index + 1}</Text>
              <Text style={[styles.rowAction, { color: !row.answer ? SLATE[600] : row.correct ? '#166534' : FEEDBACK.errorText }]}>
                {!row.answer ? 'Not answered' : row.correct ? 'Correct' : 'Incorrect'}
              </Text>
            </View>
            <Text style={styles.body}>{plain(row.questionText)}</Text>
            {['A', 'B', 'C', 'D']
              .filter((letter) => row[`option${letter}`])
              .map((letter) => (
                <Text
                  key={letter}
                  style={[styles.option, row.correctAnswer === letter && styles.optionKey, row.answer === letter && row.correctAnswer !== letter && styles.optionWrong]}
                >
                  {letter}. {plain(row[`option${letter}`])}
                  {row.correctAnswer === letter ? '  — correct answer' : row.answer === letter ? '  — chosen' : ''}
                </Text>
              ))}
          </Card>
        ))
      )}
    </>
  );
}

/** Question text is stored as HTML from the editor; a list row shows it as plain words. */
function plain(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  const styles = useStyles();
  const tone = status === 'RUNNING' ? styles.pillRunning : status === 'LOBBY' ? styles.pillLobby : styles.pillEnded;
  const text = status === 'RUNNING' ? styles.pillRunningText : status === 'LOBBY' ? styles.pillLobbyText : styles.pillEndedText;
  return (
    <View style={[styles.pill, tone]}>
      <Text style={[styles.pillText, text]}>{STATUS[status] || status}</Text>
    </View>
  );
}

function Button({ label, icon, onPress, busy = false, disabled = false, secondary = false, color }) {
  const styles = useStyles();
  const off = disabled || busy;
  const tint = secondary ? SLATE[700] : '#ffffff';
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.buttonSecondary : { backgroundColor: color || SLATE[800] },
        off && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={tint} /> : null}
          <Text style={[styles.buttonText, { color: tint }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  tabs: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: SLATE[200] },
  tab: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[600] },
  intro: { fontSize: TYPE.body, lineHeight: leading(TYPE.body), color: SLATE[700], marginBottom: SPACING.sm },
  body: { fontSize: TYPE.body, lineHeight: leading(TYPE.body), color: SLATE[700], marginTop: SPACING.xs },
  strong: { fontWeight: '800', color: SLATE[900] },
  muted: { fontSize: TYPE.label, color: SLATE[600], flexShrink: 1 },
  hint: { fontSize: TYPE.label, lineHeight: leading(TYPE.label), color: SLATE[600], marginTop: SPACING.xs },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, marginBottom: SPACING.sm },
  section: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[900], marginTop: SPACING.lg, marginBottom: SPACING.sm },
  label: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700], marginTop: SPACING.sm, marginBottom: 6 },
  field: { marginBottom: SPACING.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: TYPE.body,
    color: SLATE[900],
    backgroundColor: '#ffffff',
  },
  preview: { fontSize: TYPE.label, color: '#312e81', backgroundColor: '#eef2ff', borderRadius: 10, padding: 10, marginTop: SPACING.md },
  previewBad: { color: FEEDBACK.errorText, backgroundColor: '#fee2e2' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
  roomCard: { marginTop: SPACING.sm },
  roomTitle: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[900], flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 2 },
  backText: { fontSize: TYPE.label, fontWeight: '700' },
  link: { fontSize: TYPE.heading, fontWeight: '800', marginTop: SPACING.xs },
  code: { fontWeight: '800', letterSpacing: 2, color: SLATE[900] },
  clock: { alignSelf: 'flex-start', backgroundColor: SLATE[900], borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginVertical: SPACING.sm },
  clockLow: { backgroundColor: '#b91c1c' },
  clockText: { color: '#ffffff', fontSize: TYPE.heading + 4, fontWeight: '800', fontVariant: ['tabular-nums'] },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, minHeight: 48, marginTop: SPACING.sm },
  switchLabel: { flex: 1, fontSize: TYPE.label, color: SLATE[700] },
  person: { marginBottom: SPACING.sm },
  personRemoved: { opacity: 0.55 },
  personName: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[900], flex: 1 },
  rowAction: { fontSize: TYPE.label, fontWeight: '700' },
  paperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm, minHeight: 44 },
  paperText: { flex: 1, fontSize: TYPE.label, color: SLATE[700] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.xs },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  badgeText: { fontSize: TYPE.label - 1, fontWeight: '700', color: SLATE[800] },
  badgeIn: { backgroundColor: '#dcfce7' },
  badgeOther: { backgroundColor: '#fef3c7' },
  badgeGuest: { backgroundColor: SLATE[200] },
  badgeSaved: { backgroundColor: '#dbeafe' },
  enrol: { marginTop: SPACING.sm, padding: SPACING.md, borderRadius: 12, backgroundColor: SLATE[100] },
  createdBox: { marginTop: SPACING.sm, padding: SPACING.md, borderRadius: 12, backgroundColor: '#dcfce7' },
  password: { fontSize: TYPE.heading + 2, fontWeight: '800', letterSpacing: 1.5, color: SLATE[900], marginTop: SPACING.xs },
  option: { fontSize: TYPE.label, color: SLATE[700], paddingVertical: 3, paddingHorizontal: 6, borderRadius: 6, marginTop: 2 },
  optionKey: { backgroundColor: '#dcfce7' },
  optionWrong: { backgroundColor: '#fee2e2' },
  attention: { borderTopWidth: 1, borderTopColor: SLATE[200], paddingTop: SPACING.md, marginTop: SPACING.md },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: TYPE.label, fontWeight: '800' },
  pillRunning: { backgroundColor: '#dcfce7' },
  pillRunningText: { color: '#14532d' },
  pillLobby: { backgroundColor: '#fef3c7' },
  pillLobbyText: { color: '#78350f' },
  pillEnded: { backgroundColor: SLATE[100] },
  pillEndedText: { color: SLATE[700] },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: SPACING.md,
  },
  buttonSecondary: { borderWidth: 1, borderColor: SLATE[200], backgroundColor: '#ffffff' },
  buttonText: { fontSize: TYPE.body, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
}));
