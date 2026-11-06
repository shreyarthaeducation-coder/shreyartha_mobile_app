import { useRef } from 'react';
import PortalSignupScreen from '../../components/auth/PortalSignupScreen';
import CodeLookupNote from '../../components/auth/CodeLookupNote';
import { PORTALS } from '../../constants/theme';
import { signupUniversityStaff } from '../../services/authService';

/**
 * University Staff sign-up — a person at a university (Vice Chancellor, Dean, Professor…), as
 * distinct from the institution's own account. Registers with the University Code the platform
 * admin assigned; the seven roles are the website's own (UniversityStaffAuth.js).
 */
const ROLES = [
  { value: 'DEAN', label: 'Dean' },
  { value: 'VICE_CHANCELLOR', label: 'Vice Chancellor' },
  { value: 'ASSOCIATE_DEAN', label: 'Associate Dean' },
  { value: 'PROFESSOR', label: 'Professor' },
  { value: 'COUNSELOR', label: 'Counselor' },
  { value: 'PLACEMENT_HEAD', label: 'Placement Head' },
  { value: 'ADMISSION_OFFICER', label: 'Admission Officer' },
];

export default function UniversityStaffSignup() {
  const codeName = useRef(null);
  return (
    <PortalSignupScreen
      palette={PORTALS.universityStaff}
      title="University Staff"
      subtitle="For people at a university on The 3C Edge"
      cardTitle="Create a University Staff Account"
      initial={{ userType: 'DEAN' }}
      fields={[
        { key: 'fullName', label: 'Full Name', required: true, placeholder: 'Enter your full name' },
        { key: 'email', label: 'Email', required: true, kind: 'email', placeholder: 'Enter your email' },
        { key: 'mobile', label: 'Mobile', required: true, kind: 'phone', placeholder: 'Enter 10-digit mobile number' },
        { key: 'universityCode', label: 'University Code', required: true, upper: true, placeholder: 'Enter university code', helper: 'Ask your university for the code The 3C Edge gave it.' },
        { key: 'userType', label: 'Role / Position', required: true, kind: 'select', options: ROLES },
        { key: 'password', label: 'Password', required: true, kind: 'password' },
      ]}
      renderAfterField={(key, values) =>
        key === 'universityCode' ? (
          <CodeLookupNote code={values.universityCode} palette={PORTALS.universityStaff} onResult={(name) => (codeName.current = name)} />
        ) : null
      }
      validate={() => (codeName.current ? '' : 'Invalid University Code')}
      terms="I agree to the terms and conditions."
      submit={async (v) => {
        const res = await signupUniversityStaff({ ...v, fullName: v.fullName.trim(), email: v.email.trim(), universityCode: v.universityCode.trim() });
        return res?.message || 'Signup successful! Please wait for admin verification.';
      }}
    />
  );
}
