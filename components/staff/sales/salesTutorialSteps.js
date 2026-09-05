// The Sales walkthrough — content only.
//
// The same eight steps, in the same order, as
// frontendmain/src/Sales/platform/salesTutorialSteps.js. A rep is taught once across both
// platforms (the server decides who has seen it), so whichever one they meet first must say the
// same things — two divergent explanations of one incentive rule is worse than one.
//
// Icons are Ionicons names here rather than the website's emoji, because that is what the rest of
// this app draws with.
//
// KEEP IN STEP WITH THE SERVER: SalesOnboardingService.CURRENT_TUTORIAL_VERSION decides who is
// shown this. Materially change the copy and bump that number.

export const TUTORIAL_STEPS = [
  {
    key: 'welcome',
    icon: 'hand-right',
    title: 'Welcome to the Sales panel',
    body:
      'This is where you run your field work: the schools you are chasing, the visits you make, '
      + 'the deals you close, and the incentive that follows. About a minute — and you can replay '
      + 'it any time from your Profile.',
  },
  {
    key: 'leads',
    icon: 'flag',
    title: 'LEAD — your pipeline',
    body:
      'Every school you are working lives here, with a stage from New through to Won or Lost. A '
      + 'pincode is required on each lead, and it is not paperwork: it anchors the location check '
      + 'on your visits and warns you when another rep is already working the same school.',
  },
  {
    key: 'visits',
    icon: 'location',
    title: 'Visits — check in at the school',
    body:
      'Tap Check in when you arrive. Your location and the time are captured automatically and '
      + 'cannot be edited afterwards, and a photo is required — that is what makes your visit '
      + 'count verifiable. If you have no signal the visit is saved on your phone and syncs later, '
      + 'so you never lose one.',
  },
  {
    key: 'schools',
    icon: 'business',
    title: 'My Schools — what you have sold',
    body:
      'The schools you are working, with revenue rolled up per school. A school joins this list '
      + 'when you first check in at it or file a deal against it — nothing is assigned to you. '
      + 'Base, GST and total are always shown separately: the school pays the total, but only the '
      + 'base counts as revenue and only the base drives your incentive.',
  },
  {
    key: 'deals',
    icon: 'cash',
    title: 'Sales — record a deal',
    body:
      'Pick the products and grades, enter the student count, choose how the school paid, and the '
      + '18% GST is worked out for you. Submit it and the admin team approves it, then marks the '
      + 'money collected. You can share a quotation PDF with the school straight from the deal.',
  },
  {
    key: 'incentive',
    icon: 'trophy',
    title: 'My Incentive — how you get paid',
    body:
      'You earn nothing until your collected, ex-GST revenue for the financial year crosses your '
      + 'threshold. Once it does, your rate applies to EVERYTHING you have collected that year — '
      + 'not just the amount above the threshold. The simulator shows what one more deal is worth.',
  },
  {
    key: 'reports',
    icon: 'bar-chart',
    title: 'Reports — how you are doing',
    body:
      'Two views: your funnel, counted by the Customer Reading you set on each visit — 0 for a '
      + 'lost sale up to 5 for a win; and your monthly visit report — how many visits, of what '
      + 'kind, across how many schools and how many days in the field.',
  },
  {
    key: 'hr',
    icon: 'calendar',
    title: 'Attendance, Leave and Payroll',
    body:
      'Mark your own attendance each month, apply for leave, and download your payslips. Your '
      + 'attendance and your visit log are separate records — logging visits on a day does not mark '
      + 'you present, and vice versa.',
  },
];
