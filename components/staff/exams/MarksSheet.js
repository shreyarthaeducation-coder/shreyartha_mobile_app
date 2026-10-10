import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE } from '../../../constants/theme';
import { FormSheet } from '../../ui';
import {
  EXAM_STATUS,
  XLSX_TYPE,
  createQuestionsFromSheet,
  fetchMarksSheet,
  fetchQuestionMarksSheet,
  fetchScanAvailable,
  importMarksFile,
  marksTemplatePath,
  saveMarks,
  saveQuestionMarks,
  scanMarksSheet,
  scanMarksSheetTotal,
  setPracticalMaxMarks,
  setTotalMarks,
} from '../../../services/teacher/examService';
import { downloadAndShare } from '../../../utils/downloadFile';
import { pickFile, pickImage, pickPdf, takePhoto } from '../../../utils/filePicker';
import { normaliseMarksSheetImage } from '../../../utils/marksSheetImage';
import {
  applyImportedRows,
  ceilingFor,
  columnsTotal,
  examinersTotal,
  hasNoMaximum,
  isOpenPaper,
  markingColumns,
  marksFromScan,
  paperItems,
  reviewProblems,
  scanTone,
  seededTotal,
  setNumbers,
  setOutOfFrom,
  totalRowChanged,
  totalRowProblem,
  totalWorthSaving,
  worthSaving,
} from '../../../utils/marksSheetScan';
import { LinkButton, PALETTE, StatusToggle, TONE_STYLE, sanitise, styles } from './marks/marksParts';
import MarksGrid, { grid } from './marks/MarksGrid';
import ScanPanel from './marks/ScanPanel';
import ScanResultPanel from './marks/ScanResultPanel';
import PaperReviewPanel from './marks/PaperReviewPanel';
import StudentSearchBar from '../shared/StudentSearchBar';
import { useStudentSearch } from '../../../utils/studentSearch';

/**
 * Enter/Edit Marks for one exam — the website's two marks grids (ExamMarksGrid, one total per
 * student; QuestionMarksGrid, question by question) as the website draws them: a table, one row per
 * student, one cell per question headed "Q1 /5", then the total and the remarks. The student column
 * stays put and the cells scroll sideways (marks/MarksGrid).
 *
 * WHICH SHAPE OPENS FIRST: an exam with questions opens question by question — the richer record,
 * and what drives the analysis — and either shape offers a switch to the other, as the website does.
 * With several sets there is one table per set, as on the website: Set 1's question 3 and Set 2's
 * question 3 are different questions, so they cannot share a column.
 *
 * ── SCANNING AN ANSWER BOOK ──────────────────────────────────────────────────────────────────────
 * The toolbar's "Scan a marks sheet" opens the scanner INSIDE this sheet (marks/ScanPanel) — whose
 * book, which paper — and what was read lands in that student's row, coloured by how sure the reader
 * is, with a summary above the table (marks/ScanResultPanel). Never saved until Save marks. For an
 * exam with no questions yet, the first sheet sets the paper up: its questions are shown for the
 * teacher to confirm (marks/PaperReviewPanel), created only then, and the sheet switches to
 * question-by-question marking with that student's marks in place. A blank box or a dash counts as 0.
 *
 * ── WHERE A MESSAGE GOES ─────────────────────────────────────────────────────────────────────────
 * This sheet is a Modal. A failure is written on the sheet (`error`) as well as toasted, and the
 * toast itself shows inside the sheet (SheetToastContext) — both used to appear under the Modal, so
 * a scan or a save that failed looked like nothing happening.
 *
 * ── WHAT A SAVE SENDS ────────────────────────────────────────────────────────────────────────────
 * Only rows with something to save. Question by question: a row nobody touched would be written down
 * as a present student who scored nothing. One total: only rows that CHANGED — a total saved over an
 * exam with questions replaces that student's question-by-question marks on the server, so re-sending
 * an untouched row would throw its breakdown away.
 */

const XLSX_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/comma-separated-values',
];

