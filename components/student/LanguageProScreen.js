import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { useToast } from '../ui';
import StudentScaffold from './StudentScaffold';
import { StudentCard } from './StudentCard';
import LimitedAccessNote from './LimitedAccessNote';
import useStudentAccess from '../../hooks/useStudentAccess';
import { fetchStudentClass } from '../../services/student/languageProService';

/**
 * Language Pro — the landing page.
 *
 * ── THREE CARDS, MATCHING THE WEBSITE ────────────────────────────────────────
 * `LanguagePro.js` renders exactly three, and this screen previously rendered none of them: it
 * dropped the student straight into the curriculum tree, so Personalized Resources and the
 * school/college distinction had no entry point at all.
 *
 *   1. Personalized Resources  "(Based on Your English Level)"  — HIDDEN for college students
 *   2. School Resources        — relabelled "College Resources" for a college student
 *   3. Communicative English   "(Learn with Shreya 🗣️)"
 *
 * ── SOUND STUDIO IS DELIBERATELY ABSENT ──────────────────────────────────────
 * On the web it is entered from a banner ABOVE the A1-A5 tiles inside the Learn with Shreya level
 * map, placed outside `tree.map()` so it reads no `unlocked` flag and can never be level-gated —
 * "globally accessible regardless of the level of the student". A card here would both duplicate
 * that entry and contradict "the landing stays at three cards". A previous pass added one; it was
 * removed for exactly this reason. Do not add it back.
 */

export default function LanguageProScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const { toast } = useToast();
  const gate = useStudentAccess('LANGUAGE_PRO');

  const [isCollege, setIsCollege] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // The profile only decides LABELS and which cards show, so a failure must not block the page.
    // Defaulting to "school" is the safer read: it shows one card too many, never one too few.
    try {
      const who = await fetchStudentClass();
      setIsCollege(!!who?.isCollege);
    } catch {
      setIsCollege(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cards = [
    {
      key: 'personalized',
      icon: 'person-outline',
      title: 'Personalized Resources',
      subtitle: 'Based on Your English Level',
      note: 'Chosen for the skills you are still building.',
      // The web guards this with `!isCollegeStudent()` — a college student has no class to step
      // down from, so the level-matched set is meaningless for them.
      hidden: isCollege,
      to: '/student/language-pro-resources?source=personalized',
    },
    {
      key: 'school',
      icon: 'library-outline',
      title: isCollege ? 'College Resources' : 'School Resources',
      subtitle: 'Your full syllabus',
      note: 'Listen, Read & Speak, Write and Grammar activities for every chapter.',
      to: '/student/language-pro-resources?source=school',
    },
    {
      key: 'shreya',
      icon: 'chatbubbles-outline',
      title: 'Communicative English',
      subtitle: 'Learn with Shreya 🗣️',
      note: 'Spoken English, level by level, with Shreya.',
      to: '/student/learn-with-shreya',
    },
  ].filter((c) => !c.hidden);

  return (
    <StudentScaffold title="Language Pro" loading={loading || gate.loading} toast={toast}>
      {gate.limited && !gate.loading ? <LimitedAccessNote /> : null}

      {/* The web's tagline, under the title. StudentScaffold takes no subtitle and adding one
          would change the chrome of every student screen for a single line here. */}
      <Text style={styles.tagline}>Where Confidence Meets Communication</Text>

      {cards.map((card) => (
        <Pressable
          key={card.key}
          onPress={() => router.push(card.to)}
          style={({ pressed }) => [pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${card.title}. ${card.subtitle}`}
        >
          <StudentCard>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name={card.icon} size={21} color={palette.deep} />
              </View>
              <View style={styles.body}>
                <Text style={styles.title}>{card.title}</Text>
                <Text style={styles.subtitle}>{card.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={palette.deep} />
            </View>
            <Text style={styles.note}>{card.note}</Text>
          </StudentCard>
        </Pressable>
      ))}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  tagline: {
    fontSize: TYPE.body,
    fontWeight: '600',
    color: SLATE[600],
    marginBottom: SPACING.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  body: { flex: 1 },
  title: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  subtitle: { fontSize: TYPE.label, fontWeight: '600', color: p.deep, marginTop: 2 },
  note: { fontSize: TYPE.label, color: SLATE[500], lineHeight: leading(TYPE.label), marginTop: SPACING.sm },
  pressed: { opacity: 0.78 },
}));
