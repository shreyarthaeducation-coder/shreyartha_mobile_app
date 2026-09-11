import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ScreenScaffold, SegmentedTabs } from '../../ui';
import { getCounsellorPortal } from '../../../constants/counsellorPortals';
import LiveSessionTab from './LiveSessionTab';
import PreviousSessionsTab from './PreviousSessionsTab';
import CounsellingSheetTab from './CounsellingSheetTab';

/**
 * Face-to-Face Counselling, for both counsellor portals.
 *
 * Native port of `frontendmain/src/School/shared/F2F/F2FCounsellingPage.js`, with the same four
 * tabs — Live session, Previous sessions, Walk-in, Counselling sheet.
 *
 * ══ THE FOUR API ROOTS ARE SIBLINGS, NOT DERIVED ═══════════════════════════
 * `portal.f2f`, `portal.activityReports` and `portal.report` are three separate paths under one
 * role, and none is a suffix of another — on the Shreyartha portal `report` is
 * `/api/shreya01/counsellor-report` while `activityReports` is
 * `/api/shreya01/counsellor/activity-reports`, a different segment entirely. They are read from
 * `constants/counsellorPortals.js` rather than built here; deriving one from another compiles,
 * ships, and 404s at runtime, which has happened three times in this feature's history.
 *
 * ══ WALK-IN IS THE SAME ROOM ═══════════════════════════════════════════════
 * `LiveSessionTab` with `variant="walkin"`, not a second implementation — exactly as the web does
 * it. A walk-in used to be a weaker parallel screen that recorded nothing and produced one section
 * of eleven; making it the same component is what fixed that. The `key` forces a remount when the
 * tab is re-entered, so a finished walk-in is discarded rather than resumed.
 */
export default function F2FScreen() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getCounsellorPortal(roleKey);

  const [tab, setTab] = useState('live');
  const [walkInKey, setWalkInKey] = useState(0);

  // A role with no counsellor portal never reaches this route, but the shell registers every
  // screen for every role — so returning null is what keeps the other four panels unaffected.
  if (!portal) return null;

  return (
    <ScreenScaffold title="Face-to-Face Counselling" fallbackRoute={`/staff/${roleKey}`}>
      <SegmentedTabs
        scrollable
        tabs={[
          { key: 'live', label: 'Live session' },
          { key: 'sessions', label: 'Previous' },
          { key: 'walkin', label: 'Walk-in' },
          { key: 'sheet', label: 'Sheet' },
        ]}
        activeKey={tab}
        onChange={(next) => {
          // Re-entering Walk-in starts a fresh one rather than resuming the last.
          if (next === 'walkin' && tab !== 'walkin') setWalkInKey((k) => k + 1);
          setTab(next);
        }}
      />

      {tab === 'live' ? <LiveSessionTab portal={portal} variant="queue" /> : null}
      {tab === 'sessions' ? <PreviousSessionsTab portal={portal} /> : null}
      {tab === 'walkin' ? (
        <LiveSessionTab key={walkInKey} portal={portal} variant="walkin" />
      ) : null}
      {tab === 'sheet' ? <CounsellingSheetTab portal={portal} /> : null}
    </ScreenScaffold>
  );
}
