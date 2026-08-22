// components/student/welcome/sessionFlag.js
//
// "Once per session" for the student welcome interstitial.
//
// ── WHY THIS IS MEMORY AND NOT AsyncStorage ─────────────────────────────────
// The website gates its overlay on `sessionStorage["welcomeShown"]`, which dies when the tab
// closes. The mobile analogue of a browser session is the **process lifetime**, so a module-scope
// variable is the correct equivalent: it survives navigation within the app and resets when the OS
// kills the process.
//
// `AsyncStorage` would be actively wrong here. It persists across launches, turning "once per
// session" into "once ever" — the student would see their progress on their very first open and
// never again. The screen exists to show progress that CHANGES.
//
// Known and accepted: Android and iOS keep a backgrounded app alive for a long time, so a student
// who switches away and returns will not see it again until the process is actually killed. That
// is the same trade the web makes (a background tab keeps its sessionStorage), and it errs on the
// side of not interrupting someone who is already using the app.
//
// Exported as functions rather than a bare `let` so a checker can assert on the construct, and so
// nothing outside this file can reach the variable directly.

let shownThisSession = false;

export function hasShownWelcome() {
  return shownThisSession;
}

export function markWelcomeShown() {
  shownThisSession = true;
}

/** Tests only — there is no product reason to un-show it within a session. */
export function resetWelcomeForTests() {
  shownThisSession = false;
}
