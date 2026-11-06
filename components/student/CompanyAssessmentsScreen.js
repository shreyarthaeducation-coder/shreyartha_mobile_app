import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { studentApi } from '../../services/studentApi';
import { fromLettered } from '../../utils/questionModel';
import StudentScaffold from './StudentScaffold';
import { StudentCard, StudentCardTitle, StudentNote } from './StudentCard';
import ExamRunner from './testrunner/ExamRunner';

/**
 * Company Assessments (5 Nov 2026) — the website's CompanyAssessments: tests companies hiring and
 * training on The 3C Edge have set, taken in the same exam-hall runner as every other test here.
 * `/api/student/company-assessments`. The clock is the server's: `start` answers with the
 * seconds left, and at zero the paper submits itself, as on the website.
 */

const BASE = '/api/student/company-assessments';

// The website's ASSESSMENT_CATEGORIES (Industry/assessmentCategories.js), labels verbatim.
const CATEGORY = {
  APTITUDE: 'Aptitude',
  TECHNICAL: 'Technical',
  CODING: 'Coding',
  INTERVIEW: 'Interview',
  LOGICAL_REASONING: 'Logical Reasoning',
  VERBAL_ABILITY: 'Verbal Ability',
  QUANTITATIVE: 'Quantitative',
  DOMAIN_SPECIFIC: 'Domain-Specific',
  INDUSTRY_SPECIFIC: 'Industry-Specific',
  EMPLOYABILITY: 'Employability Skills',
  CUSTOM: 'Custom',
  OTHER: 'Other',
};
const categoryLabel = (c) => CATEGORY[c] || c || '';

