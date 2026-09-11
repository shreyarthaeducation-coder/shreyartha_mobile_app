import { Pressable, Text, View } from 'react-native';
import { DONE, FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import { StudentCard } from '../StudentCard';

/**
 * The A1–A5 level map: locked/unlocked tiles, per-level progress, per-metric averages against the
 * 80% target, and the Level Up button.
 *
 * **Sound Studio sits ABOVE the tiles, not among them.** It is open to every student whatever level
 * they are on, so it deliberately reads nothing from the per-level lock state and cannot be gated
 * by it. This is the web's arrangement and an explicit product decision — do not move it into the
 * tile list, and do not add it to the Language Pro landing page either.
 */

const METRIC_LABELS = {
  accuracy: 'Accuracy',
  fluency: 'Fluency',
  completeness: 'Completeness',
  prosody: 'Prosody',
  grammar: 'Grammar',
};

/** Every metric must reach this to unlock the next level. */
const TARGET = 80;

export default function LevelMap({
  tree,
  progress,
  onOpenLevel,
  onLevelUp,
  levelingUp,
  onOpenSoundStudio,
}) {
  const styles = useStyles();

  const progressByLevel = {};
  (progress?.levels || []).forEach((l) => {
    progressByLevel[l.level] = l;
  });

  return (
    <>
      {/* Outside the tree.map below, on purpose — see the note at the top of this file. */}
      <Pressable
        onPress={onOpenSoundStudio}
        style={({ pressed }) => [styles.tools, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Open Sound Studio"
      >
        <View style={styles.toolsText}>
          <Text style={styles.toolsTitle}>🔤 Sound Studio</Text>
          <Text style={styles.toolsSub}>Practise any English sound — open at every level.</Text>
        </View>
        <Text style={styles.toolsCta}>Open →</Text>
      </Pressable>

      {(tree || []).map((levelNode) => {
        const p = progressByLevel[levelNode.level] || {};
        const unlocked = levelNode.unlocked;
        const metrics = p.avgMetrics || {};
        const eligible = p.eligibleForLevelUp;
        const current = progress?.currentLevel === levelNode.level;

        return (
          <StudentCard
            key={levelNode.level}
            style={[!unlocked && styles.locked, current && styles.current]}
          >
            <View style={styles.head}>
              <Text style={styles.levelName}>{levelNode.level}</Text>
              {!unlocked ? <Text style={styles.lock}>🔒</Text> : null}
              {current ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>Current</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.progressLine}>
              {levelNode.totalChapters > 0
                ? `${levelNode.completedChapters}/${levelNode.totalChapters} chapters done`
                : 'Content coming soon'}
            </Text>

            {unlocked && levelNode.totalChapters > 0 ? (
              <View style={styles.metrics}>
                {Object.entries(METRIC_LABELS).map(([key, label]) => {
                  const v = metrics[key];
                  const pct = typeof v === 'number' ? Math.min(100, v) : 0;
                  const pass = typeof v === 'number' && v >= TARGET;
                  return (
                    <View key={key} style={styles.metric}>
                      <View style={styles.metricHead}>
                        <Text style={styles.metricLabel}>{label}</Text>
                        <Text style={[styles.metricValue, pass && styles.metricValuePass]}>
                          {typeof v === 'number' ? `${Math.round(v)}%` : '—'}
                        </Text>
                      </View>
                      <View style={styles.track}>
                        <View
                          style={[styles.fill, pass && styles.fillPass, { width: `${pct}%` }]}
                        />
                        {/* The 80% mark, so a student can see how far off they are. */}
                        <View style={[styles.target, { left: `${TARGET}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {unlocked ? (
              eligible ? (
                <Pressable
                  onPress={onLevelUp}
                  disabled={levelingUp}
                  style={({ pressed }) => [
                    styles.levelUp,
                    levelingUp && styles.btnOff,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.levelUpText}>
                    {levelingUp ? 'Leveling up…' : '🚀 Level Up!'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => onOpenLevel(levelNode)}
                  disabled={levelNode.totalChapters === 0}
                  style={({ pressed }) => [
                    styles.open,
                    levelNode.totalChapters === 0 && styles.btnOff,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.openText}>Open {levelNode.level} →</Text>
                </Pressable>
              )
            ) : (
              <Text style={styles.lockedNote}>
                Score 80%+ in every metric of the previous level to unlock
              </Text>
            )}
          </StudentCard>
        );
      })}
    </>
  );
}

const useStyles = makeStyles((p) => ({
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  toolsText: { flex: 1 },
  toolsTitle: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  toolsSub: { fontSize: TYPE.caption, color: SLATE[600], lineHeight: leading(TYPE.caption), marginTop: 2 },
  toolsCta: { fontSize: TYPE.label, fontWeight: '700', color: p.primary },

  locked: { opacity: 0.62 },
  current: { borderColor: p.primary, borderWidth: 2 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelName: { fontSize: TYPE.headline, fontWeight: '800', color: SLATE[800] },
  lock: { fontSize: TYPE.heading },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: p.tint },
  chipText: { fontSize: TYPE.micro, fontWeight: '800', color: p.deep },

  progressLine: { fontSize: TYPE.label, color: SLATE[500], marginTop: 3 },

  metrics: { marginTop: SPACING.sm },
  metric: { marginBottom: 8 },
  metricHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabel: { fontSize: TYPE.caption, fontWeight: '600', color: SLATE[600] },
  metricValue: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[500] },
  metricValuePass: { color: FEEDBACK.successText },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: SLATE[200],
    overflow: 'hidden',
    marginTop: 3,
    position: 'relative',
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: p.primaryDark },
  fillPass: { backgroundColor: DONE },
  target: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: SLATE[400] },

  levelUp: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: DONE,
    marginTop: SPACING.sm,
  },
  levelUpText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  open: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginTop: SPACING.sm,
  },
  openText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  btnOff: { backgroundColor: SLATE[400] },
  lockedNote: { fontSize: TYPE.label, color: SLATE[500], lineHeight: leading(TYPE.label), marginTop: SPACING.sm },

  pressed: { opacity: 0.78 },
}));
