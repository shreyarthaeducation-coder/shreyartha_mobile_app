import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { Card, CardTitle } from '../ui';
import { ProgressBar } from '../ui/charts';
import { Readable } from './readaloud/ReadAloudMode';
import { makeStyles } from '../../utils/makeStyles';

/** Percent complete, guarding the divide-by-zero the web guards too. */
export const psychometricPercent = (p) =>
  p?.totalTopics > 0 ? Math.round((p.completedCount / p.totalTopics) * 100) : 0;

/**
 * The Counselling Report's Psychometric Result: the personal statement card, then the psychometric
 * progress card. The parent sees it for their child and the teacher for the student picked — one
 * component, so the two panels cannot show the same child differently.
 *
 * `psych` carries the keys of GET /api/parent/dashboard/psychometric, which the teacher's
 * /api/teacher/counselling/students/{id}/psychometric returns too: chapterName, completedCount,
 * totalTopics, hasCompletedAssessment.
 *
 * Each card is its own <Readable>, so a reader can tap the statement without also sitting through
 * the psychometric summary. The caller's ScreenScaffold turns tap-to-hear on.
 */
export default function PsychometricResultCards({
  statementTitle = 'My Personal Statement',
  statement,
  psych,
  psychFailed = false,
}) {
  const styles = useStyles();
  const palette = usePalette();
  const percent = psychometricPercent(psych);

  // What the PSYCHOMETRIC card says when tapped. The personal statement card states its own words
  // beside it, so this does not repeat them: two cards, two things to hear, tapped separately.
  const spokenPsych = psychFailed
    ? 'The psychometric assessment could not be loaded right now.'
    : [
        psych?.chapterName,
        `${psych?.completedCount || 0} of ${psych?.totalTopics || 0} topics completed`,
        psych?.hasCompletedAssessment ? 'Assessment completed.' : 'Assessment not completed yet.',
      ].filter(Boolean).join('. ');

  return (
    <>
      <Readable text={`${statementTitle}. ${statement || 'No personal statement added yet.'}`}>
        <Card style={styles.card}>
          <CardTitle>{statementTitle}</CardTitle>
          <Text style={statement ? styles.statement : styles.muted}>
            {statement || 'No personal statement added yet.'}
          </Text>
        </Card>
      </Readable>

      <Readable text={spokenPsych}>
        <Card style={styles.card}>
          {/* The web shows "Data unavailable" as the card title when the read fails. */}
          <CardTitle>{psychFailed ? 'Data unavailable' : psych?.chapterName}</CardTitle>

          {psychFailed ? (
            <Text style={styles.muted}>
              Could not load the psychometric assessment right now.
            </Text>
          ) : (
            <>
              <Text style={styles.count}>
                {psych?.completedCount || 0}/{psych?.totalTopics || 0} Completed
              </Text>
              <ProgressBar value={percent} color={palette.primary} />

              <View style={styles.statusRow}>
                <Ionicons
                  name={psych?.hasCompletedAssessment ? 'checkmark-circle' : 'time-outline'}
                  size={18}
                  color={psych?.hasCompletedAssessment ? FEEDBACK.successText : SLATE[400]}
                />
                <Text
                  style={[
                    styles.status,
                    psych?.hasCompletedAssessment && { color: FEEDBACK.successText },
                  ]}
                >
                  {psych?.hasCompletedAssessment
                    ? 'Assessment completed. Results are available.'
                    : 'Psychometric assessment not yet completed by the student.'}
                </Text>
              </View>
            </>
          )}
        </Card>
      </Readable>
    </>
  );
}

const useStyles = makeStyles(() => ({
  card: { marginBottom: SPACING.sm },
  statement: { fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body) },
  muted: { fontSize: TYPE.body, color: SLATE[500], lineHeight: leading(TYPE.body), fontStyle: 'italic' },
  count: { fontSize: TYPE.body, color: SLATE[600], fontWeight: '700', marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: SPACING.sm },
  status: { flex: 1, fontSize: TYPE.body, color: SLATE[500], lineHeight: leading(TYPE.body) },
}));
