import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import {
  ENGLISH_SKILLS,
  MAX_SKILLS,
  RATING_LEVELS,
  canAddSkill,
  canAddTopic,
  maxTopicsPerSkill,
} from '../../../constants/profileRules';
import {
  fetchSkillsProfile,
  fetchSkillsTree,
  saveSkillsProfile,
} from '../../../services/student/careerService';

/**
 * Profile → Skills Edge.
 *
 * Mirrors `frontendmain/src/student/platform/profile/SkillsEdge.js`.
 *
 * ── THIS TAB USED TO DESTROY DATA ───────────────────────────────────────────
 * It rendered `importantSkills` alone and saved `{ importantSkills }`. `/api/skills/profile`
 * REPLACES the record, so every save silently wiped `selectedTopics`, `englishCommunication` and
 * `isRelatedToJob` — including values set on the website. Nothing errored.
 *
 * So the whole profile is now loaded, edited and saved together, and `saveSkillsProfile` demands
 * the whole object rather than accepting a bare list.
 *
 * ── THE CAPS ARE THE POINT OF THE SCREEN ────────────────────────────────────
 * Max 2 skills; then **2 skills → 1 topic each, 1 skill → up to 2**, and never more than 2 topics
 * in total. This tab drives Skills Edge's whole content selection, so a missing cap is not cosmetic:
 * it lets a student select more than the platform will ever show them.
 *
 * `selectedTopics` is keyed by skill **NAME** and holds topic **IDs** — a genuine asymmetry in the
 * stored shape, not a mistake to tidy up.
 *
 * The tab **locks once saved**, as the web does.
 */
