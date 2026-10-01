import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SPACING } from '../../constants/theme';
import { ScreenScaffold, SegmentedTabs } from '../ui';
import { counsellingReportTab } from '../../constants/counsellingReport';

/**
 * The Counselling Report's frame, for the parent and teacher panels alike: one header, the tab row,
 * and the open tab, where each tab is a whole screen rendered `embedded`.
 *
 * The first tab is the one `?tab=` names (a chatbot shortcut, or one of the old screens'
 * redirects), else the Psychometric Result the report leads with.
 *
 * A tab is mounted the first time it is opened and kept, hidden, after that: a teacher who picked a
 * class and a student in one tab finds them still picked on coming back, and nothing is fetched for
 * a tab nobody opened. The web's tab bar does the same.
 *
 * `tabs` is `[{ value, label, render }]` — SegmentedTabs' option shape plus what to show.
 */
export default function CounsellingReportTabs({ title, fallbackRoute, tabs }) {
  const { tab: requestedTab } = useLocalSearchParams();
  // Only this screen's own tabs count: the staff report has two, the parent's three.
  const requested = counsellingReportTab(requestedTab, tabs.map((t) => t.value));

  const [tab, setTab] = useState(requested);
  const [opened, setOpened] = useState(() => new Set([requested]));

  // A link naming another tab while this screen is already open switches to it.
  useEffect(() => {
    setTab(requested);
  }, [requested]);

  useEffect(() => {
    setOpened((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, [tab]);

  return (
    <ScreenScaffold title={title} fallbackRoute={fallbackRoute} scroll={false}>
      {/* Scrollable: three long labels in equal thirds would truncate on a 360dp phone. */}
      <SegmentedTabs scrollable options={tabs} value={tab} onChange={setTab} style={styles.tabs} />
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
