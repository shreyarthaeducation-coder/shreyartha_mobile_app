import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { TextField } from '../../ui';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import { pickFile, formatFileSize } from '../../../utils/filePicker';
import {
  MAX_DESCRIPTION_WORDS,
  submitCertificateProject,
  wordCount,
} from '../../../services/student/skillsEdgeService';

/**
 * Submit a project to earn a skill's certificate.
 *
 * A certificate belongs to a TOPIC — the skill itself ("Calligraphy"), not the category it sits
 * under ("Art & Craft") — so `topicId` is what identifies it.
 *
 * A `REJECTED` submission turns this into a revision: the previous title and description are
 * pre-filled and the wording changes, because the student is answering an admin's remark rather
 * than starting over. Files are NOT pre-filled — the server holds them, and re-picking is only
 * needed if they are actually replacing one.
 */

// One filter per slot, matching the three `accept` attributes on the web's file inputs.
const SLOTS = [
  { key: 'video', label: 'Video', icon: 'videocam-outline', types: ['video/*'] },
  { key: 'pdf', label: 'PDF', icon: 'document-text-outline', types: ['application/pdf'] },
  {
    key: 'ppt',
    label: 'Presentation',
    icon: 'easel-outline',
    types: [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
];

export default function CertificateSubmission({ topicId, skillName, submission, onDone, showToast }) {
  const styles = useStyles();
  const palette = usePalette();

  const isRevision = submission?.status === 'REJECTED';
  const [title, setTitle] = useState(submission?.title || '');
  const [description, setDescription] = useState(submission?.description || '');
  const [files, setFiles] = useState({ video: null, pdf: null, ppt: null });
  const [saving, setSaving] = useState(false);

  const words = wordCount(description);
  const overLimit = words > MAX_DESCRIPTION_WORDS;

  // `pickFile` resolves null on cancel — there is no permission branch to handle, the document
  // picker is a system UI that returns nothing rather than refusing.
  const attach = async (slot) => {
    const picked = await pickFile(slot.types);
    if (picked) setFiles((prev) => ({ ...prev, [slot.key]: picked }));
  };

  const submit = async () => {
    if (!title.trim()) {
      showToast?.('Please give your project a title.', 'error');
      return;
    }
    if (overLimit) {
      showToast?.(
        `Description must not exceed ${MAX_DESCRIPTION_WORDS} words. Current: ${words}.`,
        'error',
      );
      return;
    }

    setSaving(true);
    try {
      const saved = await submitCertificateProject({
        topicId,
        title: title.trim(),
        description: description.trim(),
        video: files.video,
        pdf: files.pdf,
        ppt: files.ppt,
      });
      showToast?.(
        isRevision
          ? 'Your revised project has been sent for review.'
          : "Project submitted. You'll be notified once it's reviewed.",
        'success',
      );
      setFiles({ video: null, pdf: null, ppt: null });
      onDone?.(saved);
    } catch (e) {
      showToast?.(e?.message || "We couldn't submit your project. Please try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <StudentCard>
        <StudentCardTitle>
          {isRevision ? 'Revise your project' : 'Submit project for certificate'}
        </StudentCardTitle>
        {skillName ? <Text style={styles.skill}>{skillName}</Text> : null}

        {isRevision && submission?.adminRemark ? (
          <View style={styles.remark}>
            <Text style={styles.remarkLabel}>Changes requested</Text>
            <Text style={styles.remarkText}>{submission.adminRemark}</Text>
          </View>
        ) : null}

        <TextField
          label="Project title *"
          value={title}
          onChangeText={setTitle}
          placeholder="What did you make?"
        />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          inputStyle={styles.textarea}
          placeholder="Briefly describe what you built and what you learned."
        />
        <Text style={[styles.count, overLimit && styles.countOver]}>
          {words} / {MAX_DESCRIPTION_WORDS} words
        </Text>

        <Text style={styles.slotsLabel}>Attachments (optional)</Text>
        {SLOTS.map((slot) => {
          const file = files[slot.key];
          return (
            <Pressable
              key={slot.key}
              onPress={() => attach(slot)}
              style={({ pressed }) => [styles.slot, file && styles.slotOn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Attach ${slot.label}`}
            >
              <Ionicons name={slot.icon} size={17} color={file ? palette.deep : SLATE[400]} />
              <View style={styles.slotBody}>
                <Text style={styles.slotLabel}>{slot.label}</Text>
                <Text style={styles.slotFile} numberOfLines={1}>
                  {file ? `${file.name}${file.size ? ` · ${formatFileSize(file.size)}` : ''}` : 'Tap to choose a file'}
                </Text>
              </View>
              {file ? (
                <Pressable
                  onPress={() => setFiles((prev) => ({ ...prev, [slot.key]: null }))}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${slot.label}`}
                >
                  <Ionicons name="close-circle" size={18} color={SLATE[400]} />
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </StudentCard>

      <Pressable
        onPress={submit}
        disabled={saving}
        style={({ pressed }) => [styles.save, saving && styles.saveOff, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {saving ? (
          <ActivityIndicator size="small" color={palette.onPrimary} />
        ) : (
          <Text style={styles.saveText}>{isRevision ? 'Resubmit for review' : 'Submit project'}</Text>
        )}
      </Pressable>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  skill: { fontSize: TYPE.label, fontWeight: '600', color: p.deep, marginBottom: SPACING.sm },
  remark: {
    backgroundColor: FEEDBACK.warningBg,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  remarkLabel: { fontSize: TYPE.micro, fontWeight: '800', color: FEEDBACK.warningOnBg, textTransform: 'uppercase' },
  remarkText: { fontSize: TYPE.label, color: '#78350f', lineHeight: 18, marginTop: 2 },

  textarea: { height: 100, textAlignVertical: 'top' },
  count: { fontSize: TYPE.caption, color: SLATE[500], textAlign: 'right', marginTop: -6, marginBottom: 8 },
  countOver: { color: FEEDBACK.errorText, fontWeight: '700' },

  slotsLabel: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: SLATE[300],
    marginBottom: 7,
  },
  slotOn: { borderStyle: 'solid', borderColor: p.primary, backgroundColor: p.tint },
  slotBody: { flex: 1 },
  slotLabel: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700] },
  slotFile: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 1 },

  save: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.lg,
  },
  saveOff: { backgroundColor: SLATE[400] },
  saveText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  pressed: { opacity: 0.78 },
}));
