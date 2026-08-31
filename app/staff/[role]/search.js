import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import SearchResultsScreen from '../../../components/shared/search/SearchResultsScreen';
import { loadStaffSearchIndex } from '../../../services/staff/searchService';
import { getStaffHome } from '../../../constants/staffHome';

/**
 * Staff search — `?q=` seeds the box from the dashboard's search bar.
 *
 * There is no search endpoint anywhere in the backend, for any role; the index is built client-side
 * from the role's own menu plus whatever trees it is authorised to read. See
 * services/staff/searchService.js.
 *
 * Imported by path rather than through a barrel: expo-router scans every route file.
 */

const STRINGS = {
  placeholder: 'Search sections, classes and more…',
  emptyBody:
    'Look for a section or one of your classes — try “attendance”, “leave”, “payroll” or a class name.',
};

export default function StaffSearch() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();

  // Stable across renders, or the results screen's load effect re-runs forever.
  const loadIndex = useCallback((force) => loadStaffSearchIndex(roleKey, force), [roleKey]);

  // Gated on the descriptor, like every other redesign route: a role that has not opted into search
  // renders nothing rather than an index of a panel it does not have.
  if (!getStaffHome(roleKey)?.search) return null;

  return (
    <SearchResultsScreen
      loadIndex={loadIndex}
      fallbackRoute={`/staff/${roleKey}`}
      strings={STRINGS}
    />
  );
}
