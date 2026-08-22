import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING } from '../../constants/theme';
import { usePalette } from './PaletteContext';
import { formatLongDate, parseLocalDateTime, toIsoDate, toLocalDateTimeString } from '../../utils/dates';

/**
 * Date + time field, emitting the backend's `LocalDateTime` string.
 *
 * Platform split is forced by the native pickers, not by preference: Android's dialog does date OR
 * time, never both, so picking a datetime there is two chained dialogs. iOS has a single `datetime`
 * spinner. Both paths converge on `toLocalDateTimeString`, which produces the only format
 * `FlexibleLocalDateTimeDeserializer` accepts — no `Z`, no offset, no fractional seconds.
 *
 * `value` and the `onChange` argument are that same string (or null when cleared).
 */

export default function DateTimeField({
  label,
  value,
  onChange,
  mode = 'datetime',
  placeholder = 'Not set',
  minimumDate,
  clearable = false,
  disabled = false,
  palette: paletteProp,
  helper,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  // 'date' | 'time' | null — on Android this walks date → time; on iOS it is a single step.
  const [step, setStep] = useState(null);
  // Holds the date half while the Android time dialog is open.
  const [draft, setDraft] = useState(null);

  const current = parseLocalDateTime(value);

  const open = () => {
    if (disabled) return;
    setDraft(current || defaultStart(minimumDate));
    setStep(mode === 'time' ? 'time' : 'date');
  };

  const handleAndroid = (event, picked) => {
    if (event.type !== 'set' || !picked) {
      setStep(null);
      setDraft(null);
      return;
    }
    if (step === 'date' && mode === 'datetime') {
      // Carry the chosen day forward and ask for the time.
      const base = draft || new Date();
      const next = new Date(picked);
      next.setHours(base.getHours(), base.getMinutes(), 0, 0);
      setDraft(next);
      setStep('time');
      return;
    }
    const base = draft || new Date();
    const next = new Date(base);
    if (step === 'time') next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
    else next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
    setStep(null);
    setDraft(null);
    onChange(toLocalDateTimeString(next));
  };

  const handleIos = (event, picked) => {
    if (!picked) return;
    setDraft(picked);
  };

  const confirmIos = () => {
    setStep(null);
    if (draft) onChange(toLocalDateTimeString(draft));
    setDraft(null);
  };

  const display = current
    ? mode === 'date'
      ? formatLongDate(toIsoDate(current))
      : `${formatLongDate(toIsoDate(current))} · ${timeLabel(current)}`
    : placeholder;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.row}>
        <Pressable
          onPress={open}
          disabled={disabled}
          style={({ pressed }) => [
            styles.field,
            disabled && styles.disabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${label || 'Date'}: ${display}`}
        >
          <Ionicons name="calendar-outline" size={17} color={SLATE[500]} />
          <Text style={[styles.value, !current && styles.placeholder]} numberOfLines={1}>
            {display}
          </Text>
        </Pressable>

        {clearable && current ? (
          <Pressable
            onPress={() => onChange(null)}
            disabled={disabled}
            hitSlop={8}
            style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label || 'date'}`}
          >
            <Ionicons name="close" size={17} color={SLATE[500]} />
          </Pressable>
        ) : null}
      </View>

      {helper ? <Text style={styles.helper}>{helper}</Text> : null}

      {step && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draft || new Date()}
          mode={step}
          is24Hour={false}
          minimumDate={step === 'date' ? minimumDate : undefined}
          onChange={handleAndroid}
        />
      ) : null}

      {step && Platform.OS !== 'android' ? (
        <View style={styles.iosWrap}>
          <DateTimePicker
            value={draft || new Date()}
            mode={mode}
            display="spinner"
            minimumDate={minimumDate}
            onChange={handleIos}
          />
          <View style={styles.iosActions}>
            <Pressable onPress={() => { setStep(null); setDraft(null); }} style={styles.iosBtn}>
              <Text style={styles.iosCancel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={confirmIos}
              style={[styles.iosBtn, { backgroundColor: palette.primaryDark }]}
            >
              <Text style={styles.iosDone}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Sensible starting point: the next whole hour, never before `minimumDate`. */
function defaultStart(minimumDate) {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  if (minimumDate && now < minimumDate) return new Date(minimumDate);
  return now;
}

function timeLabel(date) {
  const hours = date.getHours();
  const suffix = hours >= 12 ? 'pm' : 'am';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(date.getMinutes()).padStart(2, '0')} ${suffix}`;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  label: { fontSize: 13, fontWeight: '600', color: SLATE[700], marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: SLATE[200],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  value: { flex: 1, fontSize: 14.5, color: SLATE[900] },
  placeholder: { color: SLATE[400] },
  clearBtn: {
    width: 38,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: SLATE[100],
  },
  helper: { marginTop: 5, fontSize: 12, color: SLATE[500] },

  iosWrap: { marginTop: SPACING.sm, backgroundColor: SLATE[50], borderRadius: 12 },
  iosActions: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.sm },
  iosBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: SLATE[200],
  },
  iosCancel: { fontSize: 14, fontWeight: '700', color: SLATE[700] },
  iosDone: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
