# Shreyartha Mobile — Release Notes

## 2.0.0 (versionCode 14)

The release where the student panel reached parity with the website, the partner panel went fully
native, and signup / password-reset were audited end to end for all eight roles.

> **⚠️ THIS RELEASE REQUIRES A NEW SERVER ENV VAR.** `SHREYARTHA_SIGNUP_CODE` must be set in
> `backendmain/.env` before deploying, or Shreyartha staff signup stops working entirely. That is
> deliberate — see [Signup and password reset](#signup-and-password-reset).

> **Not device-tested.** Everything below builds clean and passes the checker suite, but no part of
> this release has been run on a physical device. The device matrix at the end of this document is
> what still needs doing before this goes to production.

> **This is a full store build, not an over-the-air update.** See [Building and releasing](#building-and-releasing).

---

## What's new

### The partner panel is now native

All **seven tiles** — Dashboard, School Analytics, Monetization, Plans for Students, Plans for
Schools, Bank Information and Linked Partners — were a WebView of the website. They are now real
screens: sortable, searchable, pull-to-refresh, and readable on a phone.

- **Monetization** and **School Analytics** were nine-column tables. Each row is now a card, with
  the column headers as a sort bar that keeps the web's none → asc → desc cycle — the third state
  is how you get back to the server's own newest-first ordering.
- **Bank Information** is a real form, with the website's four validation patterns (IFSC, account,
  PAN, GSTIN) carried over exactly, and the UPI QR picked **without** the 1:1 crop that would have
  made the code unscannable.
- **Plans for Schools** needed no API at all — the four plans were an inline literal on the web,
  and were moved across by *evaluating* that literal rather than retyping 36 feature lines.
- *User Access* is still deliberately absent: it is 215 lines of hardcoded demo logins with
  plaintext passwords. A web page stops serving those the moment the file changes; an APK ships
  them to every device forever.

### An analytics summary opens the student and parent home

Both portals now lead with an at-a-glance card — class and stream, syllabus progress, competitive
exam readiness, English level, strongest and weakest skill — before anything else on the screen.
The parent's reads "Your candidate is in Class 8 (Science)…" and links straight into the full
report.

One backend method serves both, because the parent endpoint already resolves the linked child and
calls the student's own analytics service. Only the *subject* differs, and that lives in the app.

**Coding Pro percentages and the Overall Readiness Index are deliberately excluded.** Both are
hardcoded placeholders on the server — every student reads AI 80% / Robotics 60% / Coding 75%,
Academic "High". A placeholder inside a chart is a known gap; the same number written into a
sentence shown to a parent about their own child is a fabrication.

### A confirmation step before personal and financial details

Payslips, the salary breakup, EPF/ESI/PT/TDS, UAN, PF and ESIC numbers, bank account and IFSC,
Aadhaar and PAN, tax declarations, and — for principals, vice principals and school admins — other
employees' salary structures now open **hidden**, behind one deliberate tap. Downloading a payslip
PDF asks separately, because that file outlives the screen.

The details re-hide whenever the screen loses focus. Without that, one tap would unlock them for
as long as the screen stayed mounted, and a back-tap after handing someone the phone would land on
an unmasked salary slip.

> This is a **speed bump, not an access control**. Anyone holding the unlocked phone can tap
> "Show". It stops the realistic case — a handed-over phone, someone reading over a shoulder — and
> nothing stronger. The real control is unchanged: the server's `@PreAuthorize` on `/api/staff/hr`.

### Language Pro opens on the content

School and College Resources used to start on a board picker showing curriculum names like
"ICSE+CBSE". The website has no such step — it takes the first curriculum and never prints its
name — so the app now does the same and opens straight on the class, chapters and topics.

The board name is **admin-authored data, not a string in the app**, so nothing could be found by
searching for it. Personalized Resources keeps its list (it is the class-step-down content that
page exists to show) but labels each row by class instead of by board.

### Psychometric Assessment

- **Your report can be reopened.** Finish an assessment, leave, come back — the report is rebuilt
  from your saved answers instead of disappearing. Completed topics now carry a tick in the list.
- **Three of the five report types now draw their chart.** The 3C Personality Blueprint, Learning
  Productivity Matrix and Advanced Interest Mapping were configured for bar charts that were never
  rendered, so those reports showed no summary graphic at all.
- **Download your report as a PDF**, with the Psychometric Assessment Framework document as the
  front page — the same cover the website prepends.

### Skills Edge

- **Assessment**, at the topic level: one test drawn from every module beneath a topic, shuffled and
  capped. The website has had this button for some time with nothing behind it.
- **My Project** — attach your own work to a learning objective: a title, a 200-word write-up, and a
  video, PDF or presentation.
- **Module names are visible.** They were rendering as blank rows.
- Locks now consider the whole chain, so an accessible module under a locked topic is locked.

### Coding

- **My Projects** — add, edit and delete your own projects, with the same three file slots.
- **The Arena shows problems for your class.** A Class 6 student was being served Class 9 problems.

### Academic IQ

- **Practice Zone** shows the two Bloom's levels its difficulty actually maps to, with a mastery
  badge and a performance remark, rather than whichever levels happened to appear in the data.
- **Competitive Exam** locks entrance exams that are not on your profile, and prompts you to set one
  if you have not.
- Jyora, Shreya Speak and Doubt Resolution across the content screens.

### Language Pro

- A **Sound Studio tutorial** on first visit, re-openable from the header.

### Throughout

- **A single visual system.** The panel had accumulated 25 font sizes, 54 hardcoded colours and two
  different greens for "completed" across six porting phases. It now runs on one type scale, one set
  of semantic colour tokens, and a measured minimum tap target.

---

## Fixed

### Logging out now actually logs you out

Tapping **Log out** on the partner, parent and student home screens cleared every stored key and
then left you sitting on the same screen, with your name and photo still rendered. Five screens
called `AuthContext.logout()` directly — and that function only wipes storage; it does not, and
cannot, navigate, because it has no idea which portal you are in.

The route guards could not rescue it either: each reads its token **once** on mount and caches the
answer, so emptying storage does not re-trigger them. The bounce to a login screen only arrived
later, when some unrelated request returned 401 — which is why logging out felt like nothing
happening, followed some minutes later by an unexplained jump to a login page.

All five now confirm first, then land on **their own portal's** login screen.

### The student dashboard header

The card carrying your photo, My Analytics, Speak to Counselor and Change Password was a 95%-opaque
slab bolted across the top of the screen, hiding the background entirely. It is now a rounded,
translucent panel that floats over the background image, and roughly a third shorter — the photo,
name and class are all still there, just no longer stacked at poster size.

### Signup and password reset

Audited end to end for all eight roles — student, teacher, counsellor, school admin, principal,
vice principal, parent, partner. Both flows already existed everywhere; what was broken was on the
server, so nothing here was visible from the app's code alone.

- **Anyone on the internet could create a verified Shreyartha admin account.**
  `POST /api/shreyartha/auth/signup` is public and marked the account active immediately, and that
  role implies `SCHOOL_ADMIN`. It now requires a shared secret — `SHREYARTHA_SIGNUP_CODE` — and
  **refuses every signup when that is unset**, so an unconfigured server fails closed rather than
  open. Both the app and the website ask for the code when a Shreyartha role is selected.
- **Password reset by phone silently did nothing for many users.** Every signup stored the number
  exactly as typed while the reset lookup searched for bare digits, so anyone who registered as
  "+91 98765 43210" could never recover their account — and the "a reset link has been sent"
  message appeared regardless. Numbers are now normalised on the way in, existing rows are
  backfilled by migration, and logins accept either form.
- **Two students sharing a phone number broke reset for both of them.** Student signup never
  checked for a duplicate mobile — the only role that didn't — and the lookup threw on finding two
  rows. That exception was swallowed into the same cheerful success message.
- **Signup failures said "Server error" instead of the reason.** A wrong school code, a
  already-registered email or an unaccepted T&C all returned 500. They now return 400 with the
  actual message, and the app and website both show it.
- **Passwords: 6 characters at signup, 8 at reset.** A password created at signup could not be
  re-set to itself. Everything is 8 now, enforced on the server rather than only in the form.
- `password_reset_tokens` **had no migration** — the table existed only because Hibernate creates
  it at boot. The first deploy with `ddl-auto` turned off would have broken password reset for all
  eight roles at once. It now has one.

### Two of these were never mobile-only

**Psychometric answers were never saved — on the website either.** `PsychometricSubmitRequest`
declared `answers` as a `List`, while both the web and the app send an object keyed by question id.
Jackson rejected every submit with a 400 before the handler ran, and because both clients treat the
save as fire-and-forget (so a student always sees their report), nothing ever surfaced it.
`psy_student_answers` was empty on every deployment, which is also why the counsellor's
student-results screen has always come back blank.

**Psychometric scoring was effectively random.** The questions endpoint stripped `skillsMeasured`
and `bloomTaxonomy` — the only two fields the scoring engine reads — so every question fell through
to a positional fallback. Since both clients shuffle the questions on arrival, the same student
retaking the same assessment landed in different categories each time.

### Mobile

- Practice Zone filtered on a field the API does not send, so difficulty selection did nothing.
- The adaptive assessment sent one engine's protocol to another, and read options from fields none
  of the three engines populate — so no answers rendered.
- A college-only class fallback was being applied to school students in Coding Pro and Language Pro.
- The Skills Edge profile tab discarded `selectedTopics`, `englishCommunication` and
  `isRelatedToJob` on every save, including values set on the website.
- The Academic IQ profile tab could not write a valid record, which made the competitive-exam gate
  unreachable for anyone who only uses the app.
- The student profile had no video upload control, though the upload function existed.
- My Analytics read the wrong field for syllabus completion and silently showed a coarser number.
- The Readiness Index — a hardcoded value identical for every student — has been removed.

---

## Backend changes that also affect the website

One backend serves both the app and shreyartha.com, so everything here lands on the website the
moment it deploys. **Deploy them together**, and confirm on the website afterwards:

### Required before deploying

**Set `SHREYARTHA_SIGNUP_CODE` in `backendmain/.env`.** Without it, `/api/shreyartha/auth/signup`
refuses every request — by design, so a server that was never configured cannot keep handing out
admin-level staff accounts to anyone who asks. Share the value with whoever onboards Shreyartha
staff; both the app and the website now prompt for it.

### Migration

**`V66__auth_recovery_fixes.sql`** — creates `password_reset_tokens` (which had no migration at
all), and normalises `email` and `mobile` across `users`, `students`, `school_users`,
`parent_users`, `partner_users`, `investor_users` and `university_users`. Idempotent, and it does
**not** add a unique constraint on `students.mobile`: live data almost certainly contains
duplicates, and a migration that fails on existing rows would block the whole deploy.

### Website behaviour that changes

1. **A psychometric submit returns 200** rather than 400.
2. **The counsellor's student-results screen shows answers** — for the first time.
3. **Retaking a psychometric topic yields the same categories** it did the first time.
4. **Signup now requires an 8-character password** and returns 400 with a real message instead of
   500 "Server error". The website's forms were updated to match; without that they would have
   accepted 6 characters and then failed at the server with no explanation.
5. **The Shreyartha staff signup form asks for a signup code.** Its School Code field was also
   `required` in HTML for those roles, which blocked that signup before the handler ever ran.
6. **The password-reset page understands `type=investor`.** It was falling through to the student
   configuration, so an investor was told they were a student and sent to `/studentlogin`.
7. **Forgot-password on the student form no longer searches the whole user table.** It is scoped to
   students, like every other portal's. ⚠️ `ROLE_ADMIN` had no reset route of its own and was
   reachable only through that leak — admins now have no self-service recovery path.

Point 3 is a visible change to report content. Reports generated after this deploy will differ from
reports generated before it, because the earlier ones were assigning categories by question position
in a shuffled list. This is the fix, not a regression — but anyone comparing a student's old report
to a new one should know why they differ.

New endpoints: `GET /api/psychometrics/progress`, `GET /api/psychometrics/results`,
`GET /api/student/skillsedge/understanding/topic/{topicId}/assessment`,
`GET /api/students/analytics/summary`, `GET /api/parent/dashboard/analytics-summary`.
Highest Flyway version is now **V66**.

---

## Building and releasing

### The version must be bumped by hand

`eas.json` sets `"appVersionSource": "local"`, so **EAS reads `versionCode` from `app.json` and does
not increment it**. Both fields must move together:

```jsonc
// app.json
"version": "2.0.0",              // expo.version
"android": { "versionCode": 14 } // expo.android.versionCode
```

Raising `version` without `versionCode` produces a build the Play Console rejects as a duplicate.

**For this release the numbers do not move.** versionCode 13 (v1.3.0) is what is live on the Play
Store; versionCode 14 was prepared but never uploaded, so all of the above folds into 14.

Confirm that before building: Play Console → Release, and check **every** track — internal, closed
and open, not just production. If versionCode 14 appears on any of them, it is spent: bump to 15
and set `version` to `2.1.0`.

### This cannot ship over the air

`expo-updates` is not installed and `app.json` declares no `updates` block, so there is no OTA
channel — every release here is already a full store build. Independently of that, this release adds
**`expo-print`**, a native module, so it could not have been an OTA push in any case.

```bash
npx expo export --platform android          # sanity check the bundle
eas build --platform android --profile production
eas submit --platform android
```

The `production` profile builds an app-bundle with local credentials.

⚠️ **Back up the keystore before building.** `eas.json` sets `"credentialsSource": "local"`, and
both `credentials.json` and `keystore/*.jks` are gitignored — so the only copy is on the machine
that builds. If Play App Signing is not enabled (check Play Console → Setup → App integrity),
losing that file means this listing can never be updated again.

Because the device matrix below is still untested and this is a live app, roll out to production in
stages (10% → 50% → 100%) rather than going straight to full availability.

### Verification before building

```bash
node scripts/checkscope.js .        # expect exactly 5 known false positives, no more
for f in scripts/check*.mjs; do node "$f"; done
npx expo export --platform android
```

Two checkers are new in this release and both mutation-test themselves:

- **`scripts/checklogout.mjs`** — that no screen calls the storage-wipe directly as a press
  handler, that each portal navigates to *its own* login route, and that the staff attendance
  end-ping still runs *before* the keys are cleared.
- **`scripts/checklanguagepro.mjs`** — that no render path prints a curriculum's `.name`, and that
  the auto-select still honours the hidden-node filter and the LOCKED gate the picker used to
  apply. It deliberately does **not** grep for "ICSE": that string is in the database, not the
  source, and a literal search would pass forever while the bug sat in plain sight.

`scripts/checkhomeheader.mjs` and `scripts/checkpartner.mjs` each had one mutation that had gone
**vacuous** — they were matching source strings this release renamed, so they were passing while
testing nothing. Both were repointed.

The five standing `checkscope` false positives are `Card` and `CardTitle` in `AnalyticsBody.js`,
`useStyles` in `makeStyles.js`, and `staffApi` in the two counsellor services. Any sixth is real.

Backend: `./mvnw test`. Eight failures in `TranslateControllerTest`, `GoogleTextToSpeechServiceTest`
and `GoogleTranslateServiceTest` are pre-existing — they fail in isolation and are unrelated to this
work. Note that `mvn install` does not validate JPQL in this project (there is no in-memory
database), so repository queries are verified by reading the entity mappings.

---

## Device matrix

Nothing in this release has been run on a device. At minimum:

| Case | Why it matters |
|---|---|
| A **school** student and a **free** student | They receive different 403s. A screen that blanks on one expected 403 is the bug `settleAll` exists to prevent. |
| A **college** student | Class fallback, Language Pro relabelling, and the Arena's no-filter path. |
| A student **with** and **without** a competitive exam set | The exam gate has both branches. |
| A student whose class label does not match the tree's wording | e.g. profile says "8", tree says "Class VIII". |
| A student who **completes a psychometric topic and reopens it** | The first time that table has ever held a row. |
| **Log out from every portal** — student, parent, partner, and staff | The fix is navigation; the only way to see it work is to tap it. |
| A **partner of each tier** (MASTER and NORMAL) | Linked Partners refuses a NORMAL caller with 400, not 403 — the screen must show the server's message, not a generic failure. |
| A partner with **more than one linked school**, and one with none | The school picker only appears above one, and the empty state is a real case. |
| **Signup and forgot-password for all 8 roles**, by email *and* by phone | The whole point of the audit. Include a number typed as "+91 98765 43210". |
| A **Shreyartha staff signup**, with and without the code | Fails closed if `SHREYARTHA_SIGNUP_CODE` is unset — verify it is set before testing. |
| A **parent whose child is not linked yet** | The summary card 404s there, and that is a normal state, not an error. |
| The **HR screens** for a teacher and for a principal | Confirm details re-hide after navigating away and back. |

---

## Known open

- **The Azure Speech key is invalid** — `issueToken` returns 401 in every region. Voice recording
  and pronunciation scoring cannot work until it is replaced. **This affects the website too.**
  Shreya Speak is unaffected (it uses Google TTS).
- **Android cannot produce an audio format Azure's REST endpoint accepts.** `expo-av` offers AMR and
  AAC; Azure takes PCM WAV or OGG-Opus. Fixing this needs server-side transcoding or a different
  recorder — it is not a configuration change.
- **Doubt Resolution photos sit at guessable public S3 URLs**, because fal.ai fetches them by URL.
- **Three screens still open the website in a WebView**, deliberately: the Coding Arena (its editor
  is browser-only) and the two plan/upgrade routes.
- **My Project is not mounted in Language Pro.** The endpoints and the component branch both exist,
  but the website does not render it there, so adding it would be a divergence rather than parity.
- The **Socratic doubt redesign** remains unbuilt.
- **No OTP or email verification exists anywhere**, on either client. Signup still accepts any
  email address without proving ownership. Out of scope for this release, and named here so it is a
  decision rather than an oversight.
- **`ROLE_ADMIN` has no password-reset route.** It previously worked only by accident, through the
  student endpoint searching the entire user table; scoping that closed the accident.
- **No rate limiting on any `/forgot-password`**, or on `/api/auth/quick-signup` — which emails a
  plaintext password and returns a JWT.
- **`app.frontend-base-url` defaults to `http://localhost:8080`.** If `FRONTEND_URL` is unset in
  production, every password-reset email ships a localhost link.
- The partner **Dashboard draws bars, not the website's pie and line charts.** `DonutChart` is a
  single-value progress ring and `LineChart` is a 0-100 percentage axis, so neither fits money.
  Each bar is relative to the best month with the exact rupee figure printed beside it. A real
  currency chart is a chart-kit change, not a dashboard one.
- **Coding Pro and the Readiness Index are still hardcoded** for every student
  (`StudentAnalyticsService`). The new summary card excludes them; the existing charts still show
  them.
- The web's logout handlers still leak keys (`schoolCode`, `schoolUserEmail`, `studentRole`,
  `token`…) and navigate without `replace`, leaving a signed-out dashboard in browser history.

---

## Earlier versions

### 1.3.0 (versionCode 13)

The last release before the student-panel parity work. The native port of the student panel had
shipped but had not been tested against the website.
