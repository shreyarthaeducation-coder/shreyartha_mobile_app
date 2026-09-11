import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * The recording controls for one student's turn.
 *
 * Native port of the web's `RecorderBar`, and it keeps that component's central decision: it
 * DEGRADES RATHER THAN DISAPPEARS. When the microphone is refused, or the server has no
 * transcription configured, the bar stays and says what is still true — the counsellor writes
 * their own notes and the AI works from those instead. Hiding it leaves somebody waiting for a
 * recorder that is never going to appear.
 *
 * ── NO SPEAKER TOGGLE, DELIBERATELY ─────────────────────────────────────────
 * The web had a Counsellor/Student switch and removed it: one tap per change of speaker, for a
 * whole session, while talking to a child. A block in which both spoke carried one label, and a
 * confidently wrong label is what puts a counsellor's own question into a permanent record as the
 * student's answer. Every recording is sent as UNKNOWN and the model works out who is speaking
 * from the words.
 */
export default function RecorderBar({
  recorder,
  sttAvailable,
  consentObtained,
  onStart,
  onStop,
  disabled,
  disabledReason,
}) {
  const styles = useStyles();
  const palette = usePalette();

  const {
    recording, supported, error, elapsedSeconds, remainingSeconds, nearingCap,
    uploading, uploaded, failed,
  } = recorder;

  const blocked = disabled || !supported || !consentObtained;
  const clock = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={[styles.wrap, recording && styles.wrapRecording]}>
      <View style={styles.row}>
        {recording ? (
          <Pressable
            onPress={onStop}
            disabled={uploading}
            style={({ pressed }) => [styles.btn, styles.btnStop, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Stop recording"
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="stop" size={18} color="#ffffff" />
            )}
            <Text style={styles.btnText}>{uploading ? 'Saving…' : 'Stop recording'}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onStart}
            disabled={blocked || uploading}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: palette.primary },
              (blocked || uploading) && styles.btnDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={blocked ? disabledReason || 'Recording unavailable' : 'Start recording'}
          >
            <Ionicons name="mic" size={18} color="#ffffff" />
            <Text style={styles.btnText}>Record</Text>
          </Pressable>
        )}

        {recording ? (
          <View style={styles.clockWrap}>
            <Text style={styles.clock}>{clock(elapsedSeconds)}</Text>
            {/* The countdown appears only near the end. Showing "39:12 left" from the first second
                turns a conversation into a timed exercise; showing nothing at all means the
                auto-stop arrives as a surprise mid-sentence. */}
            {nearingCap ? (
              <Text style={styles.clockWarn}>{clock(remainingSeconds)} left</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.note}>
        {error ? (
          <Text style={styles.warn}>{error}</Text>
        ) : !consentObtained ? (
          <Text style={styles.warn}>
            Record consent for this session before using the microphone.
          </Text>
        ) : blocked ? (
          <Text style={styles.warn}>{disabledReason}</Text>
        ) : !sttAvailable ? (
          <Text style={styles.warn}>
            Audio is saved but not transcribed on this server, so the AI will work from your typed
            notes. Recording is still worth doing — it is kept with the session.
          </Text>
        ) : recording ? (
          <Text style={styles.body}>
            {nearingCap
              ? 'The recording will stop automatically — start drawing the conversation to a close.'
              : 'Recording. The audio is uploaded when you stop.'}
          </Text>
        ) : uploaded > 0 || failed > 0 ? (
          <Text style={failed > 0 ? styles.warn : styles.body}>
            {failed > 0
              ? 'The recording could not be saved. Write your notes below — the AI works from those.'
              : 'Recording saved. It is transcribed and used to write the Griffin section.'}
          </Text>
        ) : (
          <Text style={styles.body}>
            Recorded audio is transcribed and used to write the Griffin section.
          </Text>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  wrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  // A recording in progress must be obvious across a room, not a subtle state on one button.
  wrapRecording: { borderColor: FEEDBACK.errorBorder, backgroundColor: FEEDBACK.errorBg },

  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: TOUCH.min,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
  },
  btnStop: { backgroundColor: FEEDBACK.errorText },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },

  clockWrap: { flex: 1, alignItems: 'flex-end' },
  clock: { fontSize: TYPE.title, fontWeight: '800', color: SLATE[800], fontVariant: ['tabular-nums'] },
  clockWarn: { fontSize: TYPE.caption, fontWeight: '700', color: FEEDBACK.errorText },

  note: { marginTop: SPACING.sm },
  body: { fontSize: TYPE.caption, color: SLATE[500], lineHeight: leading(TYPE.caption) },
  warn: { fontSize: TYPE.caption, color: FEEDBACK.warningOnBg, lineHeight: leading(TYPE.caption) },

  pressed: { opacity: 0.8 },
}));
