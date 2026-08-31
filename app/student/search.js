import SearchScreen from '../../components/student/SearchScreen';

/**
 * Platform search — `?q=` seeds the box from the dashboard's search bar.
 *
 * There is no search endpoint on the backend; the index is built client-side from the module trees.
 * See services/student/searchService.js.
 */
export default function StudentSearch() {
  return <SearchScreen />;
}
