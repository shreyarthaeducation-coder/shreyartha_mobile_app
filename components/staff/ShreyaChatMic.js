import { useEffect } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RECORDING, SLATE, TOUCH } from '../../constants/theme';
import { makeStyles } from '../../utils/makeStyles';
import useChatDictation from '../../hooks/useChatDictation';

const IDLE = { active: false, recording: false, transcribing: false, elapsed: 0, error: '' };

/**
 * 🎤 in the Shreya chat sheet's input row: speak the question instead of typing it.
 *
 * Its own component so the recorder (and the native AudioRecorder expo-audio creates the moment
 * useAudioRecorder mounts) exists only where a mic is offered — not in the Principal's sheet, and not
 * before free chat. It is mounted for the WHOLE of free chat and swaps its icon in place: the sheet
 * notes that unmounting a sibling of the focused input dismisses the Android keyboard.
 *
 * The transcript goes to `onTranscript` (the sheet fills its text box, for the user to check and
 * send — never auto-sent). Its state goes to `onStatus`, so the sheet can make the input read-only
 * and say "Listening…" in its placeholder, and disable the header's Shreya Speak while dictating.
 */
export default function ShreyaChatMic({ languageCode, disabled = false, onTranscript, onStatus }) {
  const styles = useStyles();
  const dictation = useChatDictation({ languageCode, onTranscript });
  const { recording, transcribing, elapsed, error, start, stop } = dictation;

  useEffect(() => {
    onStatus?.({ active: recording || transcribing, recording, transcribing, elapsed, error });
  }, [recording, transcribing, elapsed, error, onStatus]);

  // Leaving free chat (or the sheet closing, which unmounts the modal's content) must not leave the
  // sheet thinking a dictation is still running.
  useEffect(() => () => onStatus?.(IDLE), [onStatus]);

  const onPress = () => {
    if (recording) {
      stop();
      return;
    }
    start();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={transcribing || (disabled && !recording)}
      style={({ pressed }) => [
        styles.micBtn,
        recording && styles.micBtnRecording,
        (transcribing || (disabled && !recording)) && styles.micDisabled,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Stop listening' : 'Speak your question'}
      accessibilityState={{ busy: transcribing, selected: recording }}
    >
      {transcribing ? (
        <ActivityIndicator size="small" color={SLATE[600]} />
      ) : (
        <Ionicons name={recording ? 'stop' : 'mic'} size={20} color={recording ? '#ffffff' : SLATE[700]} />
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  micBtn: {
    width: TOUCH.min,
    height: TOUCH.min,
    borderRadius: TOUCH.min / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  micBtnRecording: { backgroundColor: RECORDING, borderColor: RECORDING },
  micDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
}));