const wallClock = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function CompanyAssessmentsScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const [list, setList] = useState(null);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState(new Set());
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const load = useCallback(() => {
    setList(null);
    setError('');
    studentApi
      .get(BASE)
      .then((l) => setList(Array.isArray(l) ? l : []))
      .catch((e) => {
        setList([]);
        // The controller admits college students only; anyone else is told so, not "Access denied".
        setError(e?.isForbidden || e?.status === 403 ? 'Company Assessments are for college students.' : e?.message || "Couldn't load the assessments.");
      });
    studentApi
      .get(`${BASE}/attempts`)
      .then((r) => setResults(Array.isArray(r) ? r : []))
      .catch(() => setResults([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const questions = useMemo(() => (attempt?.questions || []).map(fromLettered), [attempt]);

  const start = async (card) => {
    setBusy(true);
    setError('');
    try {
      const started = await studentApi.post(`${BASE}/${card.assignmentId}/start`);
      setAttempt(started);
      setAnswers({});
      setMarked(new Set());
      setSubmitted(false);
      setResult(null);
      setSecondsLeft(started.secondsLeft);
    } catch (e) {
      setError(e?.message || "Couldn't start the assessment.");
    } finally {
      setBusy(false);
    }
  };

  const submit = useCallback(async () => {
    if (!attempt || submitting.current) return;
    submitting.current = true;
    setSubmitted(true);
    try {
      const startedAt = new Date(attempt.deadlineAt).getTime() - attempt.secondsLeft * 1000;
      const timeTakenSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      setResult(await studentApi.post(`${BASE}/attempts/${attempt.attemptId}/submit`, { answers, timeTakenSeconds }));
    } catch (e) {
      setError(e?.message || "Couldn't submit your answers. Please check your connection and try again.");
      setSubmitted(false);
    } finally {
      submitting.current = false;
    }
  }, [attempt, answers]);

  // The countdown is the server's deadline; at zero the paper submits itself.
  useEffect(() => {
    if (secondsLeft == null || submitted) return undefined;
    if (secondsLeft <= 0) {
      submit();
      return undefined;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submitted, submit]);

  const backToList = () => {
    setAttempt(null);
    setChosen(null);
    setSecondsLeft(null);
    setResult(null);
    load();
  };

  const confirmSubmit = () =>
    Alert.alert('Submit assessment?', `You have answered ${Object.keys(answers).length} of ${questions.length} questions.`, [
      { text: 'Keep answering', style: 'cancel' },
      { text: 'Submit', onPress: submit },
    ]);

  // ── Taking the paper ──────────────────────────────────────────────────────
  if (attempt) {
    const p = attempt.paper || {};
    return (
      <StudentScaffold title="Company Assessment" fallbackRoute="/student/workspace">
        <StudentCard>
          <StudentCardTitle>{p.assessmentName}</StudentCardTitle>
          <Text style={styles.meta}>
            {[p.companyName, `${questions.length} questions`, p.totalMarks != null ? `${p.totalMarks} marks` : '', p.durationMinutes ? `${p.durationMinutes} min` : '']
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {!submitted && secondsLeft != null ? (
            <Text style={[styles.timer, secondsLeft < 300 && styles.timerWarn]}>
              Time left {clock(Math.max(0, secondsLeft))}
            </Text>
          ) : null}
        </StudentCard>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ExamRunner
          questions={questions}
          answers={answers}
          onAnswer={(id, key) => setAnswers((a) => ({ ...a, [id]: key }))}
          marked={marked}
          onToggleMark={(id) =>
            setMarked((m) => {
              const next = new Set(m);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          submitted={submitted}
          graded={false}
          onSubmit={submitted ? undefined : confirmSubmit}
          submitLabel={`Submit Assessment (${Object.keys(answers).length}/${questions.length} answered)`}
          footer={
            result ? (
              <StudentCard>
                <StudentCardTitle>{result.status === 'EXPIRED' ? 'Time ran out' : 'Assessment submitted'}</StudentCardTitle>
                <Text style={styles.body}>
                  {result.status === 'EXPIRED'
                    ? 'Your answers reached us after the time limit, so this attempt was closed without a score.'
                    : `You scored ${result.scoredMarks} / ${result.totalMarks} (${result.scorePercent}%) — ${result.passed ? 'passed' : 'not passed'}${
                        result.passingPercentage != null ? ` (pass mark ${result.passingPercentage}%)` : ''
                      }.`}
                </Text>
                <Pressable onPress={backToList} style={({ pressed }) => [styles.button, { backgroundColor: palette.primary }, pressed && styles.pressed]} accessibilityRole="button">
                  <Text style={styles.buttonText}>Back to Company Assessments</Text>
                </Pressable>
              </StudentCard>
            ) : null
          }
        />
      </StudentScaffold>
    );
  }

  // ── Before starting: the rules ────────────────────────────────────────────
  if (chosen) {
    const left = chosen.maxAttempts - chosen.attemptsUsed;
    return (
      <StudentScaffold title="Company Assessment" fallbackRoute="/student/workspace">
        <Pressable onPress={() => setChosen(null)} style={styles.back} accessibilityRole="button">
          <Text style={[styles.backText, { color: palette.primaryDark }]}>← Back</Text>
        </Pressable>
        <StudentCard>
          <StudentCardTitle>{chosen.assessmentName}</StudentCardTitle>
          <Text style={styles.meta}>
            {[chosen.companyName, `${chosen.totalQuestions} questions`, `${chosen.totalMarks} marks`, `${chosen.durationMinutes} min`].join(' · ')}
          </Text>
          <Text style={styles.rulesTitle}>Before you start</Text>
          {[
            `The timer runs for ${chosen.durationMinutes} minutes from when you start, and the paper submits itself when it ends.`,
            `Pass mark: ${chosen.passingPercentage}%. Wrong answers may cost marks, as shown on each question.`,
            `Attempts: ${chosen.attemptsUsed} of ${chosen.maxAttempts} used. Open until ${wallClock(chosen.endsAt)}.`,
          ].map((rule) => (
            <Text key={rule} style={styles.rule}>
              • {rule}
            </Text>
          ))}
          {[chosen.assessmentInstructions, chosen.instructions].filter((v, i, all) => v && all.indexOf(v) === i).map((text) => (
            <Text key={text} style={styles.body}>
              {text}
            </Text>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            disabled={busy || (left <= 0 && !chosen.inProgress)}
            onPress={() => start(chosen)}
            style={({ pressed }) => [styles.button, { backgroundColor: palette.primary }, (busy || (left <= 0 && !chosen.inProgress)) && styles.disabled, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{busy ? 'Starting…' : chosen.inProgress ? 'Resume Assessment' : 'Start Assessment'}</Text>
          </Pressable>
        </StudentCard>
      </StudentScaffold>
    );
  }

  // ── The list ──────────────────────────────────────────────────────────────
  return (
    <StudentScaffold title="Company Assessments" fallbackRoute="/student/workspace" loading={list === null} onRefresh={load}>
      <Text style={styles.lead}>Assessments set by Shreyartha for companies hiring and training on The 3C Edge.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {list && list.length === 0 && !error ? (
        <StudentCard>
          <StudentNote>No company assessments are open right now. Check back later.</StudentNote>
        </StudentCard>
      ) : null}
      {(list || []).map((c) => {
        const left = c.maxAttempts - c.attemptsUsed;
        const can = left > 0 || c.inProgress;
        return (
          <StudentCard key={c.assignmentId}>
            <Text style={styles.company}>{c.companyName}</Text>
            <StudentCardTitle>{c.assessmentName}</StudentCardTitle>
            <Text style={styles.meta}>
              {[categoryLabel(c.category), `${c.totalQuestions} questions`, `${c.totalMarks} marks`, `${c.durationMinutes} min`].filter(Boolean).join(' · ')}
            </Text>
            <Text style={styles.meta}>Open until {wallClock(c.endsAt)}</Text>
            <Text style={styles.meta}>
              Attempts: {c.attemptsUsed} / {c.maxAttempts}
            </Text>
            {c.lastResult ? (
              <Text style={styles.meta}>
                Last result: {c.lastResult.status === 'EXPIRED' ? 'expired' : `${c.lastResult.scorePercent}% — ${c.lastResult.passed ? 'passed' : 'not passed'}`}
              </Text>
            ) : null}
            <Pressable
              disabled={!can}
              onPress={() => setChosen(c)}
              style={({ pressed }) => [styles.button, { backgroundColor: palette.primary }, !can && styles.disabled, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{c.inProgress ? 'Resume' : left <= 0 ? 'No attempts left' : 'Take Assessment'}</Text>
            </Pressable>
          </StudentCard>
        );
      })}
      {results.length ? (
        <StudentCard>
          <StudentCardTitle>My results</StudentCardTitle>
          {results.map((r) => (
            <View key={r.id} style={styles.result}>
              <Text style={styles.resultTitle}>{r.assessmentName}</Text>
              <Text style={styles.meta}>
                {r.companyName} · attempt {r.attemptNo}:{' '}
                {r.status === 'IN_PROGRESS'
                  ? 'in progress'
                  : r.status === 'EXPIRED'
                    ? 'expired'
                    : `${r.scoredMarks}/${r.totalMarks} (${r.scorePercent}%) — ${r.passed ? 'passed' : 'not passed'}`}
              </Text>
            </View>
          ))}
        </StudentCard>
      ) : null}
    </StudentScaffold>
  );
}

const useStyles = makeStyles(() => ({
  lead: { fontSize: TYPE.body, color: SLATE[600], marginBottom: SPACING.md },
  company: { fontSize: TYPE.caption, fontWeight: '800', color: SLATE[500], textTransform: 'uppercase', letterSpacing: 0.5 },
  meta: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  body: { fontSize: TYPE.body, color: SLATE[700], marginTop: SPACING.sm },
  rulesTitle: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[800], marginTop: SPACING.md },
  rule: { fontSize: TYPE.body, color: SLATE[700], marginTop: 4 },
  timer: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[800], marginTop: SPACING.sm },
  timerWarn: { color: FEEDBACK.errorText },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, marginVertical: SPACING.sm },
  button: { marginTop: SPACING.md, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontSize: TYPE.label, fontWeight: '800', color: '#ffffff' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  back: { paddingVertical: SPACING.xs },
  backText: { fontSize: TYPE.label, fontWeight: '700' },
  result: { paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: SLATE[100] },
  resultTitle: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[900] },
}));
