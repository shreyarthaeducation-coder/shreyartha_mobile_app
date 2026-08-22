import { StaffMenuScreen } from '../../components/staff';
import {
  TEACHER_GROUPS,
  TEACHER_HEADER_ACTIONS,
  TEACHER_MENU,
} from '../../constants/teacherMenu';

/**
 * Native teacher home — a thin wrapper over the shared staff menu shell.
 *
 * The menu itself lives in constants/teacherMenu.js; items marked `native` push an in-app
 * screen, the rest open through app/teacher/feature.js (native header + WebView body). As pages
 * get ported, individual items flip to native in the menu constant without any change here.
 *
 * Passing `groups` is what opts this panel into collapsible sections. The six app/staff/[role]
 * shells pass no groups and keep their flat grids — see the note in StaffMenuScreen.
 */

const TEACHER_CONFIG = {
  label: 'Teacher',
  menu: TEACHER_MENU,
  groups: TEACHER_GROUPS,
  headerActions: TEACHER_HEADER_ACTIONS,
  routes: {
    feature: '/teacher/feature',
    pending: '/teacher/pending-verification',
  },
  // Mounts the floating Shreya launcher. `basePath` is what the chatbot's routeSuffix values get
  // prefixed with — and they line up 1:1 with the app/teacher/* routes, so nothing else is needed.
  chatbot: { basePath: '/teacher' },
};

export default function TeacherHome() {
  return <StaffMenuScreen config={TEACHER_CONFIG} />;
}
