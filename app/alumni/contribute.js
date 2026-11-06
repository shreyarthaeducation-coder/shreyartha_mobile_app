import ParentFeatureScreen from '../../components/parent/ParentFeatureScreen';

/**
 * Make a contribution (5 Nov 2026): the website's own Contributions page, signed in, because its
 * Razorpay checkout runs in a browser — the same arrangement as the parent's school-fee checkout.
 */
export default function AlumniContribute() {
  return (
    <ParentFeatureScreen
      title="Make a contribution"
      path="/alumni/platform/contributions"
      homeRoute="/alumni/contributions"
      sessionKeys={['alumniUserToken', 'alumniLoggedIn', 'alumniUserName']}
    />
  );
}
