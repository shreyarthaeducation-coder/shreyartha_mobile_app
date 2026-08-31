import PartnerSearchScreen from '../../components/partner/PartnerSearchScreen';

/**
 * Partner search — `?q=` seeds the box from the dashboard's search bar.
 *
 * There is no search endpoint anywhere in the backend; the index is built client-side from the
 * profile and the monetization rows. See services/partner/searchService.js.
 */
export default function PartnerSearch() {
  return <PartnerSearchScreen />;
}
