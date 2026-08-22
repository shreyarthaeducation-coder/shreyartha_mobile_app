import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import StudentScaffold from './StudentScaffold';
import { StudentCard, StudentCardTitle } from './StudentCard';
import AnalyticsBody from './analytics/AnalyticsBody';
import { fetchMockTests, loadAnalytics } from '../../services/student/analyticsService';

/**
 * My Analytics — every area's progress on one screen.
 *
 * The ten sections live in `analytics/AnalyticsBody`, shared with the parent portal's Academic
 * Progress tab. That is not a coincidence of shape: every parent endpoint resolves the linked
 * child and calls the very same service method this student endpoint calls, so both screens render
 * the identical `StudentAnalyticsResponse`. This file is the student's chrome, fetch and routing
 * around that body.
 *
 * ONE SPINE, MANY OPTIONAL ENRICHMENTS. `/api/students/analytics` renders the page; each other
 * call refines one section and is allowed to fail. **A free student 403s on several of them**, so
 * every section reads the spine first and shows less — never nothing — when its enrichment is
 * missing. If this screen ever blanks for a free student, that guarantee has been broken.
 *
 * The translucent `StudentCard` pair is passed in deliberately — see AnalyticsBody's note on why
 * the cards are injected rather than defaulted.
 */

export default function AnalyticsScreen() {
  const router = useRouter();

  const [state, setState] = useState({ analytics: null, spineError: null, parts: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openExam, setOpenExam] = useState(null);
  const [mockTests, setMockTests] = useState({});

  const load = useCallback(async () => {
    const next = await loadAnalytics();
    setState(next);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { analytics, spineError, parts } = state;

  /** Lazy per-exam, on expand — a student can have several and each is its own round trip. */
  const toggleExam = async (exam) => {
    if (openExam === exam.id) {
      setOpenExam(null);
      return;
    }
    setOpenExam(exam.id);
    if (mockTests[exam.id]) return;
    try {
      const data = await fetchMockTests(exam.id);
      setMockTests((prev) => ({ ...prev, [exam.id]: data }));
    } catch {
      setMockTests((prev) => ({ ...prev, [exam.id]: null }));
    }
  };

  return (
    <StudentScaffold
      title="My Analytics"
      loading={loading}
      error={spineError && !analytics ? spineError : ''}
      onRetry={load}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <AnalyticsBody
        analytics={analytics}
        parts={parts}
        Card={StudentCard}
        CardTitle={StudentCardTitle}
        onOpenPsychometric={() => router.push('/student/psychometric')}
        onOpenCareer={() => router.push('/student/subject-career')}
        openExam={openExam}
        onToggleExam={toggleExam}
        mockTests={mockTests}
      />
    </StudentScaffold>
  );
}