export default function SkillsTab({ showToast }) {
  const styles = useStyles();
  const palette = usePalette();

  const [tree, setTree] = useState([]);
  const [skills, setSkills] = useState([]);
  const [topics, setTopics] = useState({});
  const [english, setEnglish] = useState({});
  const [relatedToJob, setRelatedToJob] = useState(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // The tree and the profile are independent: a student with no saved skills still needs the
    // options, and a tree failure should not hide what they already picked.
    const [treeRes, profileRes] = await Promise.allSettled([fetchSkillsTree(), fetchSkillsProfile()]);

    if (treeRes.status === 'fulfilled') setTree(treeRes.value || []);

    if (profileRes.status === 'fulfilled' && profileRes.value) {
      const p = profileRes.value;
      setSkills(p.importantSkills || []);
      setTopics(p.selectedTopics || {});
      setEnglish(p.englishCommunication || {});
      // Carried through untouched. It is no longer rendered on either client, but it is still
      // stored — and dropping it on save was part of the data loss above.
      setRelatedToJob(p.isRelatedToJob ?? null);
      setExists((p.importantSkills || []).length > 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const locked = exists;

  const toggleSkill = (name) => {
    if (locked) return;
    setSkills((prev) => {
      if (prev.includes(name)) {
        // Unticking a skill drops its topics too — otherwise they would be saved against a skill
        // the student no longer has, and count towards the 2-topic total invisibly.
        setTopics((t) => {
          const next = { ...t };
          delete next[name];
          return next;
        });
        return prev.filter((s) => s !== name);
      }
      if (!canAddSkill(prev)) {
        showToast?.(`You can select a maximum of ${MAX_SKILLS} skills.`, 'error');
        return prev;
      }
      return [...prev, name];
    });
  };

  const toggleTopic = (skillName, topicId) => {
    if (locked) return;
    const current = topics[skillName] || [];
    if (current.includes(topicId)) {
      setTopics((t) => ({ ...t, [skillName]: current.filter((id) => id !== topicId) }));
      return;
    }
    const error = canAddTopic(topics, skillName, skills.length);
    if (error) {
      showToast?.(error, 'error');
      return;
    }
    setTopics((t) => ({ ...t, [skillName]: [...current, topicId] }));
  };

  const submit = async () => {
    if (skills.length === 0) {
      showToast?.('Please select at least one important skill.', 'error');
      return;
    }
    setSaving(true);
    try {
      // The WHOLE profile — see the header. Passing only `skills` is what destroyed the rest.
      await saveSkillsProfile(
        {
          importantSkills: skills,
          selectedTopics: topics,
          englishCommunication: english,
          isRelatedToJob: relatedToJob,
        },
        exists,
      );
      setExists(true);
      showToast?.('Saved.', 'success');
    } catch (e) {
      showToast?.(e?.message || 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
  }

  const perSkill = maxTopicsPerSkill(skills.length);

  return (
    <>
      <StudentCard>
        <StudentCardTitle>Important skills</StudentCardTitle>
        <Text style={styles.hint}>
          {locked ? 'Selections locked' : `Select up to ${MAX_SKILLS}`}
        </Text>
        <View style={styles.chips}>
          {tree.map((node) => {
            const name = node?.name || node?.title || node?.skillName;
            if (!name) return null;
            const on = skills.includes(name);
            return (
              <Pressable
                key={node.id ?? name}
                onPress={() => toggleSkill(name)}
                disabled={locked}
                style={({ pressed }) => [
                  styles.chip,
                  on && styles.chipOn,
                  locked && styles.dim,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: locked }}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{name}</Text>
              </Pressable>
            );
          })}
        </View>
      </StudentCard>

      {/* One topic picker per chosen skill. The heading states the rule, because "why can't I tick
          this?" is the question the cap raises. */}
      {skills.map((name) => {
        const node = tree.find((n) => (n?.name || n?.title || n?.skillName) === name);
        const chosen = topics[name] || [];
        return (
          <StudentCard key={`t-${name}`}>
            <StudentCardTitle>{name}</StudentCardTitle>
            <Text style={styles.hint}>
              {perSkill === 1
                ? `Pick 1 topic for "${name}" (2 topics total allowed)`
                : `Pick up to ${perSkill} topics for "${name}"`}
            </Text>
            <View style={styles.chips}>
              {(node?.topics || []).map((t) => {
                const on = chosen.includes(t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => toggleTopic(name, t.id)}
                    disabled={locked}
                    style={({ pressed }) => [
                      styles.chip,
                      on && styles.chipOn,
                      locked && styles.dim,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: locked }}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </StudentCard>
        );
      })}

      <StudentCard>
        <StudentCardTitle>English communication</StudentCardTitle>
        {ENGLISH_SKILLS.map((skill) => (
          <View key={skill} style={styles.matrixRow}>
            <Text style={styles.matrixLabel}>{skill}</Text>
            <View style={styles.matrixOptions}>
              {RATING_LEVELS.map((level) => {
                const on = english[skill] === level;
                return (
                  <Pressable
                    key={level}
                    onPress={() => !locked && setEnglish((e) => ({ ...e, [skill]: level }))}
                    disabled={locked}
                    style={({ pressed }) => [
                      styles.level,
                      on && styles.levelOn,
                      locked && styles.dim,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: locked }}
                  >
                    <Text style={[styles.levelText, on && styles.levelTextOn]}>{level}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </StudentCard>

      <Pressable
        onPress={submit}
        disabled={saving || locked}
        style={({ pressed }) => [
          styles.primary,
          (saving || locked) && styles.primaryOff,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
      >
        {locked ? <Ionicons name="lock-closed" size={15} color="#ffffff" /> : null}
        <Text style={styles.primaryText}>
          {locked ? 'Selections Saved' : saving ? 'Saving…' : 'Save Skills Edge'}
        </Text>
      </Pressable>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },
  hint: { fontSize: TYPE.label, color: SLATE[500], lineHeight: 18, marginBottom: SPACING.sm },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: SLATE[200],
    minHeight: TOUCH.min,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: p.tint, borderColor: p.primary },
  chipText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[700] },
  chipTextOn: { color: p.deep, fontWeight: '700' },

  matrixRow: { marginTop: SPACING.sm },
  matrixLabel: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700], marginBottom: 5 },
  matrixOptions: { flexDirection: 'row', gap: 7 },
  level: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  levelOn: { backgroundColor: p.tint, borderColor: p.primary },
  levelText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[600] },
  levelTextOn: { color: p.deep, fontWeight: '700' },

  dim: { opacity: 0.6 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  primaryOff: { backgroundColor: SLATE[300] },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  pressed: { opacity: 0.78 },
}));
