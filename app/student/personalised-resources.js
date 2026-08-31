import PersonalisedResourcesScreen from '../../components/student/resources/PersonalisedResourcesScreen';

/**
 * Personalised Resources — the third of the website's floating buttons.
 *
 * British `s`, and that is load-bearing: `/api/students/personali**s**ed-resources` is the
 * teacher-assigned record list this screen shows, while `/api/students/personali**z**ed-resources`
 * is the student's own Academic IQ tree, which lives under `/student/academic-iq-resources`.
 */
export default function StudentPersonalisedResources() {
  return <PersonalisedResourcesScreen />;
}
