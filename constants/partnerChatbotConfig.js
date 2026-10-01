// constants/partnerChatbotConfig.js
// The `config` object that turns the shared ShreyaChatSheet into the partner's Shreya.
//
// Everything portal-specific lives here: which sections exist (Linked Partners only for a Master),
// which static text stands in when the AI is down, which HTTP client carries the token, which
// storage key holds the name, how the greeting reads, how a server link becomes a screen in THIS
// app, and which shortcuts sit under a free-chat answer. The sheet knows none of it.

import {
  buildPartnerSectionExplanation,
  resolvePartnerLink,
  sectionsForPartner,
} from './partnerChatbotData';
import * as partnerShreya from '../services/partner/shreyaService';

/** Mirrors PartnerChatbot.js `greetingText()`. */
function partnerGreeting(name) {
  return `Hi ${name}, I can help you with your schools, earnings, plans and partner code. What would you like to look at?`;
}

/** Every suffix is a screen in app/partner/ (school-analytics, monetization, plans). */
const PARTNER_QUICK_ACTIONS = [
  { label: '📊 School Analytics', suffix: '/school-analytics' },
  { label: '💰 Monetization', suffix: '/monetization' },
  { label: '📋 Plans', suffix: '/plans' },
];

const BY_TIER = {};

/**
 * The sheet config for a partner tier. Memoised per tier so the sheet sees the SAME object on every
 * render — its load effect and callbacks key on the config's parts.
 *
 * @param {string} partnerType 'MASTER' | 'NORMAL' (anything else is treated as NORMAL)
 */
export function partnerChatbotConfigFor(partnerType) {
  const isMaster = partnerType === 'MASTER';
  const key = isMaster ? 'MASTER' : 'NORMAL';
  if (!BY_TIER[key]) {
    BY_TIER[key] = {
      sections: sectionsForPartner(isMaster),
      buildExplanation: buildPartnerSectionExplanation,
      service: partnerShreya,
      nameKey: 'partnerUserName',
      greeting: partnerGreeting,
      resolveLink: resolvePartnerLink,
      subtitle: 'Your partnership companion',
      loadingText: 'Loading your partnership companion…',
      quickActions: PARTNER_QUICK_ACTIONS,
    };
  }
  return BY_TIER[key];
}
