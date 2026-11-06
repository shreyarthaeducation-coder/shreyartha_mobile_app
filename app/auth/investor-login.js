import PortalSignupScreen from '../../components/auth/PortalSignupScreen';
import { PORTALS } from '../../constants/theme';
import { signupInvestor } from '../../services/authService';

/**
 * Investor sign-up (the website's /investorlogin sign-up tab). The Shreyartha team verifies the
 * account; until then sign-in lands on the pending screen.
 */
export default function InvestorSignup() {
  return (
    <PortalSignupScreen
      palette={PORTALS.investor}
      title="Investor"
      subtitle="Investor relations on The 3C Edge"
      cardTitle="Create an Investor Account"
      fields={[
        { key: 'fullName', label: 'Full Name', required: true, placeholder: 'Enter your full name' },
        { key: 'email', label: 'Email', required: true, kind: 'email', placeholder: 'Enter your email' },
        { key: 'mobile', label: 'Mobile', required: true, kind: 'phone', placeholder: 'Enter 10-digit mobile number' },
        { key: 'password', label: 'Password', required: true, kind: 'password' },
      ]}
      terms="I acknowledge and agree to the terms and conditions of The 3C Edge platform."
      submit={async (v) => {
        const res = await signupInvestor({ ...v, fullName: v.fullName.trim(), email: v.email.trim() });
        return res?.message || 'Registration successful! Your account will be verified soon.';
      }}
    />
  );
}
