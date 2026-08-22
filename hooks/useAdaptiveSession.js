import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One adaptive-assessment runner, with every guard the repeat-question saga produced.
 *
 * ── WHY THIS IS A SHARED HOOK ─────────────────────────────────────────────────
 * The web has THREE adaptive engines and they do not share code, so they do not share fixes:
 *
 *   MyReflection            /api/adaptive/topic/{id}/…                 all guards
 *   Universal Adaptive      /api/student/universal-adaptive/…          seenTexts only
 *   Competitive Exam        /api/student/competitiveexam/adaptive/…    none at all
 *
 * The guards below came out of a real June–July 2026 investigation (see the
 * `project-adaptive-assessment-saga` memory) whose visible symptom was "the same question keeps
 * repeating and its correct answer keeps changing". Putting them in one place is the point: three
 * copies is how two of them ended up without the fixes.
 *
 * ── THE FOUR GUARDS ──────────────────────────────────────────────────────────
 * 1. PIN `currentQuestionId` to the question actually on screen when answering, so the server can
 *    never grade a question the client has since moved past. This was the root cause of the
 *    changing-answer symptom.
 * 2. ATTEMPT EPOCH (`attemptRef`), bumped on every start and on leaving. Every async continuation
 *    re-checks it — after the request AND inside the feedback timer — so a response belonging to
 *    an abandoned attempt can never write into a fresh one.
 * 3. SEEN IDS *AND* SEEN TEXTS. Duplicate rows of the same question exist under different ids in
 *    some banks, so an id check alone lets a visible repeat through. A repeat ends the test rather
 *    than being shown again.
 * 4. DOUBLE-START BLOCK (`startingRef`) — two `/start` calls in flight leave the displayed question
 *    and the session's `currentQuestionId` out of sync, which re-creates guard 1's bug.
 *
 * Correctness is judged server-side; questions no longer carry their answer.
 *
 * NOT A CONCERN HERE: the saga's third root cause was `StudentPlatformShell`, a DOM translator that
 * reverted React text updates ~60 ms later and made fresh state "flash then revert". React Native
 * has no DOM and no such shell, so that symptom cannot occur — do not go looking for it.
 *
 * ── TWO PROTOCOLS, NOT ONE ───────────────────────────────────────────────────
 * The guards are shared; the WIRE FORMAT is not, and conflating them is what broke the Practice
 * Zone's adaptive assessment. The two engines own their state at opposite ends:
 *
 *   'session'  (MyReflection, Competitive Exam)
 *              The CLIENT carries the ladder. Every request echoes the whole `sessionState` blob
 *              back, the client decides when the last question has been reached, and the final
 *              answer goes to a different endpoint (/submit rather than /next). Nothing is
 *              persisted server-side. A question CAP is meaningful here because only the client
 *              knows when to stop — Competitive Exam's is 25.
 *
 *   'server'   (Universal Adaptive)
 *              The SERVER owns the ladder on a persisted attempt row. The request is exactly
 *              `{ attemptId, selectedAnswerIndex }` — there is no /next, no /submit, and
 *              **no question cap**: the run ends when the server sets `assessmentComplete`,
 *              i.e. when the question pool is exhausted. Counters come back FLAT
 *              (`totalAnswered`/`correctCount`/`wrongCount`/`currentLevel`) and a full `report`
 *              object arrives with the final answer.
 *
 * Sending a `sessionState` to the 'server' engine and capping it at 15 made the test stop early and
 * report 0 correct, because that engine returns no `sessionState` for the summary to be built from
 * and the `report` was being thrown away.
 *
 * ── SHAPE ────────────────────────────────────────────────────────────────────
 * @param {object}   cfg
 * @param {function} cfg.start      () => Promise<payload>       POSTs the engine's /start
 * @param {function} cfg.answer     (body, isLast) => Promise<payload>
 * @param {'session'|'server'} [cfg.protocol='session']  which wire format the engine speaks
 * @param {number}   [cfg.total]    question count to aim for — 'session' engines only; ignored,
 *                                  and must be omitted, for 'server'
 * @param {function} [cfg.onFinish] (summary) => void — called once per completed attempt
 *
 * A payload is `{ question, sessionState?, assessmentComplete?, available?,
 * totalQuestionsAvailable?, wasCorrect?, correctAnswer?, report? }`.
 */

const FEEDBACK_MS = 1500;

/** No cap: a 'server' engine runs until the server says the pool is exhausted. */
const UNCAPPED = Number.POSITIVE_INFINITY;

const accuracy = (correct, answered) =>
  answered > 0 ? ((correct / answered) * 100).toFixed(1) : '0.0';

/**
 * 'server' engines answer with FLAT counters on every response, including the final one, so the
 * last `/answer` payload already IS the summary. `report` is carried separately by the caller.
 */
