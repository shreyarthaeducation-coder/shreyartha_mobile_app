import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import WelcomeHeader from '../ui/WelcomeHeader';
import SectionProgressList from './welcome/SectionProgressList';
import {
  identitySubtitle,
  languageSkills,
  loadWelcomeProgress,
  sectionRows,
} from '../../services/student/welcomeService';

/**
 * The student welcome interstitial — shown once per session, over the dashboard.
 *
 * ── WHAT THIS IS A PORT OF ───────────────────────────────────────────────────
 * `frontendmain/src/student/platform/dashboard.js:120-137` — the web's `welcome-overlay`, gated on
 * `sessionStorage["welcomeShown"]`, carrying "Welcome to Future of Learning" and a Get Started
 * button. The mobile port originally dropped it on purpose (see the note in StudentHome) because a
 * pure gate is worse on a phone than on a desktop. It is back because it now carries the student's
 * own photo, class, stream and progress — content, not a splash.
 *
 * ── IT MUST NEVER BLOCK ──────────────────────────────────────────────────────
 * The identity block comes from the profile the dashboard has ALREADY fetched, so the copy, the
 * photo, the class/stream line and **Get Started** are on screen from the first frame. Only the
 * graph loads, and it loads underneath a button the student can already press. A welcome screen
 * that makes someone wait is the thing the original port was right to remove.
 *
 * ── EVERY BAR IS REAL ────────────────────────────────────────────────────────
 * See `services/student/welcomeService.js`: the analytics spine carries placeholder numbers that are
 * identical for every student, and none of them appear here. Language Lab has no percentage in the
 * API at all and is shown as level chips; Psychometric has no readable endpoint and is absent.
 */

export default function WelcomeScreen({ profile, onDismiss }) {
  const styles = useStyles();
  const palette = usePalette();

  const [rows, setRows] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  // The load outlives nothing — if the student presses Get Started first, the component unmounts
  // and a late `setState` would warn. `alive` is the usual guard.
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    (async () => {
      const { analytics, parts } = await loadWelcomeProgress();
      if (!aliveRef.current) return;
      setRows(sectionRows(analytics, parts));
      setSkills(languageSkills(analytics));
      setLoading(false);
    })();
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const open = useCallback(
    (row) => {
      // Dismiss first: the dashboard must be the screen underneath when the section pops back.
      onDismiss?.(row.route);
    },
    [onDismiss],
  );

  const name = profile?.fullName || profile?.name || profile?.email || 'Student';
  const subtitle = identitySubtitle(profile);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.hero}>Welcome to the Future of Learning</Text>

        <WelcomeHeader
          name={name}
          photoUrl={profile?.profilePicture}
          subtitle={subtitle || undefined}
          greeting="Welcome"
          style={styles.identity}
        />

        <Text style={styles.sectionTitle}>My progress</Text>
        <SectionProgressList rows={rows} loading={loading} onOpen={open} />

        {/* Language Lab is levels, not a percentage — see welcomeService's header. Hidden entirely
            when the student has no levels recorded, rather than shown as four "Not Set" chips. */}
        {skills.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Language</Text>
            <View style={styles.chips}>
              {skills.map(({ skill, level }) => (
                <View key={skill} style={styles.chip}>
                  <Text style={styles.chipSkill}>{skill}</Text>
                  <Text style={styles.chipLevel}>{level}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={() => onDismiss?.(null)}
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Get started"
      >
        <Text style={styles.ctaText}>Get Started</Text>
        <Ionicons name="arrow-forward" size={17} color={palette.onPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((p) => ({
  // Transparent: app/student/_layout.js paints the fixed background photograph behind the whole
  // Stack, and this screen is meant to sit ON it, not cover it with a flat colour.
  safe: { flex: 1 },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.md },

  hero: {
    fontSize: TYPE.display,
    lineHeight: 32,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  identity: { marginBottom: SPACING.lg },

  sectionTitle: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: p.onDark,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexGrow: 1,
    flexBasis: '46%',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: p.glass,
    borderWidth: 1,
    borderColor: p.glassBorder,
  },
  chipSkill: { fontSize: TYPE.caption, fontWeight: '700', color: '#ffffff' },
  chipLevel: { fontSize: TYPE.label, fontWeight: '800', color: p.onDark, marginTop: 2 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: p.primary,
  },
  ctaText: { fontSize: TYPE.heading, fontWeight: '800', color: p.onPrimary },
  pressed: { opacity: 0.8 },
}));
