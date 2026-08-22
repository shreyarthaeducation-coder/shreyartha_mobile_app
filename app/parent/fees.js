import { FeesScreen } from '../../components/parent';

/**
 * School Fees — native dues, schedule and history. "Pay Now" hands off to the WebView, because
 * the Razorpay checkout is browser-only; see FeesScreen.
 */
export default function ParentFees() {
  return <FeesScreen />;
}
