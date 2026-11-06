import PortalSignupScreen from '../../components/auth/PortalSignupScreen';
import { PORTALS } from '../../constants/theme';
import { signupIndustry } from '../../services/authService';

/**
 * Industry sign-up — a company's own account (the website's /industrylogin). Approved by the
 * platform admin like a university; it can sign in and set everything up meanwhile.
 */
export default function IndustrySignup() {
  return (
    <PortalSignupScreen
      palette={PORTALS.industry}
      title="Industry"
      subtitle="Hire and train students on The 3C Edge"
      cardTitle="Create an Industry Account"
      fields={[
        { key: 'fullName', label: 'Contact Person', required: true, placeholder: 'Your full name' },
        { key: 'mobile', label: 'Mobile No.', required: true, kind: 'phone', placeholder: 'Enter 10-digit mobile number' },
        { key: 'email', label: 'Email Address', required: true, kind: 'email', placeholder: 'Enter your work email' },
        { key: 'companyName', label: 'Company Name', required: true, placeholder: "Enter the company's name" },
        { key: 'industrySector', label: 'Industry Sector', placeholder: 'e.g. IT Services, Manufacturing' },
        { key: 'password', label: 'Password', required: true, kind: 'password' },
      ]}
      terms="I acknowledge and agree to the terms and conditions of The 3C Edge platform."
      submit={async (v) => {
        const res = await signupIndustry({ ...v, fullName: v.fullName.trim(), email: v.email.trim(), companyName: v.companyName.trim(), industrySector: v.industrySector.trim() });
        return res?.message || 'Signup successful! Your industry account is awaiting admin approval. You can sign in and start adding details right away.';
      }}
    />
  );
}
