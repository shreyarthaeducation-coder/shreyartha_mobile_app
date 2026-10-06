import { getTopicType, processAssessmentResults } from './psychometricScoring';

/**
 * One summary over every psychometric test a student has taken — what My Analytics shows.
 * The twin of the web's `PsychometricAssessment/psychometricSummary.js`; keep the two in step.
 *
 * The server stores answers, never scores, so each test is run through the same engine its own
 * report uses and only the slice that test owns is lifted out. Scoring an LPM paper also leaves
 * numbers in the 3C categories (skills overlap); mixing those in would make a test the student
 * never took look half-done.
 *
 * `taken` says which tests there are answers for, so the screen can tell "scored 0%" from "not
 * taken".
 *
 * @param {Array} topics `[{ topicName, questions, answers: [{ questionId, answer }], answeredAt }]`
 *                       — GET /api/psychometrics/results with no topicId
 * @returns {object|null} null when nothing is answered at all
 */
export function buildPsychometricSummary(topics) {
  const taken = {};
  const byType = {};
  let latest = null;

  (topics || []).forEach((topic) => {
    const given = {};
    (topic.answers || []).forEach((a) => {
      if (a && a.questionId != null && a.answer) given[a.questionId] = a.answer;
    });
    if (Object.keys(given).length === 0) return;

    const type = getTopicType(topic.topicName);
    byType[type] = processAssessmentResults(topic.questions || [], given, topic.topicName);
    taken[type] = true;
    if (topic.answeredAt && (!latest || topic.answeredAt > latest)) latest = topic.answeredAt;
  });

  const types = Object.keys(byType);
  if (types.length === 0) return null;

  const streams = byType.streamAptitude?.streamAptitude || null;
  const streamTotal = streams ? Object.values(streams).reduce((sum, v) => sum + (v || 0), 0) : 0;
  // The stream scored highest; none until the stream test is taken, and none if every stream is 0.
  const primaryStream =
    streams && streamTotal > 0
      ? Object.keys(streams).reduce((best, key) => (streams[key] > streams[best] ? key : best), 'science')
      : null;

  const date = latest ? new Date(latest) : null;
  return {
    taken,
    testsTaken: types.length,
    personalityBlueprint: byType['3c']?.personalityBlueprint || null,
    learningProductivityMatrix: byType.lpm?.learningProductivityMatrix || null,
    skillProficiency: byType.skillCompass?.skillProficiency || null,
    careerInterestMapping: streams,
    primaryStream,
    // The average of the tests taken — a test not taken does not pull it towards zero.
    overallReadiness: Math.round(
      types.reduce((sum, t) => sum + (byType[t].overallReadiness || 0), 0) / types.length,
    ),
    assessmentDate: date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : null,
  };
}
