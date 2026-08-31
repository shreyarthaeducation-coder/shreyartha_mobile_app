import {
  PRINCIPAL_SECTIONS,
  buildPrincipalSectionExplanation,
} from '../../../constants/principalChatbotData';
import * as principalShreya from '../../../services/staff/principalShreyaService';

/**
 * Which chatbot a staff panel talks to, by the descriptor's `shreyaConfig` key.
 *
 * ── WHY A MAP AND NOT A TERNARY IN EACH SCREEN ──────────────────────────────
 * Two screens mount `ShreyaChatSheet` — the home's For Support card and the Support tab — and they
 * must pass the SAME config or a Principal gets one Shreya from the card and a different one from
 * the tab. A shared resolver makes that structural rather than a thing to remember twice.
 *
 * ── ABSENT MEANS THE TEACHER'S, AND THAT IS LOAD-BEARING ────────────────────
 * `undefined` lets `ShreyaChatSheet` fall back to its own teacher defaults, which is exactly right
 * for shreyartha_teacher — the role it was built for, whose descriptor names no config. Any OTHER
 * role reaching that fallback would render a perfectly working chat pointed at
 * `/api/teacher/shreya`, which refuses it. checkstaffshreya.mjs asserts every `support: 'shreya'`
 * role either names a config here or is the teacher.
 */
const SHREYA_CONFIGS = {
  principal: {
    sections: PRINCIPAL_SECTIONS,
    buildExplanation: buildPrincipalSectionExplanation,
    service: principalShreya,
    nameKey: 'schoolUserName',
  },
};

/** The sheet config for a descriptor, or undefined for the teacher default. */
export function shreyaConfigFor(home) {
  return home?.shreyaConfig ? SHREYA_CONFIGS[home.shreyaConfig] : undefined;
}

export { SHREYA_CONFIGS };
