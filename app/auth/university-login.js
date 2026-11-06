import PortalSignupScreen from '../../components/auth/PortalSignupScreen';
import { PORTALS } from '../../constants/theme';
import { signupUniversity } from '../../services/authService';

/**
 * University sign-up — the institution's own account (the website's /universitylogin). It waits for
 * the platform admin, who also assigns its University Code; it can sign in and fill in its profile
 * meanwhile, exactly as on the website.
 */
export default function UniversitySignup() {
  return (
    <PortalSignupScreen
      palette={PORTALS.university}
      title="University"
      subtitle="Register your university on The 3C Edge"
      cardTitle="Create a University Account"
      fields={[
        { key: 'fullName', label: 'Full Name', required: true, placeholder: 'Your full name' },
        { key: 'mobile', label: 'Mobile No.', required: true, kind: 'phone', placeholder: 'Enter 10-digit mobile number' },
        { key: 'email', label: 'Email Address', required: true, kind: 'email', placeholder: 'Enter your email address' },
        { key: 'universityName', label: 'University Name', required: true, placeholder: "Enter the university's name" },
        { key: 'password', label: 'Password', required: true, kind: 'password' },
      ]}
      terms="I acknowledge and agree to the terms and conditions of The 3C Edge platform."
      submit={async (v) => {
        const res = await signupUniversity({ ...v, fullName: v.fullName.trim(), email: v.email.trim(), universityName: v.universityName.trim() });
        return (
          res?.message ||
          'Signup successful! Your university account is awaiting admin approval. You can sign in and start adding details right away.'
        );
      }}
    />
  );
}
