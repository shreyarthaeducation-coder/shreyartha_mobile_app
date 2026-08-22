# Counsellor portals — device test script

Both counsellor portals are fully native and statically verified, but **neither has ever run on a
real device**. Static analysis cannot see a wrong *value*, only an unbound *name*, so everything
below is a check that can only fail at runtime.

Run against `https://shreyartha.com` with a **verified** account in each portal. An unverified staff
account is redirected to the pending screen before any menu renders, so nothing here is reachable.

The two portals differ in one structural way, and it drives most of this script:

| | `COUNSELOR` (school-bound) | `SHREYARTHA_COUNCELLOR` |
|---|---|---|
| Scope | Academic Year → Class → **Section** | **School → Class** — no section, no year |
| Requests | **name**-keyed (`className`, `sectionName`) | **id**-keyed (`classId`, plus `schoolId` on writes) |

**Why this matters more than it looks:** send a name where the server wants an id and it matches
nothing, returning `200 []`. The screen then shows "no students" — indistinguishable from a class
that genuinely has none. **An empty list is the failure symptom, not an error message.** Where a
step below says a list must be non-empty, pick scope that you know has data first.

---

## Portal B — `SHREYARTHA_COUNCELLOR`

### 1. Mark Attendance — the headline check

- [ ] The scope bar shows a **school chip and a class chip** — and **no academic-year chip and no
      section chip**. Any year or section control here is a bug.
- [ ] More than one school is listed, and they are the schools assigned to this counsellor.
- [ ] On open, the **first school and its first class are auto-selected** (matching the web).
- [ ] Switching school **resets the class** to that school's first — it must not keep a class id
      belonging to the previous school.
- [ ] The roster is the **whole class**, not split by section, and is non-empty.
- [ ] Unmarked students start **blank** — neither Present nor Absent. This is a deliberate
      divergence from the web (which pre-fills ABSENT); the blank state is what makes the
      "N of M marked" counter a live progress signal.
- [ ] Mark a few, save, leave the screen and return: the marks persist. **A silent no-op here is the
      exact symptom of a Portal-A-shaped body** — the save appears to succeed and nothing is stored.
- [ ] Step the date back a day and forward again; the sheet follows.
- [ ] Open the month grid (📅) — coverage tinting reflects which days are marked.

### 2. Wellness Groups

- [ ] School → Class scope, same rules as above.
- [ ] Survey categories load and each student shows a band (LOW / MODERATE / HIGH).
- [ ] Override a band, then remove the override — it falls back to the computed value.
      (`DELETE /survey/indices/override` is an app-only affordance; the web has no such button.)
- [ ] The chart renders **without** a request to `/survey/indices/graph` — the series is derived
      in-memory from the indices already held. If you can watch the network, confirm no such call.
- [ ] Open a student's psychometric panel and toggle a topic on/off; re-open and it persisted.

### 3. Counselling Needs and Notes

- [ ] School → Class scope; the student list loads for the selected month.
- [ ] The type picker offers **all eight** counselling types (not two — two means it is being
      treated as a teacher).
- [ ] Save a session with type-specific answers, re-open it, and **confirm the answers came back**.
      The app nests them under `formData`; the website spreads them at the top level where Jackson
      drops them, so the web loses them. Ours must not.

### 4. Counsellor Report

- [ ] The tree is **one root per linked school** → class → year, and **no section chips appear** at
      any level.
- [ ] Fill and save a report; re-open the same leaf and the saved values load.
- [ ] Save the **same leaf twice** — the duplicate must recover into an update, not error.

### 5. Live Counselling

- [ ] The tab is titled **"Live Counselling"** (not "Live Classes") and the create button reads
      "Schedule a counselling session".
- [ ] Schools load from the counsellor's own list.
- [ ] Create a session; the row appears with a status and the allowed transitions only.
- [ ] Notify students on a session and confirm the success response.

### 6. Queries

- [ ] All three streams load: **website**, **student**, **chatbot**.
- [ ] Open a query and post a solution; it persists.
- [ ] The **📹 Meet** action appears **only** on a query whose preferred mode is VIDEO, and is absent
      otherwise — the server rejects a meet link on anything else.
- [ ] Send a meet link once; the detail then shows that one has already been sent.

### 7. Profile → Academic Management

- [ ] Two segments: **Personalised Details** and **Academic Management**.
- [ ] Academic Management is a **read-only** School → Class → student browser — there is no
      assign/remove control, because this portal has no assign-class endpoints.
- [ ] The roster is annotated **"All sections included."**

### 8. Shared tabs

- [ ] Self Attendance: month grid, Sundays locked, a marked day pre-selects its status.
- [ ] My Calendar: the counters count **non-null** days (a phantom "Present: 0 · Total recorded: 0"
      means the null-filtering regressed).

---

## Portal A — `COUNSELOR` (school-bound)

Same tabs minus Queries, with the other scope shape throughout.

- [ ] **Every** scoped screen shows **Academic Year → Class → Section** chips — Mark Attendance,
      Wellness Groups, Counselling. A school chip appearing here is a bug.
- [ ] With several sections available, none is auto-picked; with exactly one, it is. (Auto-picking
      one of several risks marking the wrong class.)
- [ ] Mark Attendance saves and persists — this path is name-keyed.
- [ ] Counsellor Report's tree shows **only the sections this counsellor is assigned**, and section
      chips **do** appear (the opposite of Portal B).
- [ ] The live tab is titled **"Live Classes"**, and there is **no Queries tab**.
- [ ] Profile → Academic Management is the **assign/remove editor**: add a Class → Section →
      Subject(s) assignment, confirm it lists, then remove it.
- [ ] Counselling offers all eight types, as in Portal B.

---

## Cross-cutting

- [ ] Both portals render in the **purple** counsellor palette, including the menu grid and headers.
- [ ] Both menus render as a **flat grid** — neither is grouped into collapsible sections, and that
      is correct: the website has never grouped them.
- [ ] A 403 anywhere renders as an ordinary error, **not** a logout. `staffApi` treats 403 as
      renderable; only a 401 on a request that carried a token ends the session.
- [ ] Android hardware back from the menu exits to the landing tabs with the session intact.

## If something fails

Capture the **request** (path, query, body) before assuming the screen is at fault — the whole
Portal A / Portal B split lives in request shape, and a wrong shape shows up as empty data rather
than an error. `checkcounsellorportals.mjs` in the session scratchpad proves the shapes are right in
source; a device failure that contradicts it means the server expects something neither the app nor
the website's own code implies.
