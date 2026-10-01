import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, TYPE } from '../../../../constants/theme';
import {
  createExamQuestion,
  fetchPhotoImportAvailable,
  parseQuestionPaper,
} from '../../../../services/teacher/examService';
import { normaliseDoubtImage } from '../../../../utils/doubtImage';
import { pickImage, pickPdf, takePhoto } from '../../../../utils/filePicker';
import { htmlToText } from '../../../../utils/htmlToText';
import { importPayload } from '../../../../utils/questionPaper';
import { LinkButton, PALETTE } from '../marks/marksParts';

/**
 * Import questions from a question paper — the website's "Import from PDF" (PdfQuestionImporter).
 *
 * A PDF, or — where the server can read photographs (Cloud Vision, `scan-available.available`) — a
 * photo of the page. The file is read into questions that are SHOWN first, every one ticked; the
 * teacher unticks what they do not want, and only then are they created, into the set on screen.
 * An item with no text, or an MCQ with fewer than two options, is skipped rather than failing the
 * batch — the server would refuse it.
 */
export default function ImportPanel({ examId, questionSet, chapters, onDone, onCancel, onError }) {
  const [photoOk, setPhotoOk] = useState(false);
  const [reading, setReading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [message, setMessage] = useState('');
  const [picked, setPicked] = useState(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPhotoImportAvailable()
      .then((ok) => alive && setPhotoOk(ok))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const read = async (source) => {
    let file;
    if (source === 'pdf') {
      file = await pickPdf();
    } else {
      const photo = source === 'camera' ? await takePhoto() : await pickImage();
      if (photo?.denied) {
        onError?.(source === 'camera' ? 'Allow camera access to photograph the page.' : 'Allow photo access to choose the page.');
        return;
      }
      file = photo ? { ...(await normaliseDoubtImage(photo.uri)), name: 'question-page.jpg' } : null;
    }
    if (!file) return;
    setReading(true);
    setParsed(null);
    setMessage('');
    try {
      const res = await parseQuestionPaper(file);
      setParsed(res.questions);
      setMessage(res.questions.length ? '' : res.message || 'No questions found in that file.');
      setPicked(new Set(res.questions.map((_, i) => i)));
    } catch (e) {
      onError?.(e?.message || 'Could not read that file.');
    } finally {
      setReading(false);
    }
  };

  const choosePhoto = () => {
    const options = [
      { text: 'Take photo', onPress: () => read('camera') },
      { text: 'Choose photo', onPress: () => read('library') },
    ];
    if (Platform.OS === 'ios') options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('A photo of the question paper', undefined, options, { cancelable: true });
  };

  const importPicked = async () => {
    setImporting(true);
    let saved = 0;
    let skipped = 0;
    let failed = 0;
    let withImages = 0;
    for (let i = 0; i < parsed.length; i += 1) {
      if (!picked.has(i)) continue;
      const payload = importPayload(parsed[i], chapters, questionSet);
      if (!payload) {
        skipped += 1;
        continue;
      }
      try {
        await createExamQuestion(examId, payload);
        saved += 1;
        if (payload.questionImageUrl) withImages += 1;
      } catch {
        failed += 1;
      }
    }
    setImporting(false);
    const parts = [`Imported ${saved} question${saved !== 1 ? 's' : ''}`];
    if (withImages > 0) parts.push(`${withImages} came in with an image`);
    if (skipped > 0) parts.push(`${skipped} skipped (missing text, or an MCQ with fewer than 2 options)`);
    if (failed > 0) parts.push(`${failed} could not be saved`);
    onDone(`${parts.join(' — ')}.`);
  };

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.title}>Import questions{questionSet > 1 ? ` into Set ${questionSet}` : ''}</Text>
        <LinkButton label="Cancel" onPress={onCancel} disabled={importing} />
      </View>
      <Text style={styles.hint}>
        Each question starts with its number and type — “Q1 Multiple Choice (MCQ) 1 marks” — followed by the question,
        options A.–D., Chapter:, Topic:, Bloom&apos;s Taxonomy / Skill Set and Sample Answer; or a numbered list where each
        question is followed by its marks, chapter, Bloom&apos;s and skills.
      </Text>
      <View style={styles.tools}>
        <LinkButton icon="document-outline" label="Choose PDF" onPress={() => read('pdf')} disabled={reading || importing} />
        {photoOk ? (
          <LinkButton icon="camera-outline" label="Photo of a page" onPress={choosePhoto} disabled={reading || importing} />
        ) : null}
      </View>

      {reading ? (
        <View style={styles.reading}>
          <ActivityIndicator size="small" color={PALETTE.primary} />
          <Text style={styles.hint}>Reading the paper…</Text>
        </View>
      ) : null}
      {message ? <Text style={styles.hint}>{message}</Text> : null}

      {parsed && parsed.length ? (
        <>
          <Text style={styles.count}>
            {parsed.length} question{parsed.length !== 1 ? 's' : ''} found — untick any you do not want.
          </Text>
          {parsed.map((q, i) => {
            const on = picked.has(i);
            return (
              <Pressable
                key={i}
                onPress={() =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
                style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && styles.pressed]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? PALETTE.primary : SLATE[400]} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={3}>
                    Q{i + 1}. {htmlToText(q.questionStatement || '') || '(no text)'}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {[q.questionType, q.marks ? `${q.marks} marks` : null, q.chapterName, q.questionImageUrl ? 'with an image' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <LinkButton
            icon="download-outline"
            label={importing ? 'Importing…' : `Import ${picked.size} question${picked.size !== 1 ? 's' : ''}`}
            onPress={importPicked}
            disabled={importing || picked.size === 0}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  hint: { fontSize: TYPE.label, color: SLATE[500], marginVertical: 4 },
  tools: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginVertical: 6 },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700], marginVertical: 6 },
  row: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    marginBottom: 6,
    backgroundColor: '#ffffff',
  },
  rowOn: { borderColor: PALETTE.primary, backgroundColor: PALETTE.tint },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: TYPE.body, color: SLATE[800] },
  rowMeta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },
  pressed: { opacity: 0.72 },
});
