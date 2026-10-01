import { Text, TextInput, View } from 'react-native';
import { FEEDBACK, SLATE } from '../../../../constants/theme';
import { questionRange, scanTone, sheetMismatch } from '../../../../utils/marksSheetScan';
import { LinkButton, TONE_STYLE, styles } from './marksParts';

/**
 * What a scan read, said where the teacher is looking — the website's scan result panel. The marks
 * are already in the student's row by now; this says how many, how sure, what did not add up, and
 * that nothing is saved until Save marks.
 *
 *   - per question: "Aarav: filled in 12 questions · they add up to 54.5", the colour key, and the
 *     offer to add questions the sheet has and the paper does not;
 *   - one total: the total entered and whether the sheet vouches for it, with each question as read
 *     beside it, since that grid has no question boxes to put them in.
 */

const formatMark = (value) => (value == null ? '' : String(value));

function QuestionStrip({ marks, hint }) {
  const read = marks || [];
  if (read.length === 0) return null;
  return (
    <>
      <Text style={styles.hint}>Each question as read from the sheet{hint ? ` — ${hint}` : ''}:</Text>
      <View style={styles.chips}>
        {read.map((m) => {
          const tone = scanTone(m.status);
          const shown = m.marks != null ? formatMark(m.marks) : m.status === 'CONFLICT' || m.status === 'UNREADABLE' ? '?' : '–';
          return (
            <View key={m.questionNumber} style={[styles.chip, tone && TONE_STYLE[tone]]}>
              <Text style={styles.chipText}>
                Q{m.questionNumber} · {shown}
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

function ColumnTotals({ columnTotals }) {
  const written = (columnTotals || []).filter((column) => column.written != null);
  return written.map((column) => (
    <Text
      key={column.fromQuestion}
      style={[styles.hint, { color: column.agrees ? FEEDBACK.successText : FEEDBACK.errorText, marginVertical: 2 }]}
    >
      Questions {column.fromQuestion}–{column.toQuestion}:{' '}
      {column.agrees
        ? `adds up to ${column.written}, as written on the sheet`
        : `read ${column.read == null ? '?' : formatMark(column.read)}, but the sheet says ${column.written}`}
    </Text>
  ));
}

export default function ScanResultPanel({ result, student, hasQuestions, offer, busy, onOfferChange, onAddExtra, onClose }) {
  if (!result) return null;
  const res = result.res || {};
  const name = student?.studentName || 'The student';
  const mismatch = sheetMismatch(res.header, student);

  return (
    <View style={styles.notice}>
      {mismatch ? (
        <Text style={styles.error}>⚠ {mismatch} Check it is the right answer book before saving.</Text>
      ) : null}

      {result.perQuestion ? (
        <Text style={styles.noticeText}>
          <Text style={{ fontWeight: '700' }}>{name}</Text>: filled in {result.filled} question
          {result.filled === 1 ? '' : 's'}
          {res.readTotal != null ? ` · they add up to ${formatMark(res.readTotal)}` : ''}. Check them and press Save
          marks.
        </Text>
      ) : (
        <Text style={styles.noticeText}>
          <Text style={{ fontWeight: '700' }}>{name}</Text>:{' '}
          {res.sheetTotal != null
            ? `entered a total of ${formatMark(res.sheetTotal)} ${
                res.sheetTotalStatus === 'VERIFIED' ? '✓ confirmed by the sheet' : '— please check it'
              }. ${res.sheetTotalNote || ''} Check it and press Save marks.`
            : `no total was entered. ${res.sheetTotalNote || ''} Type it in yourself.`}
        </Text>
      )}

      {!result.perQuestion ? (
        <QuestionStrip
          marks={res.marks}
          hint={
            hasQuestions
              ? null
              : "this exam has no questions set up, so only the total is recorded. Add the paper's questions under Questions to record marks question by question"
          }
        />
      ) : null}

      <ColumnTotals columnTotals={res.columnTotals} />

      {res.secondRead ? (
        <Text style={styles.hint}>
          The first read did not add up to the sheet&apos;s own totals, so the sheet was read a second time, more
          carefully.
        </Text>
      ) : null}

      {result.perQuestion ? (
        <View style={styles.chips}>
          <View style={[styles.chip, TONE_STYLE.ok]}>
            <Text style={styles.chipText}>confirmed by the sheet</Text>
          </View>
          <View style={[styles.chip, TONE_STYLE.check]}>
            <Text style={styles.chipText}>filled — please check</Text>
          </View>
          <View style={[styles.chip, TONE_STYLE.missing]}>
            <Text style={styles.chipText}>left for you to enter</Text>
          </View>
        </View>
      ) : null}

      {(res.warnings || []).map((warning, i) => (
        <Text key={`${i}-${warning}`} style={styles.warning}>
          {warning}
        </Text>
      ))}

      {result.perQuestion && offer ? (
        <View style={styles.offer}>
          <Text style={styles.offerText}>
            {questionRange(offer.extra[0].questionNumber, offer.extra[offer.extra.length - 1].questionNumber)}{' '}
            {offer.extra.length === 1 ? 'has a mark' : 'have marks'} on this sheet but{' '}
            {offer.extra.length === 1 ? "isn't" : "aren't"} on this paper.
            {offer.maxima ? ' Say what each is out of, then add them — their marks go in too.' : ' Add them, and their marks go in too.'}
          </Text>
          {offer.maxima
            ? offer.extra.map((extra, i) => (
                <View key={extra.questionNumber} style={styles.qRow}>
                  <Text style={styles.qLabel}>Q{extra.questionNumber} out of</Text>
                  <TextInput
                    style={styles.markInput}
                    value={offer.maxima[i]}
                    keyboardType="number-pad"
                    placeholderTextColor={SLATE[500]}
                    onChangeText={(text) =>
                      onOfferChange({
                        ...offer,
                        maxima: offer.maxima.map((m, j) => (j === i ? text.replace(/[^0-9]/g, '') : m)),
                      })
                    }
                    accessibilityLabel={`Question ${extra.questionNumber} out of`}
                  />
                </View>
              ))
            : null}
          <LinkButton
            icon="add-circle-outline"
            label={busy ? 'Adding…' : `Add ${offer.extra.length} question${offer.extra.length === 1 ? '' : 's'}`}
            onPress={onAddExtra}
            disabled={busy || (offer.maxima && offer.maxima.some((m) => m === ''))}
          />
        </View>
      ) : null}

      <LinkButton label="Close" onPress={onClose} />
    </View>
  );
}
