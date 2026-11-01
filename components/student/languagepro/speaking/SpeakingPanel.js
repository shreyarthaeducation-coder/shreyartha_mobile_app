import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, RECORDING, SLATE, SPACING, TYPE, leading } from '../../../../constants/theme';
import { STUDENT_KEYS, WORD_TINT } from '../../../../constants/shreyaSpeaking';
import { makeStyles } from '../../../../utils/makeStyles';
import { usePalette } from '../../../ui/PaletteContext';
import useLiveReading from '../../../../hooks/useLiveReading';
import { assessPronunciation } from '../../../../services/student/speechService';
import { shreyaEnglish } from '../../../../services/student/languageProService';
import { parseWordScores } from '../../phonetics/wordScores';
import { READ, alignWords, settledMistakes, withAzureVerdict } from '../../../../utils/shreyaAlign';
import { StudentCard } from '../../StudentCard';
import CharacterCard from './CharacterCard';
import VocabText from './VocabText';

const clean = (word) => String(word).replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '');
const WHAT = { SKIPPED: 'missed', WRONG: 'said differently', MISPRONOUNCED: 'not quite right' };

/**
 * The challenge itself on the phone (1 Nov 2026) — the website's `SpeakingTab`.
 *
 * The phone's own recogniser (`useLiveReading`) gives the words as they are said, so the line
 * colours in word by word and a mistake is shown THE MOMENT it is settled (a word skipped or said
 * wrong, and the student has read on past it). The character whose line it is says the word as soon
 * as the microphone closes — at the end of the line, which stops by itself once every word is
 * reached. Not while it is open: the phone's speaker would be heard by its own microphone, and the
 * correction would be marked as the student reading it.
 *
 * The same take is kept as a 16 kHz WAV and sent to `/api/v1/speech/assess`; Azure's word scores
 * add any word that was said but mispronounced, and that character says those too.
 */
