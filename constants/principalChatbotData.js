/**
 * principalChatbotData.js
 *
 * The Principal Shreya's section tiles — the first Shreya on this platform with no web counterpart,
 * because the Principal panel has no web chatbot to port from. Written here, and if a web version
 * ever ships it must copy THIS file rather than diverge from it.
 *
 * ── `sectionKey` IS A CONTRACT, NOT A LABEL ─────────────────────────────────
 * Each value must match a case in `PrincipalShreyaContextService.buildPrincipalContext` exactly.
 * An unmatched key does NOT error — that switch falls through to the portal guide — so a typo here
 * produces a tile that opens, answers plausibly, and describes the wrong thing entirely. The four
 * live keys are: school-overview, fees, staff, leave.
 *
 * ── `routeSuffix` IS A SUFFIX ───────────────────────────────────────────────
 * The sheet prefixes it with the portal base, which for this panel is `/staff/principal`. Every
 * suffix below is checked against a real wrapper file in app/staff/[role]/ by
 * scripts/checkstaffshreya.mjs — an unmatched one lands on expo-router's "Unmatched" page, which
 * reads as a broken tile rather than a bad constant.
 *
 * `''` lands on the panel root, which is the right destination for the portal guide.
 */

export const PRINCIPAL_SECTIONS = [
  {
    label: 'School Overview',
    sectionKey: 'school-overview',
    routeSuffix: '/overview',
    overview:
      '**School Overview** is your headcount at a glance — students, classes, and every staff role with its verification backlog.',
    functionality:
      'Ask about totals, how many staff are still awaiting verification, or how your students split across school, paid and free plans.',
    services: [
      'Student totals and plan split',
      'Active class count',
      'Staff headcount by role',
      'Who is still awaiting verification',
    ],
  },
  {
    label: 'Fees',
    sectionKey: 'fees',
    routeSuffix: '/fees',
    overview:
      '**Fees** shows what has been billed, what has been collected, and what is still outstanding for the current academic year.',
    functionality:
      'Ask what is outstanding, how many installments are overdue, or what falls due in the next week.',
    services: [
      'Total billed and collected',
      'Outstanding amount',
      'Overdue installment count',
      'Installments due in the next 7 days',
    ],
  },
  {
    label: 'Staff',
    sectionKey: 'staff',
    routeSuffix: '/staff',
    overview:
      '**Staff** is your verification backlog — the staff members who can sign in but cannot yet work.',
    functionality:
      'Ask who is waiting on you. An unverified staff member is refused by every page until you clear them.',
    services: [
      'Vice Principals awaiting verification',
      'Teachers awaiting verification',
      'Counsellors awaiting verification',
    ],
  },
  {
    label: 'Leave & Payroll',
    sectionKey: 'leave',
    routeSuffix: '/leave-management',
    overview:
      '**Leave & Payroll** is the approver queue — other staff’s leave requests waiting on your decision.',
    functionality:
      'Ask what is pending and for whom. This is the approver side; your own leave and payslips live under My Attendance.',
    services: [
      'Leave requests awaiting your decision',
      'Who requested what, and for which dates',
      'Payroll runs and salary structures',
    ],
  },
  {
    label: 'Portal Guide',
    sectionKey: 'portal-guide',
    routeSuffix: '',
    overview:
      '**Portal Guide** explains what each part of your panel does and where to find it.',
    functionality:
      'Ask where something lives. This section carries no school data, so it always answers.',
    services: [
      'What each home card opens',
      'Where your own record lives versus the approver queues',
      'How to schedule a live meeting',
    ],
  },
];

/**
 * The same renderer contract the teacher's data uses, duplicated rather than imported.
 *
 * `buildSectionExplanation` in teacherChatbotData.js is textually identical today. It is NOT
 * imported here on purpose: that file's header says its copy is a verbatim port of the website's
 * and must not be changed without changing the web too. Importing it would couple this panel — which
 * has no web counterpart — to that constraint, so a future change to the teacher's fallback layout
 * would silently restyle the Principal's.
 */
export function buildPrincipalSectionExplanation(section) {
  const serviceLines = section.services.map((s) => `✅ ${s}`).join('\n');

  return (
    `${section.overview}\n\n` +
    `**How to use it:**\n${section.functionality}\n\n` +
    `**What you'll find:**\n${serviceLines}`
  );
}
