import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { TextField } from '../ui';
import { StudentCard, StudentCardTitle, StudentNote } from './StudentCard';
import { formatFileSize, pickFile } from '../../utils/filePicker';
import {
  MAX_WORDS,
  SECTIONS,
  countWords,
  createCodingProject,
  deleteProject,
  fetchCodingProjects,
  fetchLanguageProProject,
  fetchSkillsEdgeProject,
  saveLanguageProProject,
  saveSkillsEdgeProject,
  updateProject,
} from '../../services/student/projectService';

/**
 * My Project — the student's own work, attached to what they are learning.
 *
 * ONE COMPONENT, THREE SHAPES, mirroring the web's single `MyProject.js`:
 *
 *   SKILLS_EDGE   ONE project per learning objective   → straight to the form
 *   LANGUAGE_PRO  ONE project per topic                → straight to the form
 *   CODING        MANY projects                        → a list, with add / edit / delete
 *
 * The single-project sections need no list and no "new project" button: there is exactly one, the
 * server upserts it, and the form is the whole screen. Coding is the only section where a project
 * has an identity the student manages.
 *
 * LANGUAGE_PRO IS SUPPORTED BUT NOT MOUNTED ANYWHERE, deliberately. `StudentProjectController` has
 * the `/languagepro` endpoints and the web's MyProject.js has the branch, but nothing in
 * `frontendmain` ever renders it with that section — Language Pro has no My Project on the website.
 * Wiring one here would be a divergence, not parity, so the branch stays ready and unused; mounting
 * it later is a tab, not a rewrite.
 *
 * FILES ARE ADDITIVE. Each of the three slots is optional on every save, and the server overwrites
 * only what it is sent — so a student editing their title does not lose the video they uploaded last
 * week. That is also why an already-uploaded file shows as a link with "Replace" rather than being
 * pre-loaded into the picker: there is nothing to pre-load, and re-picking is only for replacing.
 */

