import TeacherResourcesScreen from '../../components/student/resources/TeacherResourcesScreen';

/**
 * Teacher's Resources and Homework — `?tab=resources` or `?tab=homework`.
 *
 * Two of the three controls the website floats over its student pages. My Workspace links to this
 * route twice, once per tab, which is exactly what the web's two floating buttons do to its one
 * modal.
 */
export default function StudentTeacherResources() {
  return <TeacherResourcesScreen />;
}
