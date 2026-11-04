import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SLATE, SPACING, TYPE, leading } from '../../../../constants/theme';
import { makeStyles } from '../../../../utils/makeStyles';
import useShreyaVoice from '../../../../hooks/useShreyaVoice';
import { shreyaEnglish } from '../../../../services/student/languageProService';
import { SegmentedTabs } from '../../../ui';
import { StudentCard } from '../../StudentCard';
import SpeakingPanel from './SpeakingPanel';
import VocabularyPanel from './VocabularyPanel';
import TranslationPanel from './TranslationPanel';

const TABS = [
  { value: 'speaking', label: 'Speak', icon: 'people-outline' },
  { value: 'vocabulary', label: 'Words', icon: 'book-outline' },
  { value: 'understand', label: 'Meaning', icon: 'language-outline' },
];

/**
 * A chapter's Speaking Challenge on the phone (1 Nov 2026) — the website's `SpeakingChallenge`:
 * the passage read line by line as a play, the line's character correcting each mistake; the
 * passage's important words; and the passage in the student's language, for meaning only.
 */
export default function SpeakingChallengeScreen({ chapterId, showToast }) {
  const styles = useStyles();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('speaking');
  // `speak` and `stop` are stable; the object around them is new on every render.
  const { speak, stop: stopVoice } = useShreyaVoice();

  useEffect(() => {
    const controller = new AbortController();
    shreyaEnglish
      .speaking(chapterId, controller.signal)
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e?.message || 'Could not open the Speaking Challenge.');
      });
    return () => controller.abort();
  }, [chapterId]);

  const castByKey = useMemo(() => {
    const m = {};
    (data?.cast || []).forEach((c) => {
      m[c.key] = c;
    });
    return m;
  }, [data]);

  /**
   * Says `text` in a character's voice; the chorus and anyone unknown are Sonia. `options` goes to
   * the voice (its `onStart`, which the face and Play all use).
   */
  const say = useCallback(
    (text, characterKey, options) => {
      const c = castByKey[characterKey] || castByKey.SONIA;
      return speak(text, { ...options, voice: c?.voice });
    },
    [castByKey, speak],
  );

  if (error) {
    return (
      <StudentCard>
        <Text style={styles.body}>{error}</Text>
      </StudentCard>
    );
  }
  if (!data) return <ActivityIndicator style={styles.loading} />;

  return (
    <View>
      <Text style={styles.title}>{data.chapterName}</Text>
      <SegmentedTabs
        options={TABS}
        value={tab}
        onChange={(next) => {
          stopVoice();
          setTab(next);
        }}
        style={styles.tabs}
      />
      {tab === 'speaking' ? (
        <SpeakingPanel data={data} castByKey={castByKey} say={say} stopVoice={stopVoice} showToast={showToast} />
      ) : null}
      {tab === 'vocabulary' ? <VocabularyPanel data={data} say={say} /> : null}
      {tab === 'understand' ? <TranslationPanel data={data} /> : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  title: { fontSize: TYPE.title, fontWeight: '800', color: SLATE[800], marginBottom: SPACING.sm },
  tabs: { marginBottom: SPACING.md },
  body: { fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body) },
  loading: { marginTop: SPACING.xl },
}));
