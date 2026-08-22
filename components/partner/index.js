/**
 * Native screens and chrome for the partner panel.
 *
 * Kept separate from components/parent even though the two portals share a palette: they share
 * colours, not a shell, and nothing in either barrel is useful to the other.
 *
 * NOTE, carried over from the counsellor pass: this is a barrel, and in this repo a barrel import
 * is an app-wide import. Anything added here is pulled into expo-router's route scan, so never
 * re-export a module whose body touches a native module at import time.
 */
export { default as PartnerMenuScreen } from './PartnerMenuScreen';
export { default as PartnerPendingScreen } from './PartnerPendingScreen';
export { default as PartnerFeatureScreen } from './PartnerFeatureScreen';
export { default as PartnerTermsSheet } from './PartnerTermsSheet';

// The seven tiles, native. Each route file stops importing PartnerFeatureScreen when its screen
// lands here — that is the contract stated in constants/partnerMenu.js.
export { default as PartnerOverviewScreen } from './PartnerOverviewScreen';
export { default as PartnerSchoolAnalyticsScreen } from './PartnerSchoolAnalyticsScreen';
export { default as PartnerMonetizationScreen } from './PartnerMonetizationScreen';
export { default as PartnerPlansScreen } from './PartnerPlansScreen';
export { default as PartnerSchoolPlansScreen } from './PartnerSchoolPlansScreen';
export { default as PartnerBankInfoScreen } from './PartnerBankInfoScreen';
export { default as PartnerLinkedPartnersScreen } from './PartnerLinkedPartnersScreen';
