import { ParentFeatureScreen } from '../../components/parent';
import { PARENT_BASE } from '../../constants/parentMenu';

/**
 * Plans for my child (24 Oct 2026): the website's parent plans page, in the WebView with the session
 * injected — the same permanent arrangement as the school-fee checkout, because Razorpay's checkout is
 * browser-only and a native payment SDK would need a dev-client build.
 *
 * A linked child gets the plan or the upgrade on their own account; a parent with no child yet sets
 * the child's login there and the account is created once the payment goes through. Open to an
 * unverified parent too (see UNVERIFIED_OK in ./_layout.js), as on the web.
 */
export default function ParentPlans() {
  return <ParentFeatureScreen title="Plans for my child" path={`${PARENT_BASE}/plans`} />;
}
