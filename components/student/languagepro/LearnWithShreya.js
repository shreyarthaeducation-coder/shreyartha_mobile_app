import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DONE, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { useToast } from '../../ui';
import StudentScaffold from '../StudentScaffold';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import LevelMap from './LevelMap';
import PlacementAssessment from './PlacementAssessment';
import ShreyaChapterScreen from './ShreyaChapterScreen';
import { shreyaEnglish } from '../../../services/student/languageProService';

/**
 * Communicative English — Learn with Shreya.
 *
 * greeting → placement (once) → level map (A1–A5) → day tiles → chapters → chapter session.
 *
 * **Sound Studio is reached from the level map, not from here and not from the Language Pro
 * landing.** `LevelMap` renders it above the tiles, outside the level list, so it can never be
 * level-gated — see the note in that file.
 */

export default function LearnWithShreya() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const { toast, showToast } = useToast();

  const [profile, setProfile] = useState(null);
  const [tree, setTree] = useState(null);
  const [progress, setProgress] = useState(null);
  const [view, setView] = useState('loading'); // loading|greeting|placement|map|level|chapter|error
  const [activeLevel, setActiveLevel] = useState(null);
  const [activeDayId, setActiveDayId] = useState(null);
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [levelingUp, setLevelingUp] = useState(false);
  const [banner, setBanner] = useState('');
  const [error, setError] = useState('');

  const refreshData = useCallback(async () => {
    const [t, p] = await Promise.all([shreyaEnglish.tree(), shreyaEnglish.progress()]);
    setTree(t);
    setProgress(p);
  }, []);

  const load = useCallback(async () => {
    setView('loading');
    setError('');
    try {
      const prof = await shreyaEnglish.profile();
      setProfile(prof);
      // Placement runs ONCE — a student who has already placed goes straight to their map.
      if (!prof.placementDone) {
        setView('greeting');
        return;
      }
      await refreshData();
      setView('map');
    } catch (e) {
      setError(e?.message || 'Could not load Learn with Shreya.');
      setView('error');
    }
  }, [refreshData]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePlaced = useCallback(
    async (level) => {
      try {
        await refreshData();
        setProfile((p) => ({ ...p, placementDone: true, currentLevel: level }));
        setView('map');
      } catch (e) {
        setError(e?.message || 'Could not load your levels.');
        setView('error');
      }
    },
    [refreshData],
  );

  const handleLevelUp = useCallback(async () => {
    setLevelingUp(true);
    setBanner('');
    try {
      const res = await shreyaEnglish.levelUp();
      await refreshData();
      setBanner(`🎉 Congratulations — you've reached level ${res.newLevel}!`);
    } catch (e) {
      setBanner(e?.message || 'Not eligible yet.');
    }
    setLevelingUp(false);
  }, [refreshData]);

  const exitChapter = useCallback(async () => {
    setActiveChapterId(null);
    try {
      await refreshData();
    } catch {
      // Keep the old data rather than blanking the map over a refresh failure.
    }
    setView('level');
  }, [refreshData]);

  const levelNode = (tree || []).find((l) => l.level === activeLevel);
  const activeDay = levelNode?.days?.find((d) => d.id === activeDayId);

  /* ── Bodies ──────────────────────────────────────────────────────────── */

  const renderGreeting = () => (
    <StudentCard>
      <StudentCardTitle>Hello — I&apos;m Shreya</StudentCardTitle>
      <Text style={styles.body}>
        We&apos;ll practise speaking English together, one short chapter at a time. First, let me
        hear you speak so I know where to start you.
      </Text>
      <Pressable
        onPress={() => setView('placement')}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.primaryText}>Let&apos;s begin</Text>
      </Pressable>
    </StudentCard>
  );

  const renderLevel = () => {
    const days = levelNode?.days || [];
    if (activeDay) {
      const chapters = activeDay.chapters || [];
      return chapters.length === 0 ? (
        <StudentCard>
          <Text style={styles.body}>No chapters in this day yet.</Text>
        </StudentCard>
      ) : (
        chapters.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => {
              setActiveChapterId(c.id);
              setView('chapter');
            }}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <StudentCard>
              <View style={styles.row}>
                <Ionicons
                  name={c.completed ? 'checkmark-circle' : 'chatbubbles-outline'}
                  size={17}
                  color={c.completed ? DONE : palette.deep}
                />
                <Text style={styles.rowTitle}>{c.name}</Text>
                <Ionicons name="chevron-forward" size={15} color={palette.deep} />
              </View>
            </StudentCard>
          </Pressable>
        ))
      );
    }

    return days.length === 0 ? (
      <StudentCard>
        <Text style={styles.body}>Content coming soon for this level.</Text>
      </StudentCard>
    ) : (
      days.map((d) => (
        <Pressable
          key={d.id}
          onPress={() => setActiveDayId(d.id)}
          style={({ pressed }) => [pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <StudentCard>
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{d.name}</Text>
              <Text style={styles.rowMeta}>
                {(d.chapters || []).length} chapter
                {(d.chapters || []).length === 1 ? '' : 's'}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={palette.deep} />
            </View>
          </StudentCard>
        </Pressable>
      ))
    );
  };

  const back = () => {
    if (view === 'chapter') return exitChapter();
    if (view === 'level') {
      if (activeDayId) {
        setActiveDayId(null);
        return undefined;
      }
      setActiveLevel(null);
      setView('map');
      return undefined;
    }
    router.back();
    return undefined;
  };

  const trail = [activeLevel, activeDay?.name].filter(Boolean).join(' › ');

  return (
    <StudentScaffold
      title="Learn with Shreya"
      loading={view === 'loading'}
      error={view === 'error' ? error : ''}
      onRetry={load}
      toast={toast}
    >
      {view !== 'map' && view !== 'greeting' && view !== 'placement' ? (
        <Pressable
          onPress={back}
          style={({ pressed }) => [styles.crumb, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={14} color={palette.onDark} />
          <Text style={styles.crumbText} numberOfLines={1}>
            {trail || 'Back'}
          </Text>
        </Pressable>
      ) : null}

      {banner && view === 'map' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      {profile?.currentLevel && view === 'map' ? (
        <Text style={styles.levelBadge}>Your level: {profile.currentLevel}</Text>
      ) : null}

      {view === 'greeting' ? renderGreeting() : null}
      {view === 'placement' ? <PlacementAssessment onPlaced={handlePlaced} /> : null}
      {view === 'map' ? (
        <LevelMap
          tree={tree}
          progress={progress}
          levelingUp={levelingUp}
          onLevelUp={handleLevelUp}
          onOpenLevel={(node) => {
            setActiveLevel(node.level);
            setActiveDayId(null);
            setView('level');
          }}
          onOpenSoundStudio={() => router.push('/student/sound-studio')}
        />
      ) : null}
      {view === 'level' ? renderLevel() : null}
      {view === 'chapter' ? (
        <ShreyaChapterScreen
          key={activeChapterId}
          chapterId={activeChapterId}
          onExit={exitChapter}
          showToast={showToast}
        />
      ) : null}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  body: { fontSize: TYPE.body, color: SLATE[600], lineHeight: 20 },

  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: p.glass,
    borderWidth: 1,
    borderColor: p.glassBorder,
    marginBottom: SPACING.md,
  },
  crumbText: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: p.onDark },

  banner: {
    backgroundColor: p.glass,
    borderWidth: 1,
    borderColor: p.glassBorder,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  bannerText: { fontSize: TYPE.body, fontWeight: '600', color: '#ffffff', lineHeight: 19 },
  levelBadge: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: p.onDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  rowTitle: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  rowMeta: { fontSize: TYPE.caption, color: SLATE[500] },

  primary: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginTop: SPACING.md,
  },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },

  pressed: { opacity: 0.78 },
}));
