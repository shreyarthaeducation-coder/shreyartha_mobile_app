import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
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
 */

const SECTIONS = [
  {
    key: 'personalized',
    title: 'Personalized Resources',
    subtitle: 'The subjects, chapters and topics your teacher picked for you.',
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
      <Text style={styles.intro}>
        Everything for your syllabus in one place — your teacher&apos;s picks, your school&apos;s
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
              <Ionicons name="chevron-forward" size={16} color={palette.deep} />
            </View>
          </StudentCard>
        </Pressable>
      ))}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  intro: { fontSize: TYPE.label, color: p.onDark, lineHeight: 19, marginBottom: SPACING.md },
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
  subtitle: { fontSize: TYPE.label, color: SLATE[500], lineHeight: 17, marginTop: 2 },
  pressed: { opacity: 0.78 },
}));