export default function MarksSheet({ visible, exam, onClose, onSaved, onChanged, showToast }) {
  // The paper a scanned sheet described, once the teacher confirmed it: from then on this exam has
  // questions, whatever the card it was opened from still says.
  const [paperMade, setPaperMade] = useState(false);
  const hasQuestions = paperMade || (exam?.questionCount || 0) > 0;
  // "Switch to a single total per student" on an exam with questions.
  const [forceTotal, setForceTotal] = useState(false);
  const perQuestion = hasQuestions && !forceTotal;
  const mode = perQuestion ? 'question' : 'total';

  const [sheet, setSheet] = useState(null);
  const [edits, setEdits] = useState({});
  // What the server sent for each one-total row — a row is saved only when it differs from this.
  const originals = useRef({});
  const touched = useRef(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Bumped to fetch the sheet again after questions or totals change. Only such a reload keeps what
  // was typed: this sheet stays mounted between exams, so an ordinary open starts from the server.
  const [reloadKey, setReloadKey] = useState(0);
  const keepEdits = useRef(false);
  // Marks to place once the next load arrives: the questions they belong to exist only then.
  const pendingFill = useRef(null);
  // What was typed on the one-total sheet before the paper was made — a total, or an absence —
  // carried across so it is not lost with the switch.
  const carried = useRef({});

  const [scanOn, setScanOn] = useState(false);
  const [scanPanelOpen, setScanPanelOpen] = useState(false);
  const [scanningFor, setScanningFor] = useState(null);
  const [scanInfo, setScanInfo] = useState({}); // studentId -> questionId -> { status, raw, note }
  const [scanTotals, setScanTotals] = useState({}); // studentId -> { status, note }, one-total grid
  const [scanResult, setScanResult] = useState(null);
  const [review, setReview] = useState(null);
  const [extraOffer, setExtraOffer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [totalMarksDraft, setTotalMarksDraft] = useState('');
  // Null while the practical panel is closed; the figure being typed while it is open.
  const [practicalDraft, setPracticalDraft] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  /** A failure, said on the sheet and in the toast — never only somewhere the teacher cannot see. */
  const fail = useCallback(
    (message) => {
      setError(message);
      showToast?.(message, 'error');
    },
    [showToast],
  );

  // Everything here belongs to one exam.
  useEffect(() => {
    setPaperMade(false);
    setForceTotal(false);
    setReview(null);
    setExtraOffer(null);
    setScanInfo({});
    setScanTotals({});
    setScanResult(null);
    setPracticalDraft(null);
    setNotice('');
    setError('');
    setScanPanelOpen(false);
    pendingFill.current = null;
    carried.current = {};
  }, [exam?.id]);

  // Whether this site can read a cover at all; unknown is not "on".
  useEffect(() => {
    if (!visible) return undefined;
    let alive = true;
    fetchScanAvailable()
      .then((on) => alive && setScanOn(on))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !exam?.id) return undefined;
    let alive = true;
    // An ordinary load shows the spinner; a reload after questions were added keeps the table on
    // screen and everything typed into it.
    const keep = keepEdits.current;
    if (!keep) {
      setLoading(true);
      setNotice('');
      setError('');
    }

    (async () => {
      try {
        const data = perQuestion ? await fetchQuestionMarksSheet(exam.id) : await fetchMarksSheet(exam.id);
        if (!alive) return;
        keepEdits.current = false;
        setSheet(data);
        setTotalMarksDraft(data?.maxMarks != null ? String(data.maxMarks) : '');

        const seeded = {};
        (data?.students || []).forEach((student) => {
          if (perQuestion) {
            const marks = {};
            (student.questionMarks || []).forEach((qm) => {
              marks[qm.questionId] = qm.marksObtained == null ? '' : String(qm.marksObtained);
            });
            const before = carried.current[student.studentId];
            seeded[student.studentId] = {
              questionSet: student.questionSet || 1,
              status: before?.status || student.status || EXAM_STATUS.PRESENT,
              remarks: student.remarks || '',
              marks,
              totalTyped: before?.totalTyped ?? seededTotal(student),
            };
          } else {
            seeded[student.studentId] = {
              questionSet: student.questionSet || 1,
              status: student.status || EXAM_STATUS.PRESENT,
              remarks: student.remarks || '',
              marksObtained: student.marksObtained == null ? '' : String(student.marksObtained),
              practicalMarks: student.practicalMarksObtained == null ? '' : String(student.practicalMarksObtained),
            };
          }
        });
        if (!perQuestion) originals.current = seeded;
        if (perQuestion) carried.current = {};
        if (!keep) touched.current = false;
        setEdits((prev) => {
          if (!keep) return seeded;
          const merged = { ...seeded };
          Object.keys(prev).forEach((id) => {
            if (merged[id]) {
              merged[id] = {
                ...merged[id],
                ...prev[id],
                ...(merged[id].marks || prev[id].marks
                  ? { marks: { ...(merged[id].marks || {}), ...(prev[id].marks || {}) } }
                  : {}),
              };
            }
          });
          return merged;
        });

        const fill = pendingFill.current;
        if (fill && perQuestion) {
          pendingFill.current = null;
          touched.current = true;
          const items = paperItems(data?.questions, fill.set);
          const { marks, statuses } = marksFromScan(items, fill.read, fill.startAt);
          setEdits((prev) => {
            const entry = prev[fill.studentId] || { remarks: '', marks: {}, totalTyped: '' };
            return {
              ...prev,
              [fill.studentId]: {
                ...entry,
                questionSet: fill.set,
                // A sheet is a paper that was sat, so the student was there.
                status: EXAM_STATUS.PRESENT,
                marks: { ...(entry.marks || {}), ...marks },
                ...(fill.typedTotal !== undefined ? { totalTyped: fill.typedTotal } : {}),
              },
            };
          });
          setScanInfo((prev) => ({
            ...prev,
            [fill.studentId]: { ...(prev[fill.studentId] || {}), ...statuses },
          }));
        }
      } catch (e) {
        if (alive) fail(e?.message || 'Could not load the marks sheet.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [visible, exam?.id, perQuestion, fail, reloadKey]);

  const students = useMemo(() => sheet?.students || [], [sheet]);
  const studentSearch = useStudentSearch(students);
  const questions = sheet?.questions || [];
  const sets = setNumbers(sheet);
  const practicalOutOf = perQuestion ? null : sheet?.practicalMaxMarks ?? null;
  // A paper made from an answer book: its questions say nothing about what each is worth, so it is
  // out of the exam's total marks.
  const openPaper = perQuestion && isOpenPaper(questions);
  const hasRollNumbers = students.some((s) => s.rollNumber);
  const hasAdmissionNumbers = students.some((s) => s.admissionNumber);

  const setOutOf = useCallback((set) => setOutOfFrom(sheet, set), [sheet]);

  // The boxes of one set, as the answer book and the website number them. A student is marked
  // against the set they sat — another set's questions are not on their paper, and the server
  // refuses marks for them.
  const columnsFor = useCallback((set) => markingColumns(paperItems(sheet?.questions, set)), [sheet]);

  const rowTotal = useCallback(
    (studentId) => {
      const entry = edits[studentId];
      if (!entry || entry.status === EXAM_STATUS.ABSENT) return 0;
      return columnsTotal(columnsFor(entry.questionSet || 1), entry.marks);
    },
    [edits, columnsFor],
  );

  const patch = (studentId, changes) => {
    touched.current = true;
    setEdits((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...changes } }));
  };

  /** One question's box — merged into the latest marks, so two quick entries never undo each other. */
  const setMark = (studentId, questionId, value) => {
    touched.current = true;
    setEdits((prev) => {
      const entry = prev[studentId] || {};
      return { ...prev, [studentId]: { ...entry, marks: { ...(entry.marks || {}), [questionId]: value } } };
    });
  };

  /**
   * Moves a student to another paper. What they scored goes with the move rather than following
   * them: a 4 against Set 1's question 3 answers a question that is not on Set 2, and a total out
   * of Set 1's 40 is not a total out of Set 2's 55.
   */
  const changeSet = (studentId, questionSet) => {
    if ((edits[studentId]?.questionSet || 1) === questionSet) return;
    if (perQuestion) {
      patch(studentId, { questionSet, marks: {}, totalTyped: '' });
      setScanInfo((prev) => ({ ...prev, [studentId]: {} }));
    } else {
      patch(studentId, { questionSet, marksObtained: '' });
    }
  };

  /** The Set cell: which paper this student was handed. Changing it clears what they scored. */
  const pickSet = (student) => {
    const current = edits[student.studentId]?.questionSet || 1;
    const others = sets.filter((s) => s !== current);
    if (others.length === 0) return;
    if (others.length > 2) {
      // More sets than a phone's dialog has buttons: step to the next one.
      changeSet(student.studentId, sets[(sets.indexOf(current) + 1) % sets.length]);
      return;
    }
    const buttons = others.map((s) => ({ text: `Set ${s}`, onPress: () => changeSet(student.studentId, s) }));
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(
      `Which paper did ${student.studentName} sit?`,
      `On Set ${current} now. Changing it clears the marks entered against the other set.`,
      buttons,
      { cancelable: true },
    );
  };

  /** Fetches the sheet again — the questions or totals changed — keeping everything typed so far. */
  const reloadKeepingEdits = () => {
    keepEdits.current = true;
    setReloadKey((k) => k + 1);
  };

  const markAll = (status) => {
    touched.current = true;
    setEdits((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        next[s.studentId] = { ...next[s.studentId], status };
      });
      return next;
    });
  };

  /** The other shape, after a word if something typed would be lost with the switch. */
  const switchShape = (toTotal) => {
    const go = () => {
      setExtraOffer(null);
      setScanResult(null);
      setReview(null);
      setForceTotal(toTotal);
    };
    if (!touched.current) {
      go();
      return;
    }
    Alert.alert(
      toTotal ? 'Switch to one total per student?' : 'Switch to marks per question?',
      'Marks you have not saved yet will be lost. Save first to keep them.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Switch', style: 'destructive', onPress: go },
      ],
    );
  };

  // ── Scanning ──────────────────────────────────────────────────────────────────────────────────

  /** The picked answer-book cover, ready to send: a photo re-encoded as JPEG, a PDF as it is. */
  const fileFrom = async (source) => {
    if (source === 'pdf') return pickPdf();
    const picked = source === 'camera' ? await takePhoto() : await pickImage();
    if (!picked) return null;
    if (picked.denied) {
      fail(
        source === 'camera'
          ? 'Allow camera access to photograph the answer book.'
          : 'Allow photo access to choose the answer book.',
      );
      return null;
    }
    return normaliseMarksSheetImage(picked.uri);
  };

  const openReview = (studentId, set, res, fromTotalSheet) => {
    const read = res?.marks || [];
    const sum = read.reduce((s, m) => s + (Number(m.marks) || 0), 0);
    const student = students.find((s) => s.studentId === studentId);
    setScanPanelOpen(false);
    setScanResult(null);
    setReview({
      studentId,
      studentName: student?.studentName || 'The student',
      set,
      res,
      fromTotalSheet,
      values: read.map((m) => (m.marks == null ? '' : String(m.marks))),
      totalMarks: String(res?.suggestedTotalMarks ?? sheet?.maxMarks ?? ''),
      // "54.5 = 55": the examiner's rounding, offered as the total.
      typedTotal: res?.sheetTotal != null && Math.abs(res.sheetTotal - sum) > 1e-9 ? String(res.sheetTotal) : '',
    });
  };

  /** The sheet's total into the student's row (one-total grid), or nothing when nothing is to be trusted. */
  const applySheetTotal = (res, studentId) => {
    if (res?.sheetTotal != null) {
      patch(studentId, { status: EXAM_STATUS.PRESENT, marksObtained: String(res.sheetTotal) });
      setScanTotals((prev) => ({ ...prev, [studentId]: { status: res.sheetTotalStatus, note: res.sheetTotalNote } }));
    } else {
      setScanTotals((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  };

  const scanFor = async (studentId, source, set = 1) => {
    let file;
    try {
      file = await fileFrom(source);
    } catch (e) {
      fail(e?.message || 'Could not use that file.');
      return;
    }
    if (!file) return;

    setError('');
    setScanResult(null);
    setScanningFor(studentId);
    try {
      if (perQuestion) {
        const res = await scanMarksSheet(exam.id, file, set);
        // The set has no questions yet: the sheet describes the paper, for the teacher to confirm.
        if (res?.paperFromSheet) {
          openReview(studentId, set, res, false);
          return;
        }
        const items = paperItems(questions, set);
        const { marks, statuses } = marksFromScan(items, res?.marks || []);
        const typed = examinersTotal(res);
        touched.current = true;
        setEdits((prev) => {
          const before = prev[studentId] || { remarks: '' };
          // Read against another paper than the one on record: the student moves to it, and what
          // was entered against the old one goes (see changeSet).
          const moved = (before.questionSet || 1) !== set;
          return {
            ...prev,
            [studentId]: {
              ...before,
              questionSet: set,
              status: EXAM_STATUS.PRESENT,
              marks: { ...(moved ? {} : before.marks || {}), ...marks },
              totalTyped: typed,
            },
          };
        });
        setScanInfo((prev) => ({ ...prev, [studentId]: statuses }));

        // Marks for questions the paper does not have: offered, never added unasked. On a paper
        // whose questions all say what they are worth, the new ones must say it too.
        const extra = res?.extraMarks || [];
        if (extra.length > 0) {
          const boxes = columnsFor(set);
          const everyHasAMaximum = boxes.length > 0 && boxes.every((c) => !hasNoMaximum(c.question));
          setExtraOffer({
            studentId,
            set,
            extra,
            startAt: items.length + 1,
            maxima: everyHasAMaximum ? extra.map(() => '') : null,
          });
        } else {
          setExtraOffer(null);
        }
        setScanResult({ studentId, set, res, perQuestion: true, filled: Object.keys(marks).length });
      } else {
        const res = await scanMarksSheetTotal(exam.id, file);
        // No questions yet: the sheet's questions are shown for the teacher to confirm and create.
        if (!hasQuestions && (res?.marks || []).length > 0) {
          openReview(studentId, 1, res, true);
          return;
        }
        applySheetTotal(res, studentId);
        setScanResult({ studentId, set: 1, res, perQuestion: false });
      }
      setScanPanelOpen(false);
    } catch (e) {
      fail(e?.message || 'Could not read that marks sheet.');
    } finally {
      setScanningFor(null);
    }
  };

  const reviewIssues = review
    ? reviewProblems({
        values: review.values,
        totalMarks: review.totalMarks,
        typedTotal: review.typedTotal,
        studentName: review.studentName,
      })
    : [];

  /**
   * Creates the paper the teacher confirmed, then puts the student's marks in place — unsaved.
   * From the one-total sheet the total marks go first: if they cannot be set (a total already
   * entered is higher), nothing is created.
   */
  const createFromReview = async () => {
    const r = review;
    if (!r || reviewIssues.length > 0) return;
    setBusy(true);
    setError('');
    try {
      const total = Number(r.totalMarks);
      const totalChanged = total !== sheet?.maxMarks;
      if (r.fromTotalSheet && totalChanged) await setTotalMarks(exam.id, total);
      await createQuestionsFromSheet(exam.id, r.set, r.values.map(() => null));
      if (!r.fromTotalSheet && totalChanged) {
        try {
          await setTotalMarks(exam.id, total);
        } catch (e) {
          fail(e?.message || 'The questions were created, but the total marks could not be changed.');
        }
      }
      pendingFill.current = {
        studentId: r.studentId,
        set: r.set,
        startAt: 1,
        read: r.values.map((v, i) => ({
          ...((r.res?.marks || [])[i] || {}),
          marks: v === '' ? null : Number(v),
        })),
        typedTotal: r.typedTotal,
      };
      setReview(null);
      onChanged?.();
      if (r.fromTotalSheet) {
        // What was typed for the other students on the one-total sheet comes along: a total as
        // one typed by hand (they have no questions marked to be the sum of), and an absence.
        const typedBefore = {};
        Object.entries(edits).forEach(([id, entry]) => {
          const absent = entry?.status === EXAM_STATUS.ABSENT;
          const typedTotal = entry?.marksObtained;
          if (absent || (typedTotal !== '' && typedTotal != null)) {
            typedBefore[id] = { status: entry.status, totalTyped: absent ? '' : String(typedTotal) };
          }
        });
        carried.current = typedBefore;
        setForceTotal(false);
        setPaperMade(true);
      } else {
        reloadKeepingEdits();
      }
      setNotice(
        `${r.values.length} question${r.values.length === 1 ? '' : 's'} created, and ${r.studentName}'s marks are in ` +
          'their row. Check them, then press Save marks.',
      );
    } catch (e) {
      fail(e?.message || 'Could not create the questions.');
    } finally {
      setBusy(false);
    }
  };

  /** "Just enter the total": the review set aside, the total recorded as it always was. */
  const totalOnly = () => {
    const r = review;
    if (!r) return;
    applySheetTotal(r.res, r.studentId);
    setScanResult({ studentId: r.studentId, set: 1, res: r.res, perQuestion: false });
    setReview(null);
  };

  /** Adds the questions the sheet has and the paper does not, then fills their marks in. */
  const addExtraQuestions = async () => {
    const offer = extraOffer;
    if (!offer) return;
    setBusy(true);
    setError('');
    try {
      await createQuestionsFromSheet(
        exam.id,
        offer.set,
        offer.extra.map((_, i) => (offer.maxima ? Number(offer.maxima[i]) : null)),
      );
      pendingFill.current = { studentId: offer.studentId, set: offer.set, startAt: offer.startAt, read: offer.extra };
      setExtraOffer(null);
      onChanged?.();
      reloadKeepingEdits();
    } catch (e) {
      fail(e?.message || 'Could not add the questions.');
    } finally {
      setBusy(false);
    }
  };

  const saveTotalMarks = async () => {
    const value = Number(totalMarksDraft);
    if (!Number.isInteger(value) || value < 1) {
      fail('Total marks must be a whole number, at least 1.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await setTotalMarks(exam.id, value);
      onChanged?.();
      reloadKeepingEdits();
      showToast?.(`The paper is now out of ${value}.`, 'success');
    } catch (e) {
      fail(e?.message || 'Could not change the total marks.');
    } finally {
      setBusy(false);
    }
  };

  // ── The practical ─────────────────────────────────────────────────────────────────────────────
  // What it is out of is a decision about the paper, made once — set here; each student's practical
  // mark is its own column. Clearing the figure removes the component (refused while marks exist).
  const savePractical = async () => {
    const raw = (practicalDraft || '').trim();
    const value = raw === '' ? null : Number(raw);
    if (raw !== '' && !(Number.isInteger(value) && value > 0)) {
      fail('Give the practical a whole-number total of more than zero.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await setPracticalMaxMarks(exam.id, value);
      setPracticalDraft(null);
      reloadKeepingEdits();
      showToast?.(
        value == null
          ? 'This exam no longer has a practical component.'
          : `The practical is now out of ${value}. Enter each student's practical mark in the Practical column.`,
        'success',
      );
    } catch (e) {
      fail(e?.message || 'Could not set the practical total.');
    } finally {
      setBusy(false);
    }
  };

  // ── Excel ─────────────────────────────────────────────────────────────────────────────────────

  const downloadTemplate = async () => {
    try {
      await downloadAndShare(marksTemplatePath(exam.id), `marks-${exam.examCode || exam.id}.xlsx`, XLSX_TYPE);
    } catch (e) {
      fail(e?.message || 'Could not download the template.');
    }
  };

  /** The file only PROPOSES: its marks land next to the names, and the teacher still saves. */
  const importFile = async () => {
    let file;
    try {
      file = await pickFile(XLSX_TYPES);
    } catch (e) {
      fail(e?.message || 'Could not open that file.');
      return;
    }
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const res = await importMarksFile(exam.id, file);
      const { edits: next, applied, problems } = applyImportedRows(edits, res?.rows);
      touched.current = true;
      setEdits(next);
      const parts = [`Read ${applied} mark${applied === 1 ? '' : 's'} from the file`];
      if (problems.length) {
        parts.push(
          `${problems.length} row${problems.length === 1 ? '' : 's'} skipped: ` +
            problems
              .slice(0, 3)
              .map((p) => `row ${p.rowNumber} — ${p.error}`)
              .join('; ') +
            (problems.length > 3 ? ', …' : ''),
        );
      }
      parts.push('Check them, then press Save marks');
      setNotice(`${parts.join('. ')}.`);
    } catch (e) {
      fail(e?.message || 'Could not read that file.');
    } finally {
      setImporting(false);
    }
  };

  // ── Saving ────────────────────────────────────────────────────────────────────────────────────

  /**
   * The rows a save would send. Question by question: those worth saving. One total: those that
   * changed, and never a blank present row.
   */
  const rowsToSave = () =>
    perQuestion
      ? students.filter((student) => worthSaving(student, edits[student.studentId]))
      : students.filter(
          (student) =>
            totalRowChanged(originals.current[student.studentId], edits[student.studentId]) &&
            (totalWorthSaving(student, edits[student.studentId]) ||
              (edits[student.studentId]?.practicalMarks ?? '') !== ''),
        );

  const submit = async () => {
    const toSave = rowsToSave();
    if (toSave.length === 0) {
      fail('Nothing to save yet — enter a mark, or mark someone absent.');
      return;
    }
    if (!perQuestion) {
      for (const student of toSave) {
        const entry = edits[student.studentId];
        const problem = totalRowProblem(
          student.studentName || 'A student',
          entry,
          setOutOf(entry?.questionSet || 1),
          practicalOutOf,
        );
        if (problem) {
          fail(problem);
          return;
        }
      }
    }

    setSaving(true);
    setError('');
    try {
      const entries = toSave.map((student) => {
        const entry = edits[student.studentId] || {};
        const absent = entry.status === EXAM_STATUS.ABSENT;
        const set = entry.questionSet || 1;

        if (perQuestion) {
          const typed = !absent && (entry.totalTyped ?? '') !== '';
          return {
            studentId: student.studentId,
            status: entry.status || EXAM_STATUS.PRESENT,
            remarks: entry.remarks || null,
            questionSet: set,
            // ABSENT drops the whole array — the flat endpoint uses a null mark instead. Built
            // from the set's boxes, not the edit map, so untouched questions still appear as null;
            // never from every question of the exam, whose other sets the server refuses.
            questionMarks: absent
              ? []
              : columnsFor(set).map(({ question: q }) => ({
                  questionId: q.id,
                  marksObtained:
                    entry.marks?.[q.id] === '' || entry.marks?.[q.id] == null ? null : Number(entry.marks[q.id]),
                })),
            // A total typed over the sum — the examiner's rounding — is sent as typed.
            ...(typed ? { totalMarksObtained: Number(entry.totalTyped), totalByHand: true } : {}),
          };
        }

        const practical = String(entry.practicalMarks ?? '').trim();
        const hadPractical = String(originals.current[student.studentId]?.practicalMarks ?? '') !== '';
        return {
          studentId: student.studentId,
          status: entry.status || EXAM_STATUS.PRESENT,
          questionSet: set,
          marksObtained:
            absent || entry.marksObtained === '' || entry.marksObtained == null ? null : Number(entry.marksObtained),
          practicalMarksObtained: practical === '' ? null : Number(practical),
          // A cleared box means erase it, which a null alone cannot say — the server reads a bare
          // null as "not sent", so a save never wipes a practical mark another teacher entered.
          clearPractical: practical === '' && hadPractical,
          remarks: entry.remarks || null,
        };
      });

      if (perQuestion) await saveQuestionMarks(exam.id, entries);
      else await saveMarks(exam.id, entries);

      showToast?.(`Marks saved for ${entries.length} student${entries.length === 1 ? '' : 's'}.`, 'success');
      onSaved?.();
    } catch (e) {
      fail(e?.message || 'Could not save the marks.');
    } finally {
      setSaving(false);
    }
  };

  // ── The table ─────────────────────────────────────────────────────────────────────────────────

  const idColumns = [
    ...(hasRollNumbers
      ? [{ key: 'roll', title: 'Roll No.', width: 66, render: (s) => <Text style={grid.idText}>{s.rollNumber || '—'}</Text> }]
      : []),
    ...(hasAdmissionNumbers
      ? [
          {
            key: 'adm',
            title: 'Adm. No.',
            width: 84,
            render: (s) => (
              <Text style={grid.idText} numberOfLines={1}>
                {s.admissionNumber || '—'}
              </Text>
            ),
          },
        ]
      : []),
  ];

  const setColumn =
    sets.length > 1
      ? [
          {
            key: 'set',
            title: 'Set',
            width: 76,
            render: (s) => (
              <Pressable
                onPress={() => pickSet(s)}
                style={({ pressed }) => [styles.chip, grid.inline, { justifyContent: 'center' }, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${s.studentName}'s paper: Set ${edits[s.studentId]?.questionSet || 1}. Change`}
              >
                <Text style={styles.chipText}>Set {edits[s.studentId]?.questionSet || 1}</Text>
                <Ionicons name="chevron-down" size={12} color={SLATE[500]} />
              </Pressable>
            ),
          },
        ]
      : [];

  const statusColumn = {
    key: 'status',
    title: 'Status',
    width: 80,
    render: (s) => (
      <StatusToggle status={edits[s.studentId]?.status} onPick={(status) => patch(s.studentId, { status })} />
    ),
  };

  const remarksColumn = {
    key: 'remarks',
    title: 'Remarks',
    width: 170,
    render: (s) => (
      <TextInput
        style={[grid.input, grid.textInput]}
        value={edits[s.studentId]?.remarks ?? ''}
        onChangeText={(remarks) => patch(s.studentId, { remarks })}
        placeholder="Optional"
        placeholderTextColor={SLATE[500]}
        maxLength={500}
        accessibilityLabel={`Remarks for ${s.studentName}`}
      />
    ),
  };

  /** Question by question: one column per box of this set, headed as the website heads it. */
  const questionColumns = (set) => {
    const outOf = setOutOf(set);
    return [
      ...idColumns,
      ...setColumn,
      statusColumn,
      ...columnsFor(set).map((column) => ({
        key: `q-${column.question.id}`,
        title: column.label,
        sub: column.choice ? 'either/or' : hasNoMaximum(column.question) ? null : `/${column.question.marks}`,
        width: 62,
        render: (s) => {
          const entry = edits[s.studentId] || {};
          const absent = entry.status === EXAM_STATUS.ABSENT;
          const tone = absent ? null : scanTone(scanInfo[s.studentId]?.[column.question.id]?.status);
          return (
            <TextInput
              style={[grid.input, tone && TONE_STYLE[tone], absent && styles.disabled]}
              value={absent ? '' : entry.marks?.[column.question.id] ?? ''}
              editable={!absent}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={SLATE[400]}
              // A question with no maximum of its own is capped by the whole paper.
              onChangeText={(text) =>
                setMark(s.studentId, column.question.id, sanitise(text, ceilingFor(column.question, outOf)))
              }
              accessibilityLabel={`${s.studentName}, ${column.label}`}
            />
          );
        },
      })),
      {
        key: 'total',
        title: 'Total',
        sub: `/${outOf ?? '—'}`,
        width: 96,
        render: (s) => {
          const entry = edits[s.studentId] || {};
          const absent = entry.status === EXAM_STATUS.ABSENT;
          const typed = (entry.totalTyped ?? '') !== '';
          if (absent) return <Text style={grid.idText}>—</Text>;
          // The questions added up, unless the teacher types the total — the examiner's "54.5 = 55"
          // — which is then kept as typed; ↺ goes back to the sum.
          return (
            <View style={grid.inline}>
              <TextInput
                style={[grid.input, { flex: 1, width: undefined }, typed && styles.typedTotal]}
                value={entry.totalTyped ?? ''}
                keyboardType="decimal-pad"
                placeholder={String(rowTotal(s.studentId))}
                placeholderTextColor={SLATE[600]}
                onChangeText={(text) => patch(s.studentId, { totalTyped: sanitise(text, outOf) })}
                accessibilityLabel={`${s.studentName}'s total`}
              />
              {typed ? (
                <Pressable
                  onPress={() => patch(s.studentId, { totalTyped: '' })}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Use the questions added up for ${s.studentName}`}
                >
                  <Ionicons name="refresh" size={16} color={PALETTE.primaryDark} />
                </Pressable>
              ) : null}
            </View>
          );
        },
      },
      remarksColumn,
    ];
  };

  /** One total per student: the total (and the practical), as the website's single-total grid. */
  const totalColumns = [
    ...idColumns,
    ...setColumn,
    statusColumn,
    {
      key: 'marks',
      title: 'Marks',
      sub: sets.length > 1 ? null : `/${setOutOf(1) ?? '—'}`,
      width: sets.length > 1 ? 92 : 72,
      render: (s) => {
        const entry = edits[s.studentId] || {};
        const absent = entry.status === EXAM_STATUS.ABSENT;
        const outOf = setOutOf(entry.questionSet || 1);
        const tone = absent ? null : scanTone(scanTotals[s.studentId]?.status);
        return (
          <View style={grid.inline}>
            <TextInput
              style={[grid.input, { flex: 1, width: undefined }, tone && TONE_STYLE[tone], absent && styles.disabled]}
              value={absent ? '' : entry.marksObtained ?? ''}
              editable={!absent}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={SLATE[400]}
              onChangeText={(text) => patch(s.studentId, { marksObtained: sanitise(text, outOf) })}
              accessibilityLabel={`${s.studentName}'s total`}
            />
            {sets.length > 1 ? <Text style={grid.outOf}>/{outOf ?? '—'}</Text> : null}
          </View>
        );
      },
    },
    ...(practicalOutOf != null
      ? [
          {
            key: 'practical',
            title: 'Practical',
            sub: `/${practicalOutOf}`,
            width: 76,
            // Not tied to the written paper's status: a student absent for the written exam may
            // well have sat the practical weeks earlier.
            render: (s) => (
              <TextInput
                style={grid.input}
                value={edits[s.studentId]?.practicalMarks ?? ''}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={SLATE[400]}
                onChangeText={(text) => patch(s.studentId, { practicalMarks: sanitise(text, practicalOutOf) })}
                accessibilityLabel={`${s.studentName}'s practical mark`}
              />
            ),
          },
        ]
      : []),
    remarksColumn,
  ];

  const setOfStudent = (id) => edits[id]?.questionSet || 1;
  const savedCount = sheet ? rowsToSave().length : 0;
  const outOfLine =
    sets.length > 1
      ? `${sets.length} sets: ${sets.map((s) => `Set ${s} /${setOutOf(s) ?? '—'}`).join(', ')}`
      : `Total marks: ${setOutOf(1) ?? '—'}`;

  return (
    <FormSheet
      visible={visible}
      title={exam ? `${exam.examName}` : 'Marks'}
      subtitle={
        exam
          ? `${exam.examCode} · ${outOfLine}${practicalOutOf != null ? ` · Practical /${practicalOutOf}` : ''}`
          : undefined
      }
      onClose={onClose}
      onSubmit={submit}
      submitting={saving}
      submitLabel={
        savedCount > 0 && savedCount < students.length ? `Save marks (${savedCount} of ${students.length})` : 'Save marks'
      }
      fullHeight
    >
      {loading ? (
        <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
      ) : (
        <>
          {error ? (
            <View style={[styles.notice, { backgroundColor: FEEDBACK.errorBg, borderColor: FEEDBACK.errorBorder }]}>
              <Text style={[styles.noticeText, { color: FEEDBACK.errorText, fontWeight: '600' }]}>{error}</Text>
            </View>
          ) : null}

          {students.length === 0 ? (
            <Text style={styles.empty}>No students found for this class and section.</Text>
          ) : (
            <>
              <Text style={styles.hint}>
                {perQuestion
                  ? 'Entering marks question by question.'
                  : hasQuestions
                    ? 'Entering one total per student. A total saved here replaces that student’s question-by-question marks; only the students you change are saved.'
                    : 'Entering one total per student.'}
              </Text>

              {openPaper ? (
                <>
                  <View style={styles.totalMarksRow}>
                    <Text style={styles.totalMarksLabel}>Total marks</Text>
                    <TextInput
                      style={styles.markInput}
                      value={totalMarksDraft}
                      keyboardType="number-pad"
                      onChangeText={(text) => setTotalMarksDraft(sanitise(text, null))}
                      accessibilityLabel="Total marks"
                    />
                    <LinkButton
                      label="Set total marks"
                      onPress={saveTotalMarks}
                      disabled={busy || String(sheet?.maxMarks) === totalMarksDraft}
                    />
                  </View>
                  <Text style={styles.hint}>
                    The questions on this paper don&apos;t say what each is worth, so it is marked out of its total.
                  </Text>
                </>
              ) : null}

              {!perQuestion && practicalDraft !== null ? (
                <>
                  <View style={styles.totalMarksRow}>
                    <Text style={styles.totalMarksLabel}>Practical is out of</Text>
                    <TextInput
                      style={styles.markInput}
                      value={practicalDraft}
                      keyboardType="number-pad"
                      placeholder="e.g. 20"
                      placeholderTextColor={SLATE[500]}
                      onChangeText={(text) => setPracticalDraft(text.replace(/[^0-9]/g, ''))}
                      accessibilityLabel="Practical is out of"
                    />
                    <LinkButton label="Save" onPress={savePractical} disabled={busy} />
                    <LinkButton label="Cancel" onPress={() => setPracticalDraft(null)} disabled={busy} />
                  </View>
                  <Text style={styles.hint}>
                    {practicalOutOf != null
                      ? 'Clear the box to remove the practical component.'
                      : 'Set this once for the paper, then enter each student’s practical mark in the Practical column.'}
                  </Text>
                </>
              ) : null}

              <View style={styles.toolRow}>
                <LinkButton icon="checkmark-done-outline" label="Mark all present" onPress={() => markAll(EXAM_STATUS.PRESENT)} />
                <LinkButton icon="close-circle-outline" label="Mark all absent" onPress={() => markAll(EXAM_STATUS.ABSENT)} />
                {scanOn ? (
                  <LinkButton
                    icon="camera-outline"
                    label={scanPanelOpen ? 'Close scanner' : 'Scan a marks sheet'}
                    onPress={() => {
                      setScanPanelOpen((open) => !open);
                      setScanResult(null);
                    }}
                    disabled={scanningFor != null || busy}
                  />
                ) : null}
                {!perQuestion ? (
                  <>
                    <LinkButton icon="download-outline" label="Download template" onPress={downloadTemplate} />
                    <LinkButton
                      icon="document-attach-outline"
                      label={importing ? 'Reading…' : 'Import from Excel'}
                      onPress={importFile}
                      disabled={importing}
                    />
                    {practicalDraft === null ? (
                      <LinkButton
                        icon="flask-outline"
                        label={practicalOutOf != null ? 'Practical total' : 'Add practical marks'}
                        onPress={() => setPracticalDraft(practicalOutOf != null ? String(practicalOutOf) : '')}
                      />
                    ) : null}
                  </>
                ) : null}
                {perQuestion ? (
                  <LinkButton
                    icon="swap-horizontal-outline"
                    label="Switch to one total per student"
                    onPress={() => switchShape(true)}
                  />
                ) : hasQuestions ? (
                  <LinkButton
                    icon="swap-horizontal-outline"
                    label="Switch to marks per question"
                    onPress={() => switchShape(false)}
                  />
                ) : null}
              </View>

              {notice ? (
                <View style={styles.notice}>
                  <Text style={styles.noticeText}>{notice}</Text>
                </View>
              ) : null}

              {scanOn && scanPanelOpen ? (
                <ScanPanel
                  students={students}
                  mode={mode}
                  sets={sets}
                  setOf={setOfStudent}
                  scanning={scanningFor != null}
                  onRead={({ studentId, set, source }) => scanFor(studentId, source, set)}
                  onClose={() => setScanPanelOpen(false)}
                />
              ) : null}

              <ScanResultPanel
                result={scanResult}
                student={scanResult ? students.find((s) => s.studentId === scanResult.studentId) : null}
                hasQuestions={hasQuestions}
                offer={extraOffer && scanResult && extraOffer.studentId === scanResult.studentId ? extraOffer : null}
                busy={busy}
                onOfferChange={setExtraOffer}
                onAddExtra={addExtraQuestions}
                onClose={() => setScanResult(null)}
              />

              <PaperReviewPanel
                review={review}
                student={review ? students.find((s) => s.studentId === review.studentId) : null}
                issues={reviewIssues}
                busy={busy}
                onChange={setReview}
                onCreate={createFromReview}
                onTotalOnly={totalOnly}
                onCancel={() => setReview(null)}
              />

              {students.length > 0 ? <StudentSearchBar search={studentSearch} /> : null}
              {perQuestion ? (
                // One table per paper. A student sits one set, so they appear in one table; the Set
                // cell on their row is how a teacher says which paper they were handed.
                sets.map((set) => {
                  const here = studentSearch.results.filter((s) => setOfStudent(s.studentId) === set);
                  const boxes = columnsFor(set);
                  return (
                    <View key={set}>
                      {sets.length > 1 ? (
                        <Text style={styles.sectionLabel}>
                          Set {set} · {boxes.length} question{boxes.length === 1 ? '' : 's'} · {setOutOf(set) ?? '—'} marks ·{' '}
                          {here.length} student{here.length === 1 ? '' : 's'}
                        </Text>
                      ) : null}
                      {here.length === 0 ? (
                        <Text style={styles.hint}>
                          Nobody is on Set {set} yet. Move a student here with the Set cell on their row.
                        </Text>
                      ) : (
                        <MarksGrid students={here} columns={questionColumns(set)} />
                      )}
                    </View>
                  );
                })
              ) : (
                <MarksGrid students={studentSearch.results} columns={totalColumns} />
              )}
            </>
          )}
        </>
      )}
    </FormSheet>
  );
}