export default function SpeakingPanel({ data, castByKey, say, stopVoice, showToast }) {
  const styles = useStyles();
  const palette = usePalette();
  const lines = useMemo(() => data.lines || [], [data]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState({});
  const [speaker, setSpeaker] = useState(null); // {key, bubble}
  const [notice, setNotice] = useState('');
  const [scoring, setScoring] = useState(false);
  const [summary, setSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  // Mistake ids (`line:word:state`) already shown, and already said by a character.
  const noticed = useRef(new Set());
  const spoken = useRef(new Set());
  const queue = useRef(Promise.resolve());
  const finalisedFor = useRef(null);
  const assessedUri = useRef(null);

  const line = lines[index];
  const reading = useLiveReading();
  const { stop: stopReading, reset: resetReading, start: startReading } = reading;
  const listening = reading.status === 'listening' || reading.status === 'starting';

  const live = useMemo(
    () => (line && listening ? alignWords(line.text, reading.heardText) : null),
    [line, listening, reading.heardText],
  );

  // The chorus is everyone at once, so Sonia says its corrections.
  const who = line ? (line.chorus ? 'SONIA' : line.character) : 'SONIA';
  const whoName = castByKey[who]?.name || 'Sonia';

  /** One character speaks, in turn: corrections queue up rather than talk over one another. */
  const speakAs = useCallback(
    (characterKey, text, bubble) => {
      queue.current = queue.current.then(async () => {
        setSpeaker({ key: characterKey, bubble: bubble || text });
        try {
          await say(text, characterKey);
        } finally {
          setSpeaker(null);
        }
      });
      return queue.current;
    },
    [say],
  );

  /** Shows each settled mistake once, as it happens. */
  const show = useCallback(
    (mistakes) => {
      mistakes.forEach((m) => {
        const id = `${index}:${m.index}:${m.state}`;
        if (noticed.current.has(id)) return;
        noticed.current.add(id);
        setNotice(`Oops! “${clean(m.display)}” was ${WHAT[m.state] || 'missed'}.`);
      });
    },
    [index],
  );

  /** Once the microphone is closed: the line's character says each mistake's word, once. */
  const correct = useCallback(
    (mistakes) => {
      mistakes.forEach((m) => {
        const id = `${index}:${m.index}:${m.state}`;
        noticed.current.add(id);
        if (spoken.current.has(id)) return;
        spoken.current.add(id);
        const word = clean(m.display);
        setNotice(`Oops! “${word}” was ${WHAT[m.state] || 'missed'}. ${whoName} says it:`);
        speakAs(who, word, `“${word}”`);
      });
    },
    [index, who, whoName, speakAs],
  );

  // Live: each mistake shown as soon as it is settled, and the line stops once every word is reached.
  useEffect(() => {
    if (!live) return;
    show(settledMistakes(live.words));
    if (live.done) stopReading();
  }, [live, show, stopReading]);

  // The microphone has closed: the line's marking (its corrections follow, below).
  useEffect(() => {
    if (reading.status !== 'done' || !line || finalisedFor.current === index) return;
    finalisedFor.current = index;
    const { words } = alignWords(line.text, reading.heardText, true);
    setResults((r) => ({ ...r, [index]: { words, accuracy: null } }));
  }, [reading.status, reading.heardText, line, index]);

  // The take's recording is ready: Azure's word scores, laid over the marking.
  useEffect(() => {
    const uri = reading.audioUri;
    if (!uri || reading.status !== 'done' || !line || assessedUri.current === uri) return undefined;
    assessedUri.current = uri;
    const at = index;
    let alive = true;
    setScoring(true);
    assessPronunciation({ uri, type: 'audio/wav', name: `line-${at + 1}.wav` }, line.text)
      .then((scores) => {
        if (!alive) return;
        const azureWords = parseWordScores(scores?.wordsJson).map((w) => ({
          word: w.word,
          errorType: w.errorType,
          accuracy: w.score,
        }));
        setResults((r) => {
          const current = r[at];
          if (!current) return r;
          return { ...r, [at]: { words: withAzureVerdict(current.words, azureWords), accuracy: scores?.accuracyScore ?? null } };
        });
      })
      .catch(() => {
        // The phone's own marking stands; only the pronunciation scores are missing for this line.
        if (alive) showToast?.('Pronunciation scores could not be added for that line.', 'error');
      })
      .finally(() => {
        if (alive) setScoring(false);
      });
    return () => {
      alive = false;
    };
  }, [reading.audioUri, reading.status, line, index, showToast]);

  // A line marked — by the phone, then again with Azure's verdict: its character says each mistake's
  // word, once, so the mispronounced words Azure adds are said too.
  const current = results[index];
  useEffect(() => {
    if (current && !listening) correct(settledMistakes(current.words));
  }, [current, listening, correct]);

  const forget = (at) => {
    [noticed.current, spoken.current].forEach((set) =>
      [...set].filter((id) => id.startsWith(`${at}:`)).forEach((id) => set.delete(id)),
    );
  };

  const read = () => {
    stopVoice();
    setNotice('');
    finalisedFor.current = null;
    assessedUri.current = null;
    forget(index);
    setResults((r) => {
      const next = { ...r };
      delete next[index];
      return next;
    });
    startReading(line.text);
  };

  const hear = () => {
    if (line) speakAs(who, line.text, line.text);
  };

  const go = (to) => {
    stopVoice();
    resetReading();
    setNotice('');
    finalisedFor.current = null;
    setIndex(to);
  };

  const finish = async () => {
    setSaving(true);
    try {
      const payload = lines.map((l, i) => ({
        index: i,
        accuracy: results[i]?.accuracy ?? null,
        words: (results[i]?.words || alignWords(l.text, '', true).words).map((w) => ({
          word: clean(w.display),
          state: w.state,
        })),
      }));
      setSummary(await shreyaEnglish.submitSpeaking(data.chapterId, payload));
    } catch (e) {
      setNotice(e?.message || 'Could not save your reading.');
    } finally {
      setSaving(false);
    }
  };

  if (!lines.length) {
    return (
      <StudentCard>
        <Text style={styles.body}>
          This chapter&apos;s Speaking Challenge isn&apos;t ready yet. Please check back soon!
        </Text>
      </StudentCard>
    );
  }

  if (summary) {
    return (
      <StudentCard>
        <Text style={styles.summaryTitle}>Well done! 🎉</Text>
        <Text style={styles.summaryScore}>
          {summary.wordsCorrect} of {summary.wordsTotal} words read well ({summary.percent}%)
        </Text>
        {summary.mistakes > 0 ? <Text style={styles.body}>{summary.mistakes} words to practise.</Text> : null}
        <Text style={styles.body}>Your best so far: {summary.bestPercent}%</Text>
        <View style={styles.actions}>
          <Button
            styles={styles}
            label="Try again"
            onPress={() => {
              setSummary(null);
              setResults({});
              noticed.current.clear();
              spoken.current.clear();
              go(0);
            }}
          />
        </View>
      </StudentCard>
    );
  }

  const shown =
    current?.words || live?.words || alignWords(line.text, '').words.map((w) => ({ ...w, state: 'PENDING' }));
  const activeKeys = line.chorus ? STUDENT_KEYS : [line.character];
  const lineColour = (castByKey[line.character] || castByKey.SONIA)?.colour || SLATE[300];
  const statusNote = {
    unavailable: 'Voice checking isn’t available on this phone. Please try later.',
    denied: 'Please allow the microphone so Shreya can hear you read.',
    error: reading.error,
  }[reading.status];

  return (
    <View>
      <View style={styles.cast} accessibilityLabel="The characters">
        {(data.cast || []).map((c) => (
          <CharacterCard
            key={c.key}
            character={c}
            band={data.band}
            speaking={speaker?.key === c.key || (listening && activeKeys.includes(c.key))}
            bubble={speaker?.key === c.key ? speaker.bubble : ''}
          />
        ))}
      </View>

      <View style={[styles.lineCard, { borderColor: lineColour }]}>
        <Text style={styles.meta}>
          Line {index + 1} of {lines.length} · <Text style={styles.metaName}>{line.speaker}</Text>
          {line.chorus ? ' (everyone together)' : ''}
        </Text>
        <Text style={styles.line} accessibilityLiveRegion="polite">
          {shown.map((w, i) => (
            <Text key={i} style={WORD_TINT[w.state]}>
              {w.display}{' '}
            </Text>
          ))}
        </Text>
        {listening ? (
          <View style={styles.listeningRow}>
            <Ionicons name="mic" size={16} color={RECORDING} />
            <Text style={styles.listeningText}>Listening… read the line aloud</Text>
          </View>
        ) : null}
        {scoring ? <Text style={styles.meta}>Checking your pronunciation…</Text> : null}
        {notice ? (
          <View style={styles.notice} accessibilityRole="alert">
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
        {statusNote ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{statusNote}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button styles={styles} ghost label="Hear it" icon="play" onPress={hear} disabled={listening} palette={palette} />
          {listening ? (
            <Button styles={styles} label="Done" icon="stop" onPress={stopReading} stop />
          ) : (
            <Button
              styles={styles}
              label={current ? 'Read again' : 'Read it'}
              icon="mic"
              onPress={read}
              disabled={scoring}
            />
          )}
        </View>
        <View style={styles.actions}>
          <Button
            styles={styles}
            ghost
            label="Previous"
            onPress={() => go(index - 1)}
            disabled={index === 0 || listening}
            palette={palette}
          />
          {index < lines.length - 1 ? (
            <Button
              styles={styles}
              ghost
              label="Next line"
              onPress={() => go(index + 1)}
              disabled={listening}
              palette={palette}
            />
          ) : (
            <Button styles={styles} label={saving ? 'Saving…' : 'Finish'} onPress={finish} disabled={listening || saving} />
          )}
        </View>
      </View>

      <StudentCard>
        {lines.map((l, i) => {
          const r = results[i];
          const ok = r && r.words.every((w) => w.state === READ);
          return (
            <Pressable
              key={i}
              onPress={() => go(i)}
              disabled={listening}
              style={({ pressed }) => [styles.scriptRow, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons
                name={r ? (ok ? 'checkmark-circle' : 'alert-circle') : 'ellipse-outline'}
                size={16}
                color={r ? (ok ? FEEDBACK.successText : FEEDBACK.errorText) : SLATE[400]}
              />
              <Text style={[styles.scriptText, i === index && styles.scriptCurrent]}>
                {/* The script list, not the line being read: its vocabulary in category colours. */}
                <Text style={styles.metaName}>{l.speaker}:</Text> <VocabText text={l.text} vocabulary={data.vocabulary} />
              </Text>
            </Pressable>
          );
        })}
      </StudentCard>
    </View>
  );
}

function Button({ styles, label, icon, onPress, disabled, ghost, stop, palette }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        ghost && styles.btnGhost,
        stop && styles.btnStop,
        disabled && styles.btnDisabled,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      {icon ? <Ionicons name={icon} size={16} color={ghost ? palette?.deep : '#ffffff'} /> : null}
      <Text style={[styles.btnText, ghost && styles.btnGhostText]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((p) => ({
  body: { fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body) },
  cast: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingTop: 56,
    marginBottom: SPACING.md,
  },
  lineCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: SPACING.md,
    backgroundColor: '#ffffff',
    marginBottom: SPACING.md,
  },
  meta: { fontSize: TYPE.caption, color: SLATE[600] },
  metaName: { fontWeight: '700', color: SLATE[800] },
  line: {
    fontSize: TYPE.headline,
    lineHeight: leading(TYPE.headline),
    color: SLATE[700],
    marginVertical: SPACING.sm,
  },
  listeningRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listeningText: { fontSize: TYPE.label, fontWeight: '600', color: RECORDING },
  notice: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 10,
    backgroundColor: FEEDBACK.errorBg,
    borderWidth: 1,
    borderColor: FEEDBACK.errorBorder,
  },
  noticeText: { fontSize: TYPE.label, fontWeight: '600', color: FEEDBACK.errorText },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: p.primary,
  },
  btnGhost: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: SLATE[200] },
  btnStop: { backgroundColor: RECORDING },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: TYPE.label, fontWeight: '700', color: p.onPrimary },
  btnGhostText: { color: SLATE[700] },
  summaryTitle: { fontSize: TYPE.title, fontWeight: '800', color: SLATE[800] },
  summaryScore: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800], marginVertical: SPACING.sm },
  scriptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, paddingVertical: 6 },
  scriptText: { flex: 1, fontSize: TYPE.label, color: SLATE[600], lineHeight: leading(TYPE.label) },
  scriptCurrent: { color: SLATE[800], fontWeight: '600' },
  pressed: { opacity: 0.78 },
}));
