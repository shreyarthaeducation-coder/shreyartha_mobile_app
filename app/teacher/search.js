import TeacherSearchScreen from '../../components/teacher/TeacherSearchScreen';

/**
 * Teacher search — `?q=` seeds the box from the dashboard's search bar.
 *
 * There is no search endpoint anywhere in the backend; the index is built client-side from the menu
 * and the teacher's own class assignments. See services/teacher/searchService.js.
 */
export default function TeacherSearch() {
  return <TeacherSearchScreen />;
}
