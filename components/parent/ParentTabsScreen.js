import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SPACING } from '../../constants/theme';
import { ScreenScaffold, SegmentedTabs } from '../ui';

/**
 * A parent screen made of tabs (4 Nov 2026): View Report (Test & Analysis | Counselling Report) and
 * Attendance & Schedule (Attendance | Schedule). One header, the tab row, and the open tab, where
 * each tab is a whole screen rendered `embedded`.
 *
 * The first tab open is the one `?tab=` names — a quick action, a search result, a Shreya link or
 * an old route's redirect — else the first. A tab is mounted the first time it is opened and kept,
 * hidden, after that, so coming back to it finds it as it was and nothing is fetched for a tab
 * nobody opened (as CounsellingReportTabs does).
 *
 * `tabs` is `[{ value, label, render }]`.
 */
export default function ParentTabsScreen({ title, tabs, fallbackRoute = '/parent' }) {
  const { tab: asked } = useLocalSearchParams();
  const values = tabs.map((t) => t.value);
  const requested = values.includes(asked) ? asked : values[0];

  const [tab, setTab] = useState(requested);
  const [opened, setOpened] = useState(() => new Set([requested]));

  useEffect(() => {
    setTab(requested);
  }, [requested]);

  useEffect(() => {
    setOpened((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, [tab]);

  return (
    <ScreenScaffold title={title} fallbackRoute={fallbackRoute} scroll={false}>
      {/* Past three tabs the labels would be cut short ("Connect…"), so the row scrolls instead. */}
      <SegmentedTabs scrollable={tabs.length > 3} options={tabs} value={tab} onChange={setTab} style={styles.tabs} />
      {tabs.map((t) =>
        t.value === tab || opened.has(t.value) ? (
          <View key={t.value} style={[styles.panel, t.value !== tab && styles.hidden]}>
            {t.render()}
          </View>
        ) : null,
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  tabs: { marginHorizontal: SPACING.md, marginTop: SPACING.sm },
  panel: { flex: 1 },
  hidden: { display: 'none' },
});
