import ParentSearchScreen from '../../components/parent/ParentSearchScreen';

/**
 * Parent search — `?q=` seeds the box from the dashboard's search bar.
 *
 * By path, not through components/parent/index.js: a barrel import here is an app-wide import.
 */
export default function ParentSearch() {
  return <ParentSearchScreen />;
}
