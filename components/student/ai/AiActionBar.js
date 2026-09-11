import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import { SPACING, TOUCH, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import ShreyaSpeakButton from './ShreyaSpeakButton';
import JyoraSheet from './JyoraSheet';
import DoubtSheet from './DoubtSheet';

/**
 * The row of AI actions that sits above a topic's content: **Explore more with Jyora** and
 * **Shreya Speak**.
 *
 * On the web this is `div.jyora-action-section`, rendered identically on eight screens
 * (`SchoolResources`, `PersonalizedResources`, `CompetitiveExam`, `CodingPro`, both LanguagePro
 * resource pages, `SkillsEdge`, `SubjectCareer`), each next to the tab strip rather than inside the
 * prose. One component here for the same reason: eight copies is how the three Bloom's remark
 * tables drifted apart.
 *
 * ── THE CONTEXT FIELDS ARE THE SERVER'S, NOT THE SCREEN'S ────────────────────
 * `context` is passed straight to `POST /api/student/jyora/explain`, whose controller reads a bare
 * `Map<String,String>` with `getOrDefault(key, "")`. A misspelled key is therefore **not an error**
 * — it silently sends nothing and Jyora explains the topic name with no material. In particular the
 * content field is **`contentHtml`**, not `staticContent` (which is what the web calls the *prop*).
 *
 * Screens whose tree has no equivalent for a field simply omit it, exactly as the web does:
 * Competitive Exam sends no board/class, Coding Pro sends `subjectName: 'Coding Pro'`, Language Pro
 * sends `subjectName: 'Language Pro'`.
 *
 * @param {object} context      the eight `/explain` fields; `contentHtml` carries the content
 * @param {string} contentLabel the tab's label, shown on the sheet's Content tab
 * @param {string} speakText    what Shreya reads; defaults to the same content
 */
export default function AiActionBar({
  context,
  contentLabel,
  speakText,
  doubtSource,
  captureRef: contentRef,
  style,
}) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [doubtOpen, setDoubtOpen] = useState(false);
  const [capture, setCapture] = useState(null);

  const content = context?.contentHtml || '';

  /**
   * Capture the content view BEFORE the sheet opens.
   *
   * The web's third capture route is `html2canvas` on a DOM node while its modal is open. The RN
   * equivalent would be `captureRef` on a view sitting behind a Modal — the same setup that has
   * produced a blank bitmap before. Capturing first sidesteps it entirely, and the student never
   * sees the difference: the shot is simply already there when the sheet opens.
   *
   * Best-effort by design. A failed capture must still open the sheet — the camera and gallery
   * routes are the ones that matter, and a screen the student can't snapshot is not a reason to
   * refuse them a way to ask their question.
   */
  const openDoubt = async () => {
    let shot = null;
    if (contentRef?.current) {
      try {
        shot = await captureRef(contentRef, { format: 'jpg', quality: 0.9, result: 'tmpfile' });
      } catch {
        shot = null;
      }
    }
    setCapture(shot);
    setDoubtOpen(true);
  };

  return (
    <View style={[styles.row, style]}>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.jyora, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Explore more with Jyora"
      >
        <Image
          source={require('../../../assets/images/Jyora.png')}
          style={styles.avatar}
          resizeMode="contain"
        />
        <Text style={styles.jyoraLabel}>Explore more with Jyora</Text>
      </Pressable>

      <ShreyaSpeakButton text={speakText ?? content} />

      {/* Doubt Resolution. The web puts this in a separate header row; on a phone a second row of
          actions costs more than it explains, so all three share one wrapping row. Omitted when the
          screen supplies no `doubtSource` — Subject & Career has no doubt entry on the web either. */}
      {doubtSource ? (
        <Pressable
          onPress={openDoubt}
          style={({ pressed }) => [styles.doubt, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Doubt Resolution"
        >
          <Ionicons name="camera-outline" size={19} color="#ffffff" />
          <Text style={styles.doubtLabel}>Doubt Resolution</Text>
        </Pressable>
      ) : null}

      {/* Both sheets are mounted only while open, so a screen with a dozen topics does not hold a
          dozen of them — and so a 120-second request cannot fire from a closed sheet. */}
      {open ? (
        <JyoraSheet
          visible={open}
          onClose={() => setOpen(false)}
          context={context}
          contentLabel={contentLabel}
        />
      ) : null}

      {doubtOpen ? (
        <DoubtSheet
          visible={doubtOpen}
          onClose={() => {
            setDoubtOpen(false);
            setCapture(null);
          }}
          source={doubtSource}
          subjectName={context?.subjectName}
          chapterName={context?.chapterName}
          topicName={context?.topicName}
          prefilledCapture={capture}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  jyora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: '#7C3AED',
    minHeight: TOUCH.min,
  },
  avatar: { width: 22, height: 22, borderRadius: 11 },
  jyoraLabel: { fontSize: TYPE.label, fontWeight: '700', color: '#ffffff' },
  doubt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: '#162a6a',
    minHeight: TOUCH.min,
  },
  doubtLabel: { fontSize: TYPE.label, fontWeight: '700', color: '#ffffff' },
  pressed: { opacity: 0.8 },
}));
