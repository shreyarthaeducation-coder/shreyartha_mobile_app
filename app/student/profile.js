import { ProfileScreen } from '../../components/student';

/**
 * Native Student Profile — the eight-tab record.
 *
 * Replaces the old read-only summary this route used to be (name/email/class rows plus a delete
 * link); that screen could not edit anything, which is most of what this page is for.
 */
export default function StudentProfile() {
  return <ProfileScreen />;
}