/** One filter per slot, matching the three `accept` attributes on the web's file inputs. */
const SLOTS = [
  { key: 'videoFile', url: 'videoUrl', label: 'Video', icon: 'videocam-outline', types: ['video/*'] },
  { key: 'pdfFile', url: 'pdfUrl', label: 'PDF', icon: 'document-text-outline', types: ['application/pdf'] },
  {
    key: 'pptFile',
    url: 'pptUrl',
    label: 'Presentation',
    icon: 'easel-outline',
    types: [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
];

const EMPTY_FILES = { videoFile: null, pdfFile: null, pptFile: null };

export default function MyProject({
  section,
  learningObjectiveId,
  topicId,
  chapterName,
  topicName,
  showToast,
}) {
  const styles = useStyles();
  const palette = usePalette();

  const isCoding = section === SECTIONS.CODING;

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Coding only: null while browsing the list, set while adding or editing.
  const [showForm, setShowForm] = useState(!isCoding);
  const [editing, setEditing] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState(EMPTY_FILES);

  const words = countWords(description);
  const overLimit = words > MAX_WORDS;

  /** Load whichever shape this section uses, and for the single-project ones open the form on it. */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isCoding) {
        setProjects(await fetchCodingProjects());
      } else {
        const existing =
          section === SECTIONS.SKILLS_EDGE
            ? await fetchSkillsEdgeProject(learningObjectiveId)
            : await fetchLanguageProProject(topicId);

        // `{"exists": false}` has already been turned into null by the service — a student who has
        // not started yet gets an empty form, not an error.
        setProjects(existing ? [existing] : []);
        setEditing(existing);
        setTitle(existing?.title || '');
        setDescription(existing?.description || '');
        setFiles(EMPTY_FILES);
        setShowForm(true);
      }
    } finally {
      setLoading(false);
    }
  }, [isCoding, section, learningObjectiveId, topicId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFiles(EMPTY_FILES);
    setEditing(null);
    setShowForm(false);
  };

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
      showToast?.(`Description must not exceed ${MAX_WORDS} words. Current: ${words}.`, 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = { title: title.trim(), description: description.trim(), files };
      let saved;

      if (section === SECTIONS.SKILLS_EDGE) {
        saved = await saveSkillsEdgeProject({ ...payload, learningObjectiveId, chapterName, topicName });
      } else if (section === SECTIONS.LANGUAGE_PRO) {
        saved = await saveLanguageProProject({ ...payload, topicId, chapterName, topicName });
      } else if (editing) {
        saved = await updateProject(editing.id, payload);
      } else {
        saved = await createCodingProject(payload);
      }

      showToast?.(editing ? 'Project updated.' : 'Project saved.', 'success');

      if (isCoding) {
        resetForm();
        await load();
      } else if (saved?.id) {
        // Stay on the form with the saved state — the picked files have been uploaded, so clearing
        // them stops a second save from re-uploading the same bytes.
        setProjects([saved]);
        setEditing(saved);
        setTitle(saved.title || '');
        setDescription(saved.description || '');
        setFiles(EMPTY_FILES);
      } else {
        await load();
      }
    } catch (e) {
      showToast?.(e?.message || 'Could not save your project. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const edit = (project) => {
    setEditing(project);
    setTitle(project.title || '');
    setDescription(project.description || '');
    setFiles(EMPTY_FILES);
    setShowForm(true);
  };

  const remove = (project) => {
    Alert.alert('Delete this project?', `"${project.title}" will be removed permanently.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProject(project.id);
            showToast?.('Project deleted.', 'success');
            await load();
          } catch (e) {
            showToast?.(e?.message || 'Could not delete the project.', 'error');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
  }

  /* ── Coding: the list ──────────────────────────────────────────────────── */

  if (isCoding && !showForm) {
    return (
      <>
        {projects.length === 0 ? (
          <StudentCard>
            <StudentNote>
              You have not added any projects yet. Add the things you have built — they are yours to
              show.
            </StudentNote>
          </StudentCard>
        ) : (
          projects.map((p) => (
            <StudentCard key={p.id}>
              <View style={styles.rowHead}>
                <Text style={styles.rowTitle}>{p.title}</Text>
                <Pressable onPress={() => edit(p)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit project">
                  <Ionicons name="create-outline" size={20} color={palette.deep} />
                </Pressable>
                <Pressable onPress={() => remove(p)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete project">
                  <Ionicons name="trash-outline" size={20} color={FEEDBACK.errorText} />
                </Pressable>
              </View>
              {p.description ? <Text style={styles.rowSub}>{p.description}</Text> : null}
              <AttachmentLinks project={p} styles={styles} palette={palette} />
            </StudentCard>
          ))
        )}

        <Pressable
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
          style={({ pressed }) => [styles.save, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.saveText}>Add a project</Text>
        </Pressable>
      </>
    );
  }

  /* ── The form ──────────────────────────────────────────────────────────── */

  return (
    <>
      <StudentCard>
        <StudentCardTitle>
          {isCoding ? (editing ? 'Edit project' : 'New project') : 'My Project'}
        </StudentCardTitle>
        {!isCoding && topicName ? <Text style={styles.scope}>{topicName}</Text> : null}

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
          {words} / {MAX_WORDS} words
        </Text>

        <Text style={styles.slotsLabel}>Attachments (optional)</Text>
        {SLOTS.map((slot) => {
          const picked = files[slot.key];
          const stored = editing?.[slot.url];
          return (
            <Pressable
              key={slot.key}
              onPress={() => attach(slot)}
              style={({ pressed }) => [
                styles.slot,
                (picked || stored) && styles.slotOn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Attach ${slot.label}`}
            >
              <Ionicons
                name={slot.icon}
                size={19}
                color={picked || stored ? palette.deep : SLATE[400]}
              />
              <View style={styles.slotBody}>
                <Text style={styles.slotLabel}>{slot.label}</Text>
                <Text style={styles.slotFile} numberOfLines={1}>
                  {picked
                    ? `${picked.name}${picked.size ? ` · ${formatFileSize(picked.size)}` : ''}`
                    : stored
                      ? 'Uploaded · tap to replace'
                      : 'Tap to choose a file'}
                </Text>
              </View>
              {picked ? (
                <Pressable
                  onPress={() => setFiles((prev) => ({ ...prev, [slot.key]: null }))}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${slot.label}`}
                >
                  <Ionicons name="close-circle" size={20} color={SLATE[400]} />
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}

        {editing ? <AttachmentLinks project={editing} styles={styles} palette={palette} /> : null}
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
          <Text style={styles.saveText}>{editing ? 'Save changes' : 'Save project'}</Text>
        )}
      </Pressable>

      {isCoding ? (
        <Pressable
          onPress={() => {
            resetForm();
            load();
          }}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Back to my projects</Text>
        </Pressable>
      ) : null}
    </>
  );
}

/** Whatever the server already holds, as openable links. Absent slots render nothing. */
function AttachmentLinks({ project, styles, palette }) {
  const present = SLOTS.filter((s) => project?.[s.url]);
  if (!present.length) return null;

  return (
    <View style={styles.links}>
      {present.map((s) => (
        <Pressable
          key={s.url}
          onPress={() => Linking.openURL(project[s.url])}
          // A chip in a wrapped row, so it takes hitSlop rather than 44pt of height — giving it the
          // full minimum would space the row out to nothing but chips.
          hitSlop={8}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          accessibilityRole="link"
        >
          <Ionicons name={s.icon} size={16} color={palette.deep} />
          <Text style={styles.linkText}>Open {s.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginTop: SPACING.xl },
  scope: { fontSize: TYPE.label, fontWeight: '600', color: p.deep, marginBottom: SPACING.sm },

  rowHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  rowTitle: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  rowSub: { fontSize: TYPE.label, color: SLATE[600], lineHeight: leading(TYPE.label), marginTop: 4 },

  textarea: { height: 100, textAlignVertical: 'top' },
  count: { fontSize: TYPE.caption, color: SLATE[500], textAlign: 'right', marginTop: -6, marginBottom: 8 },
  countOver: { color: FEEDBACK.errorText, fontWeight: '700' },

  slotsLabel: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 46,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[50],
    marginBottom: 7,
  },
  slotOn: { borderColor: p.primary, backgroundColor: p.tint },
  slotBody: { flex: 1 },
  slotLabel: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700] },
  slotFile: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 1 },

  links: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  linkText: { fontSize: TYPE.caption, fontWeight: '700', color: p.deep },

  save: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.sm,
  },
  saveOff: { opacity: 0.6 },
  saveText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },

  secondary: {
    alignSelf: 'center',
    marginBottom: SPACING.lg,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  secondaryText: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },

  pressed: { opacity: 0.78 },
}));
