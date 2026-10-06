import { LiveTestRoomsScreen } from '../../components/staff';

/**
 * Native Live Test Rooms — the teacher hosts a test for a whole class with no student logins:
 * pick the class and the test, share one link, press Start. Students join in a web browser.
 */
export default function TeacherLiveTests() {
  return <LiveTestRoomsScreen homeRoute="/teacher" />;
}