function buildServerSummary(data, questionNumber) {
  const answered = data.totalAnswered ?? questionNumber;
  const correct = data.correctCount ?? 0;
  return {
    totalAnswered: answered,
    correctCount: correct,
    wrongCount: data.wrongCount ?? Math.max(0, answered - correct),
    finalLevel: data.report?.finalLevel || data.currentLevel || 'INTERMEDIATE',
    // The server's own accuracy wins when present — it is computed over the persisted attempt.
    accuracyPercentage: data.report?.accuracy != null
      ? Number(data.report.accuracy).toFixed(1)
      : accuracy(correct, answered),
  };
}

/**
 * 'session' engines: a final /submit returns the summary directly; an exhausted /next leaves us to
 * rebuild it from the client-held session counters.
 */
function buildSessionSummary(data, isLast, questionNumber) {
  if (isLast && data.totalAnswered !== undefined) return data;
  const ss = data.sessionState || {};
  const answered = ss.totalAnswered ?? questionNumber;
  const correct = ss.correctCount ?? 0;
  return {
    totalAnswered: answered,
    correctCount: correct,
    wrongCount: ss.wrongCount ?? 0,
    finalLevel: ss.currentLevel ?? 'INTERMEDIATE',
    accuracyPercentage: accuracy(correct, ss.totalAnswered),
  };
}

