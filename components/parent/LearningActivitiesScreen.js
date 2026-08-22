import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { Card, EmptyState, ScreenScaffold, SegmentedTabs, StatusChip } from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  ACTIVITY_TABS,
  activityDate,
  fetchLearningActivities,
  iconFor,
  isCompleted,
  openUrlFor,
  sortByDate,
} from '../../services/parent/activitiesService';
import { formatShortDate } from '../../utils/currency';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Learning Activities — the resources, homework and personalised material the child has been given.
 *
 * THREE FLAT LISTS, NOT THE WEB'S CASCADE. The website builds a Subject → Chapter → Topic drill-down
 * on top of five endpoints that do not exist, so it shows an empty screen to every parent. The one
 * endpoint that does exist returns all three lists for the child's section in a single response —
 * see activitiesService — and flat lists are the only shape it can drive. They also read better on
 * a phone than three levels of tapping to reach a handful of files.
 *
 * An empty tab here genuinely means "nothing assigned": the backend degrades to empty lists rather
 * than erroring when the child has no school or class.
 */

function ActivityCard({ resource, personalised }) {
  const styles = useStyles();
  const palette = usePalette();
  const url = openUrlFor(resource);
  const when = activityDate(resource);

  const open = () => {
    if (url) Linking.openURL(url);
  };

  return (
    <Card style={styles.item}>
      <Pressable
        onPress={open}
        disabled={!url}
        style={({ pressed }) => [styles.row, pressed && url && styles.pressed]}
        accessibilityRole={url ? 'button' : 'text'}
        accessibilityLabel={resource.title || 'Resource'}
      >
        <View style={[styles.icon, { backgroundColor: palette.tint }]}>
          <Ionicons name={iconFor(resource)} size={19} color={palette.primaryDark} />
        </View>

        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={2}>
            {resource.title || resource.description || 'Resource'}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[resource.subjectName, resource.chapterName, resource.topicName]
              .filter(Boolean)
              .join(' · ') || 'No subject'}
          </Text>
          <Text style={styles.meta}>
            {resource.dueDate
              ? `Due ${formatShortDate(resource.dueDate)}`
              : when
                ? `Added ${formatShortDate(when)}`
                : ''}
          </Text>
        </View>

        {url ? <Ionicons name="chevron-forward" size={16} color={SLATE[400]} /> : null}
      </Pressable>

      {resource.description && resource.title ? (
        <Text style={styles.description} numberOfLines={3}>
          {resource.description}
        </Text>
      ) : null}

      {/* Personalised resources only, and the flag is `completed` — the web reads `isCompleted`,
          which is why its badge never appears. */}
      {personalised && isCompleted(resource) ? (
        <View style={styles.badgeRow}>
          <StatusChip label="Completed" tone="success" />
        </View>
      ) : null}
    </Card>
  );
}

export default function LearningActivitiesScreen() {
  const styles = useStyles();
  const [tab, setTab] = useState('teacherResources');

  const fetcher = useCallback((signal) => fetchLearningActivities(signal), []);
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher, {
    initialData: null,
  });

  const list = useMemo(() => sortByDate(data?.[tab]), [data, tab]);
  const personalised = tab === 'personalisedResources';

  const emptyMessage = {
    teacherResources: 'Your child’s teachers have not shared any resources yet.',
    homework: 'No homework has been assigned yet.',
    personalisedResources: 'No personalised resources have been assigned yet.',
  }[tab];

  return (
    <ScreenScaffold
      title="Learning Activities"
      fallbackRoute="/parent"
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <SegmentedTabs options={ACTIVITY_TABS} value={tab} onChange={setTab} style={styles.tabs} />

      {list.length === 0 ? (
        <EmptyState icon="library-outline" title="Nothing here yet" message={emptyMessage} />
      ) : (
        list.map((resource, index) => (
          <ActivityCard
            key={`${resource.id ?? 'row'}-${index}`}
            resource={resource}
            personalised={personalised}
          />
        ))
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  tabs: { marginBottom: SPACING.sm },
  item: { marginBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { fontSize: 14.5, fontWeight: '700', color: SLATE[800] },
  meta: { fontSize: 12, color: SLATE[500], marginTop: 2 },
  description: { fontSize: 12.5, color: SLATE[500], lineHeight: 18, marginTop: SPACING.sm },
  badgeRow: { flexDirection: 'row', marginTop: SPACING.sm },
  pressed: { opacity: 0.7 },
}));
