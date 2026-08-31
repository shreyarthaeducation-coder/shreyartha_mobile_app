import WorkspaceScreen from '../../components/student/WorkspaceScreen';

/**
 * My Workspace — the tile grid plus the three teacher links.
 *
 * By path, not through components/student/index.js: a barrel import here is an app-wide import.
 */
export default function StudentWorkspace() {
  return <WorkspaceScreen />;
}
