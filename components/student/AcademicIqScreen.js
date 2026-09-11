import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import StudentScaffold from './StudentScaffold';
import { StudentCard } from './StudentCard';

/**
 * Academic IQ — the landing page. Four areas, exactly as the web's hub has them.
 *
 * The web version renders a `description` that its `sections` array never defines, so the card
 * subtitle is always blank there. Ported with real subtitles instead: on a phone, four unlabelled
 * cards give the student nothing to choose between.
 *
 * ── WHY THERE IS NO TEACHER'S RESOURCES CARD HERE ───────────────────────────
 * There used to be a fifth card for it, and it was the one thing this hub had that the web's does
 * not (frontendmain/src/student/platform/AcademicIQ/AcademicIQ.js lists exactly these four). On the
 * web, Teacher's Resources is a GLOBAL control — one of the three buttons in the floating rail that
 * App.js mounts over every /student/platform route — not an Academic IQ section. The mobile port
 * already gave that rail a home, in My Workspace (`STUDENT_TEACHER_LINKS` in constants/studentMenu),
 * so the card here was a second door to the same screen. It is still reachable from My Workspace and
 * from search; nothing was orphaned by removing it.
 */

const SECTIONS = [
  {
    key: 'personalized',
    // Named for what the website calls it. It was briefly "My Selected Topics" — accurate, but a
    // mobile-only coinage, and the whole point of the entry is that it is the same feature the web
    // shows under this name.
    //
    // THE COLLISION THIS CREATES, AND WHY IT IS SURVIVABLE: the panel also has a
    // "Teacher-Assigned Resources" screen in My Workspace which reads
    // /api/students/personali_S_ed-resources, one letter away from this card's
    // /api/students/personali_Z_ed-resources — two different features. That screen used to be
    // called "Personalised Resources" too, which is exactly why it was renamed in the same change.
    // Do not rename it back. See services/studentApi.js for the endpoint pair's full warning.
    title: 'Personalised Resources',
    // WAS "the subjects your teacher picked for you", which was simply untrue — this endpoint reads
    // the student's own Academic IQ profile selections and no teacher touches it. The mislabel is
    // what made a working screen read as a broken one.
    subtitle: 'The subjects, chapters and topics you chose in your Academic IQ profile.',
    icon: 'person-circle-outline',
    route: '/student/academic-iq-resources?source=personalized',
  },
  {
    key: 'school',
    title: 'School Resources',
    subtitle: 'Your whole class syllabus, subject by subject.',
    icon: 'library-outline',
    route: '/student/academic-iq-resources?source=school',
  },
  {
    key: 'practice',
    title: 'Practice Zone',
    subtitle: 'Practise a topic, then take an adaptive assessment.',
    icon: 'barbell-outline',
    route: '/student/practice-zone',
  },
  {
    key: 'competitive',
    title: 'Competitive Exam',
    subtitle: 'Resources, practice and mock tests for entrance exams.',
    icon: 'trophy-outline',
    route: '/student/competitive-exam',
  },
];

export default function AcademicIqScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();

  return (
    <StudentScaffold title="Academic IQ">
      {/* No longer mentions "your teacher's picks": that phrase described the Teacher's Resources
          card, which now lives only in My Workspace. */}
      <Text style={styles.intro}>
        Everything for your syllabus in one place — the topics you chose, your school&apos;s
        resources, practice, and competitive exam prep.
      </Text>

      {SECTIONS.map((s) => (
        <Pressable
          key={s.key}
          onPress={() => router.push(s.route)}
          style={({ pressed }) => [pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={s.title}
        >
          <StudentCard>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name={s.icon} size={20} color={palette.deep} />
              </View>
              <View style={styles.text}>
                <Text style={styles.title}>{s.title}</Text>
                <Text style={styles.subtitle}>{s.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.deep} />
            </View>
          </StudentCard>
        </Pressable>
      ))}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  intro: { fontSize: TYPE.label, color: SLATE[600], lineHeight: leading(TYPE.label), marginBottom: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  text: { flex: 1 },
  title: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  subtitle: { fontSize: TYPE.label, color: SLATE[500], lineHeight: leading(TYPE.label), marginTop: 2 },
  pressed: { opacity: 0.78 },
}));
