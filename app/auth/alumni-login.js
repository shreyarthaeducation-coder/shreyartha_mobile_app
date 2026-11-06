import { useRef, useState } from 'react';
import { Text } from 'react-native';
import PortalSignupScreen from '../../components/auth/PortalSignupScreen';
import SchoolSearchField, { pickProblem, pickToPayload } from '../../components/auth/SchoolSearchField';
import CodeLookupNote from '../../components/auth/CodeLookupNote';
import { PORTALS, SLATE, TYPE } from '../../constants/theme';
import { signupAlumni } from '../../services/authService';

/**
 * Alumni sign-up — the website's AlumniSignupForm (/alumnilogin): the school picked from the same
 * server-side search, or a college's code; a public or private profile on the school's Alumni Wall.
 * The account waits for the school's approval (the School Admin's Alumni Management screen).
 * Checks and messages are the website's own, in its order.
 */
const PROFILE_TYPES = [
  { value: 'PUBLIC', label: 'Public profile (all can see)' },
  { value: 'PRIVATE', label: 'Private profile (only admin can see)' },
];
const thisYear = new Date().getFullYear();
const yearBad = (v) => v !== '' && !(Number(v) >= 1950 && Number(v) <= thisYear);
const emailOk = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || '').trim());
const MAX_MESSAGE = 2000;

export default function AlumniSignup() {
  const palette = PORTALS.alumni;
  const [school, setSchool] = useState(null);
  const college = useRef(null);

  return (
    <PortalSignupScreen
      palette={palette}
      title="Alumni"
      subtitle="Join the alumni network on The 3C Edge. Your school approves your registration before you can sign in."
      cardTitle="Alumni Sign Up"
      fields={[
        { key: 'schoolPassingYear', label: 'Year you passed out', kind: 'number', maxLength: 4, placeholder: 'e.g. 2018' },
        { key: 'fullName', label: 'Full name', required: true },
        { key: 'phone', label: 'Phone', required: true, kind: 'phone', placeholder: '10-digit mobile' },
        { key: 'email', label: 'Email', required: true, kind: 'email', helper: 'You will sign in with this' },
        { key: 'password', label: 'Password', required: true, kind: 'password' },
        { key: 'qualification', label: 'Qualification/Course', placeholder: 'e.g. B.Tech, LLB, B.Com' },
        { key: 'designation', label: 'Designation', placeholder: 'e.g. Developer at LTIMindtree, Founder' },
        {
          key: 'profileType',
          label: "Profile on the school's Alumni Wall",
          required: true,
          kind: 'select',
          options: PROFILE_TYPES,
          helper: (v) =>
            v.profileType === 'PUBLIC'
              ? 'Once your school approves you, your message, name and batch appear on its Alumni Wall.'
              : v.profileType === 'PRIVATE'
                ? "Only your school's admin sees your profile."
                : '',
        },
        { key: 'message', label: 'Message', kind: 'multiline', maxLength: MAX_MESSAGE, placeholder: 'A few words about your school and where you are now' },
        { key: 'collegeCode', label: 'College code', upper: true, helper: 'If your college is on Shreyartha' },
        { key: 'collegePassingYear', label: 'Year you graduated', kind: 'number', maxLength: 4 },
      ]}
      renderBefore={() => (
        <>
          <Text style={{ fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], textTransform: 'uppercase', marginBottom: 6 }}>Your school</Text>
          <SchoolSearchField value={school} onChange={setSchool} palette={palette} />
        </>
      )}
      renderAfterField={(key, values) =>
        key === 'collegeCode' && values.collegeCode ? (
          <CodeLookupNote code={values.collegeCode} palette={palette} onResult={(name) => (college.current = name)} />
        ) : null
      }
      validate={(f) => {
        if (!emailOk(f.email)) return 'Please enter a valid email address.';
        if (String(f.phone).length !== 10) return 'Please enter a valid phone number (10 digits).';
        if (!school && !f.collegeCode.trim()) return "Please choose your school (or enter your college's code).";
        const p = school ? pickProblem(school) : '';
        if (p) return p;
        if (school && f.schoolPassingYear === '') return 'Please enter the year you passed out of school.';
        if (yearBad(f.schoolPassingYear) || yearBad(f.collegePassingYear)) return `The passing year must be between 1950 and ${thisYear}.`;
        if (f.collegeCode.trim() && !college.current) return 'Invalid College Code';
        return '';
      }}
      submit={async (f) => {
        const year = (v) => (v === '' ? null : Number(v));
        const res = await signupAlumni({
          fullName: f.fullName.trim(),
          email: f.email.trim(),
          phone: f.phone.trim(),
          password: f.password,
          school: school ? pickToPayload(school) : null,
          schoolPassingYear: school ? year(f.schoolPassingYear) : null,
          collegeCode: f.collegeCode.trim() || null,
          collegePassingYear: f.collegeCode.trim() ? year(f.collegePassingYear) : null,
          profileType: f.profileType,
          message: f.message.trim() || null,
          qualification: f.qualification.trim() || null,
          designation: f.designation.trim() || null,
          website: '',
        });
        setSchool(null);
        return res?.message || 'Registration received! We will email you as soon as it is approved.';
      }}
    />
  );
}