/** Mirrors the backend's normalisation: strip tags/entities, collapse spaces, lowercase. */
export const normalizeQuestionText = (t) =>
  String(t || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export default function useAdaptiveSession({ start, answer, protocol = 'session', total, onFinish }) {
  const serverLadder = protocol === 'server';
  const cap = serverLadder ? UNCAPPED : total;

  const [phase, setPhase] = useState('idle'); // idle | testing | summary
  const [question, setQuestion] = useState(null);
  const [sessionState, setSessionState] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [effectiveTotal, setEffectiveTotal] = useState(cap);
  const [level, setLevel] = useState(null);
  const [report, setReport] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(null);
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const timerRef = useRef(null);
  const advancingRef = useRef(false);
  const startingRef = useRef(false); // guard 4
  const attemptRef = useRef(0); // guard 2
  const seenIdsRef = useRef(new Set()); // guard 3
  const seenTextsRef = useRef(new Set()); // guard 3
  const finishedRef = useRef(false);

  // A pending feedback timer must not fire into an unmounted tree.
  useEffect(
    () => () => {
      attemptRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const begin = useCallback(async () => {
    if (startingRef.current) return; // guard 4
    startingRef.current = true;
    attemptRef.current += 1; // guard 2
    const attempt = attemptRef.current;

    setLoading(true);
    setError('');
    advancingRef.current = false;
    finishedRef.current = false;

    try {
      const data = await start();
      if (attemptRef.current !== attempt) return;

      if (data?.available === false || !data?.question) {
        setQuestion(null);
        setSessionState(null);
        setQuestionNumber(0);
        setError('No assessment questions available for this topic yet.');
        return;
      }

      seenIdsRef.current = new Set([data.question.id]);
      seenTextsRef.current = new Set([normalizeQuestionText(data.question.questionText)]);
      setQuestion(data.question);
      setSessionState(data.sessionState);
      // A 'server' engine's denominator is whatever the pool holds — there is nothing to cap it
      // against. A 'session' engine takes the smaller of its own cap and the pool.
      setEffectiveTotal(
        serverLadder
          ? data.totalQuestionsAvailable || UNCAPPED
          : Math.min(cap, data.totalQuestionsAvailable || cap),
      );
      setQuestionNumber(1);
      setLevel(data.currentLevel || data.sessionState?.currentLevel || 'INTERMEDIATE');
      setReport(null);
      setSelected(null);
      setShowFeedback(false);
      setWasCorrect(null);
      setCorrectAnswer(null);
      setSummary(null);
      setPhase('testing');
    } catch {
      if (attemptRef.current !== attempt) return;
      // Clear stale state so an old question or counter cannot linger on the idle screen.
      setQuestion(null);
      setSessionState(null);
      setQuestionNumber(0);
      setError('Failed to start the assessment. Please try again.');
    } finally {
      setLoading(false);
      startingRef.current = false;
    }
  }, [start, cap, serverLadder]);

  const choose = useCallback(
    async (optionIndex) => {
      if (showFeedback || advancingRef.current) return;
      advancingRef.current = true;
      const attempt = attemptRef.current;
      setSelected(optionIndex);

      // A 'server' engine is never on its "last" question as far as the client is concerned —
      // only `assessmentComplete` ends it. `effectiveTotal` is UNCAPPED there, so this is false.
      const isLast = questionNumber >= effectiveTotal;

      // GUARD 1 — grade the question that is on screen, not whatever the session drifted to.
      // The 'server' engine has no client-held state to pin it into: the attempt row already knows
      // which question it issued, so sending a `sessionState` it does not model is at best ignored
      // and at worst a 400. It gets the exact two fields its request DTO declares.
      const body = serverLadder
        ? { selectedAnswerIndex: optionIndex }
        : {
            sessionState: question
              ? { ...sessionState, currentQuestionId: question.id }
              : sessionState,
            selectedAnswerIndex: optionIndex,
          };

      let data;
      try {
        data = await answer(body, isLast);
      } catch {
        if (attemptRef.current !== attempt) return; // guard 2
        setError('Something went wrong. Please try again.');
        setSelected(null);
        advancingRef.current = false;
        return;
      }

      if (attemptRef.current !== attempt) return; // guard 2

      setWasCorrect(!!data.wasCorrect);
      setCorrectAnswer(data.correctAnswer);
      setShowFeedback(true);

      timerRef.current = setTimeout(() => {
        if (attemptRef.current !== attempt) return; // guard 2, again — the epoch can move mid-wait

        // GUARD 3 — a question already shown this attempt ends the test rather than reappearing.
        // Matched on id AND normalised text, because duplicate rows carry different ids.
        const alreadyShown =
          !!data.question &&
          (seenIdsRef.current.has(data.question.id) ||
            seenTextsRef.current.has(normalizeQuestionText(data.question.questionText)));

        const finished = isLast || data.assessmentComplete || !data.question || alreadyShown;

        if (finished) {
          const summaryObj = serverLadder
            ? buildServerSummary(data, questionNumber)
            : buildSessionSummary(data, isLast, questionNumber);
          setSummary(summaryObj);
          // Only the 'server' engine produces one; it is the whole analysis screen.
          if (data.report) setReport(data.report);
          setPhase('summary');
          // Exactly once per completed attempt, however we arrived at "finished".
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinish?.(summaryObj);
          }
        } else {
          seenIdsRef.current.add(data.question.id);
          seenTextsRef.current.add(normalizeQuestionText(data.question.questionText));
          setQuestion(data.question);
          setSessionState(data.sessionState);
          // The ladder chip. 'server' reports it flat; 'session' carries it in the blob.
          setLevel(data.currentLevel || data.sessionState?.currentLevel || null);
          setQuestionNumber((n) => n + 1);
          setSelected(null);
          setShowFeedback(false);
          setWasCorrect(null);
          setCorrectAnswer(null);
        }
        advancingRef.current = false;
      }, FEEDBACK_MS);
    },
    [
      answer,
      effectiveTotal,
      onFinish,
      question,
      questionNumber,
      serverLadder,
      sessionState,
      showFeedback,
    ],
  );

  /**
   * End the run NOW and show the analysis the server just handed back.
   *
   * For the web's `finishEarly`: `/stop` returns the same `UniversalAdaptiveAnalysisResponse` that
   * accompanies the final answer, so a student who stops still gets a report. The epoch is bumped
   * FIRST so a `/answer` already in flight cannot land on top of the summary — the same guard that
   * makes `leave()` safe.
   */
  const finishWith = useCallback(
    (analysis) => {
      attemptRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      advancingRef.current = false;

      const answered = analysis?.totalAnswered ?? questionNumber;
      const correct = analysis?.correctCount ?? 0;
      const summaryObj = {
        totalAnswered: answered,
        correctCount: correct,
        wrongCount: analysis?.wrongCount ?? Math.max(0, answered - correct),
        finalLevel: analysis?.finalLevel || 'INTERMEDIATE',
        accuracyPercentage:
          analysis?.accuracy != null ? Number(analysis.accuracy).toFixed(1) : accuracy(correct, answered),
      };
      setSummary(summaryObj);
      if (analysis) setReport(analysis);
      setShowFeedback(false);
      setSelected(null);
      setPhase('summary');
      if (!finishedRef.current) {
        finishedRef.current = true;
        onFinish?.(summaryObj);
      }
    },
    [onFinish, questionNumber],
  );

  /** Leaving mid-test. Bumping the epoch is what makes an in-flight response harmless. */
  const leave = useCallback(() => {
    attemptRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    advancingRef.current = false;
    setPhase('idle');
    setQuestion(null);
    setSessionState(null);
    setQuestionNumber(0);
    setLevel(null);
    setReport(null);
    setSelected(null);
    setShowFeedback(false);
    setSummary(null);
    setError('');
  }, []);

  return {
    phase,
    question,
    questionNumber,
    effectiveTotal,
    /** `true` when there is no fixed denominator — render "Question 7" rather than "7 / ∞". */
    uncapped: !Number.isFinite(effectiveTotal),
    level,
    /** The server-built analysis. Only ever populated by a 'server' engine. */
    report,
    selected,
    showFeedback,
    wasCorrect,
    correctAnswer,
    summary,
    loading,
    error,
    begin,
    finishWith,
    choose,
    leave,
  };
}
