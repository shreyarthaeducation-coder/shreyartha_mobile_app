/**
 * partnerChatbotData.js
 *
 * Port of frontendmain/src/Partner/platform/components/PartnerChatbot/partnerChatbotData.js. Pure
 * data — change the copy on both platforms together, or a partner gets a different answer on each.
 *
 * `sectionKey` values must match PartnerShreyaContextService on the backend EXACTLY; a renamed key
 * does not error, it silently falls back to the overview.
 *
 * `routeSuffix` replaces the web's absolute `route`. The base here is '/partner' and every suffix is
 * a screen in app/partner/. The web's dashboard root is the analytics page, which in this app is
 * `/overview`; `''` (the menu) is where the portal guide lands.
 *
 * Import-free on purpose: scripts/checkpartnerdashboard.mjs evaluates it directly.
 */

export const PARTNER_SECTIONS = [
  {
    label: 'My Partnership',
    sectionKey: 'partner-overview',
    routeSuffix: '/overview',
    overview:
      '**My Partnership** sums up your account with The 3C Edge — your tier, your partner code and the schools you bring.',
    functionality:
      'See your partner code, your commission rules and every school linked to your account in one place.',
    services: ['Partner code and tier', 'Commission rules for your tier', 'Linked schools at a glance'],
  },
  {
    label: 'My Schools',
    sectionKey: 'my-schools',
    routeSuffix: '/school-analytics',
    overview:
      '**My Schools** shows the schools linked to your partner account and how their students are using The 3C Edge.',
    functionality:
      'Pick a school to see how many of its students are on the platform, their classes, their latest plans and how many used your code.',
    services: ['Students by class', 'Latest subscription status', 'Students who used your partner code'],
  },
  {
    label: 'Earnings & Commission',
    sectionKey: 'earnings',
    routeSuffix: '/monetization',
    overview:
      '**Earnings & Commission** tracks the commission you earn when students pay with your partner code.',
    functionality:
      'See what is pending, approved and paid out, what is owed to you now, and how each month of the financial year went.',
    services: [
      'Owed to you now',
      'Pending, approved and paid commission',
      'Month-by-month earnings per financial year',
    ],
  },
  {
    label: 'Plans & Partner Code',
    sectionKey: 'plans',
    routeSuffix: '/plans',
    overview:
      '**Plans & Partner Code** lists the student plans you can share and the extra discount your code gives.',
    functionality:
      'Browse the current plans class by class, with their prices and the partner-code discount students get at checkout.',
    services: ['Plans for every class', 'Prices per year and per month', 'Partner-code discount per plan'],
  },
  {
    label: 'Linked Partners',
    sectionKey: 'linked-partners',
    routeSuffix: '/linked-partners',
    masterOnly: true,
    overview: '**Linked Partners** shows the Normal Partners linked under you as a Master Partner.',
    functionality:
      'See who is linked under you, whether they are verified, and the override you have earned from their sales.',
    services: ['Partners linked under you', 'Verification status', 'Override earned from their sales'],
  },
  {
    label: 'Payout Details',
    sectionKey: 'bank-info',
    routeSuffix: '/bank-info',
    overview: '**Payout Details** checks that everything needed to pay your commission is on file.',
    functionality:
      'See which bank, PAN, GSTIN and UPI details are complete and how payouts move from pending to paid.',
    services: [
      'What is on file and what is missing',
      'How payouts work',
      'Where to update your bank details',
    ],
  },
  {
    label: 'Using the Partner Portal',
    sectionKey: 'portal-guide',
    routeSuffix: '',
    overview:
      '**Using the Partner Portal** helps you find your way around every page of this dashboard.',
    functionality:
      'Ask where to find anything — school analytics, monetization, plans, demo videos, bank details — and Shreya will point you to the right page.',
    services: [
      'What each page shows',
      'Where to find your earnings',
      'Plans, demo videos and bank details',
    ],
  },
];

/** The sections a partner of this tier can open — Linked Partners is for Master Partners only. */
export function sectionsForPartner(isMaster) {
  return PARTNER_SECTIONS.filter((section) => !section.masterOnly || isMaster);
}

/** The offline fallback text for one section — the web's `buildSectionExplanation`. */
export function buildPartnerSectionExplanation(section) {
  if (!section) return '';
  const services = (section.services || []).map((s) => `✅ ${s}`).join('\n');
  return [
    section.overview,
    `**How to use it:**\n${section.functionality}`,
    `**What you'll find:**\n${services}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * ── THE ChapterLink TRAP (see parentChatbotData.js) ──────────────────────────
 * PartnerShreyaContextService emits full WEB paths — `/partner/platform/dashboard/monetization` —
 * which prefixed with '/partner' would navigate nowhere. Each one maps to its screen here; the
 * dashboard root is the analytics page, `/overview` in this app; anything else has no screen and
 * the button is dropped.
 */
export const WEB_DASHBOARD_PREFIX = '/partner/platform/dashboard';

const NATIVE_SCREENS = ['/school-analytics', '/monetization', '/plans', '/bank-info', '/linked-partners'];

/** @returns {string|null} the suffix to append to '/partner', or null if this app cannot open it. */
export function resolvePartnerLink(route) {
  if (typeof route !== 'string' || !route.startsWith(WEB_DASHBOARD_PREFIX)) return null;
  const rest = route.slice(WEB_DASHBOARD_PREFIX.length).replace(/\/$/, '');
  if (rest === '') return '/overview';
  return NATIVE_SCREENS.includes(rest) ? rest : null;
}
