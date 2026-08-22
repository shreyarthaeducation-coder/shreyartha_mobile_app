import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import AdaptiveRunner from './AdaptiveRunner';
import useAdaptiveSession from '../../../hooks/useAdaptiveSession';
import {
  ADAPTIVE_TOTAL_QUESTIONS,
  REFLECTION_OPTIONS,
  accuracyToReflectionOption,
  adaptiveEngine,
  submitReflection,
} from '../../../services/student/academicIqService';

/**
 * My Reflection — how well does the student feel they know this topic?
 *
 * Two routes to the same record:
 *   direct      — pick one of the four levels yourself
 *   assessment  — take the 12-question adaptive test and let the accuracy choose the level
 *
 * The adaptive half runs through `useAdaptiveSession`, which owns the four guards from the
 * repeat-question saga. This screen is where those guards originally lived on the web.
 *
 * The result AUTO-SAVES once the assessment completes — the student never presses save. That is
 * deliberate: the reflection level feeds My Analytics' Learning Gaps, and a student who closes the
 * summary would otherwise silently lose it. A failed save is surfaced with a retry rather than
 * swallowed.
 */

export default function MyReflection({ topicId, topicName, showToast }) {
  const styles = useStyles();
  const palette = usePalette();

  const [mode, setMode] = useState('direct'); // direct | assessment
  const [selected, setSelected] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [lastAccuracy, setLastAccuracy] = useState(null);

  const persist = useCallback(
    async (option) => {
      setSaveState('saving');
      try {
        await submitReflection(topicId, option);
        setSelected(option);
        setSaveState('saved');
      } catch (e) {
        setSaveState('error');
        showToast?.(e?.message || "Couldn't save your reflection.", 'error');
      }
    },
    [topicId, showToast],
  );

  // Called exactly once per completed attempt by the hook.
  const onFinish = useCallback(
    (summary) => {
      setLastAccuracy(summary.accuracyPercentage);
      persist(accuracyToReflectionOption(summary.accuracyPercentage));
    },
    [persist],
  );

  const engine = useAdaptiveSession({
    ...adaptiveEngine(topicId),
    total: ADAPTIVE_TOTAL_QUESTIONS,
    onFinish,
  });

  if (mode === 'assessment' && engine.phase !== 'idle') {
    return (
      <AdaptiveRunner
        session={engine}
        title="Learning Insights Test"
        subtitle={topicName}
        onExit={() => {
          engine.leave();
          setMode('direct');
        }}
        footer={
          engine.phase === 'summary' ? (
            <StudentCard>
              <StudentCardTitle>Your reflection level</StudentCardTitle>
              {saveState === 'saving' ? (
                <ActivityIndicator color={palette.primary} style={styles.loader} />
              ) : selected ? (
                <>
                  <Text style={[styles.levelName, { color: selected.color }]}>{selected.level}</Text>
                  <Text style={styles.levelText}>{selected.text}</Text>
                  <Text style={styles.levelDesc}>{selected.description}</Text>
                  <Text style={styles.saved}>
                    {saveState === 'saved' ? 'Saved to your analytics.' : ''}
                  </Text>
                </>
              ) : null}
              {saveState === 'error' ? (
                <Pressable
                  onPress={() => persist(accuracyToReflectionOption(lastAccuracy))}
                  style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.retryText}>Retry save</Text>
                </Pressable>
              ) : null}
            </StudentCard>
          ) : null
        }
      />
    );
  }

  return (
    <>
      <StudentCard>
        <StudentCardTitle>My Reflection</StudentCardTitle>
        <Text style={styles.intro}>
          How well do you know this topic? Choose the level that fits, or take a short adaptive test
          and let your accuracy decide.
        </Text>

        {REFLECTION_OPTIONS.map((option) => {
          const on = selected?.id === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setSelected(option)}
              style={({ pressed }) => [
                styles.option,
                on && { borderColor: option.color, backgroundColor: `${option.color}14` },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <View style={[styles.dot, { backgroundColor: option.color }]} />
              <View style={styles.optionBody}>
                <Text style={styles.optionLevel}>{option.level}</Text>
                <Text style={styles.optionText}>{option.text}</Text>
              </View>
            </Pressable>
          );
        })}
      </StudentCard>

      <Pressable
        onPress={() => selected && persist(selected)}
        disabled={!selected || saveState === 'saving'}
        style={({ pressed }) => [
          styles.primary,
          (!selected || saveState === 'saving') && styles.primaryOff,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
      >
        {saveState === 'saving' ? (
          <ActivityIndicator size="small" color={palette.onPrimary} />
        ) : (
          <Text style={styles.primaryText}>
            {saveState === 'saved' ? 'Saved — update' : 'Save my reflection'}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setMode('assessment');
          engine.begin();
        }}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryText}>
          Not sure? Take the {ADAPTIVE_TOTAL_QUESTIONS}-question test instead
        </Text>
      </Pressable>

      {engine.error && mode === 'assessment' ? (
        <Text style={styles.error}>{engine.error}</Text>
      ) : null}
    </>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.md },
  intro: { fontSize: TYPE.label, color: SLATE[600], lineHeight: 19, marginBottom: SPACING.sm },

  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 11,
    marginTop: 7,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: SLATE[200],
    backgroundColor: SLATE[100],
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  optionBody: { flex: 1 },
  optionLevel: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[800] },
  optionText: { fontSize: TYPE.label, color: SLATE[600], lineHeight: 18, marginTop: 2 },

  levelName: { fontSize: TYPE.headline, fontWeight: '800' },
  levelText: { fontSize: TYPE.body, color: SLATE[700], lineHeight: 19, marginTop: 3 },
  levelDesc: { fontSize: TYPE.label, color: SLATE[500], lineHeight: 18, marginTop: 4 },
  saved: { fontSize: TYPE.caption, color: FEEDBACK.successText, fontWeight: '700', marginTop: 6 },

  primary: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.sm,
  },
  primaryOff: { backgroundColor: SLATE[400] },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  secondary: {
    alignSelf: 'center',
    marginBottom: SPACING.lg,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  secondaryText: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },
  retry: {
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: p.primary,
  },
  retryText: { fontSize: TYPE.label, fontWeight: '700', color: p.onPrimary },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, textAlign: 'center', marginBottom: SPACING.md },

  pressed: { opacity: 0.78 },
}));
