import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DONE, FEEDBACK, SLATE, SPACING, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { EmptyState, useToast } from '../ui';
import RichText from '../RichText';
import StudentScaffold from './StudentScaffold';
import { StudentCard, StudentCardTitle, StudentNote } from './StudentCard';
import AiActionBar from './ai/AiActionBar';
import LimitedAccessNote from './LimitedAccessNote';
import UnderstandingTest from './skillsedge/UnderstandingTest';
import MyProject from './MyProject';
import CertificateSubmission from './skillsedge/CertificateSubmission';
import useStudentAccess from '../../hooks/useStudentAccess';
import { ACCESS } from '../../services/student/accessService';
import { moduleLabel } from '../../constants/skillsEdge';
import { SECTIONS } from '../../services/student/projectService';
import { downloadAndShare } from '../../utils/downloadFile';
import {
  CERTIFICATE_DOWNLOAD,
  fetchCertificateStatus,
  fetchCompletedModules,
  fetchCompletedTopics,
  fetchLearningContent,
  fetchSelectedSkills,
  fetchTopicAssessment,
  fetchTree,
  toggleModuleComplete,
} from '../../services/student/skillsEdgeService';

/**
 * Skills Edge — the student's chosen skills, their learning content, and the project certificate.
 *
 * A FOUR-LEVEL DRILL, and the names do not line up with the role-access entity types:
 *
 *   skill      "Art & Craft"   the category      → entityType CHAPTER
 *   topic      "Calligraphy"   the actual skill  → entityType TOPIC       ← certificates hang here
 *   objective  a learning objective              → entityType LEARNING_OBJECTIVE
 *   module     one piece of content              → entityType MODULE
 *
 * `/api/skillsedge/tree` returns the whole tree; only a module list is fetched per objective.
 *
 * ONLY SKILLS THE STUDENT SELECTED ARE SHOWN — filtered against `/api/skills/profile`
 * `importantSkills`, which is an array of NAMES. A student who has chosen none sees a prompt back
 * to their profile, which is the web's behaviour and not an error.
 *
 * TABS AT TWO LEVELS, both added after the port:
 *   topic     → Learning Objectives | Assessment   (the whole topic's question bank, in one test)
 *   objective → Content | My Project               (one project per objective, upserted)
 * The website has an Assessment button here that was never wired to an endpoint; the backend one it
 * now calls was added with it.
 */

const norm = (s) => String(s || '').trim().toLowerCase();

export default function SkillsEdgeScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const { toast, showToast } = useToast();
  const gate = useStudentAccess('SKILLS_EDGE');

  const [tree, setTree] = useState([]);
  const [selected, setSelected] = useState([]);
  const [doneTopics, setDoneTopics] = useState(new Set());
  const [doneModules, setDoneModules] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // The drill position. Each is null until its parent is chosen.
  const [skill, setSkill] = useState(null);
  const [topic, setTopic] = useState(null);
  const [objective, setObjective] = useState(null);
  const [modules, setModules] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [module, setModule] = useState(null);
  const [moduleTab, setModuleTab] = useState('content');
  /** Topic level: the objective list, or the topic-wide assessment across all of its modules. */
  const [topicTab, setTopicTab] = useState('objectives');
  /** Objective level: its content modules, or the student's own project for that objective. */
  const [objectiveTab, setObjectiveTab] = useState('modules');

  const [cert, setCert] = useState(null);
  const [certLoading, setCertLoading] = useState(false);
  const [certPanel, setCertPanel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // The tree is the only read that can fail the screen — the rest degrade to "nothing done
      // yet" or "no skills chosen", which are both legitimate states.
      const treeData = await fetchTree();
      setTree(treeData);
    } catch (e) {
      setError(e?.message || 'Failed to load Skills Edge resources.');
      setLoading(false);
      return;
    }

    const [sel, topics, mods] = await Promise.allSettled([
      fetchSelectedSkills(),
      fetchCompletedTopics(),
      fetchCompletedModules(),
    ]);
    setSelected(sel.status === 'fulfilled' ? sel.value : []);
    setDoneTopics(topics.status === 'fulfilled' ? topics.value : new Set());
    setDoneModules(mods.status === 'fulfilled' ? mods.value : new Set());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Certificates are per topic, and eligibility changes as modules are ticked. */
  const loadCert = useCallback(async (topicId) => {
    if (!topicId) return;
    setCertLoading(true);
    try {
      setCert(await fetchCertificateStatus(topicId));
    } catch {
      setCert(null);
    } finally {
      setCertLoading(false);
    }
  }, []);

  useEffect(() => {
    if (topic?.id) loadCert(topic.id);
    else setCert(null);
  }, [topic?.id, loadCert]);

  /* ── Access ──────────────────────────────────────────────────────────── */

  /**
   * A node's access level INCLUDING ITS ANCESTORS — the strictest of the chain.
   *
   * Every level used to be checked in isolation, so a module marked accessible under a LOCKED topic
   * read as open. The drill hides that in normal use (you cannot reach the module without passing
   * the topic card) but a deep link goes straight there, and the backend gate gets no further than
   * `SKILLS_EDGE::TOPIC`, so the module endpoint would have served it.
   *
   * ABSENT ANCESTORS ARE DROPPED, and that is not a tidying detail. `nodeAccess` falls back to
   * `access.defaultLevel` for an id it has no rule for — **and `defaultLevel` is LOCKED on monthly
   * plans**. Passing `['TOPIC', undefined]` while the student is still choosing a skill would
   * therefore lock the entire screen for exactly the paying students it should let in.
   */
  const chainLevel = (pairs) => gate.levelOf(pairs.filter(([, id]) => id != null));

  const skillLevel = (s) => chainLevel([['CHAPTER', s?.id]]);
  const topicLevel = (t) => chainLevel([['CHAPTER', skill?.id], ['TOPIC', t?.id]]);
  const objectiveLevel = (lo) =>
    chainLevel([
      ['CHAPTER', skill?.id],
      ['TOPIC', topic?.id],
      ['LEARNING_OBJECTIVE', lo?.id],
    ]);
  const moduleLevel = (m) =>
    chainLevel([
      ['CHAPTER', skill?.id],
      ['TOPIC', topic?.id],
      ['LEARNING_OBJECTIVE', objective?.id],
      ['MODULE', m?.id],
    ]);

  /* ── Drill navigation ────────────────────────────────────────────────── */

  const openSkill = (s) => {
    if (skillLevel(s) === ACCESS.LOCKED) {
      showToast('Upgrade your plan to open this skill.', 'error');
      return;
    }
    setSkill(s);
    setTopic(null);
    setObjective(null);
    setModules([]);
    setModule(null);
    setCertPanel(false);
  };

  const openTopic = (t) => {
    if (topicLevel(t) === ACCESS.LOCKED) {
      showToast('Upgrade your plan to open this topic.', 'error');
      return;
    }
    setTopic(t);
    setObjective(null);
    setModules([]);
    setModule(null);
    setCertPanel(false);
    setTopicTab('objectives');
  };

  const openObjective = async (lo) => {
    if (objectiveLevel(lo) === ACCESS.LOCKED) {
      showToast('Upgrade your plan to open this objective.', 'error');
      return;
    }
    setObjective(lo);
    setModule(null);
    setObjectiveTab('modules');
    setModulesLoading(true);
    try {
      setModules(await fetchLearningContent(lo.id));
    } catch {
      setModules([]);
    } finally {
      setModulesLoading(false);
    }
  };

  const openModule = (m) => {
    if (moduleLevel(m) === ACCESS.LOCKED) {
      showToast('Upgrade your plan to open this module.', 'error');
      return;
    }
    setModule(m);
    setModuleTab('content');
  };

  /** One step back up the drill — the hardware back button's counterpart. */
  const back = () => {
    if (certPanel) return setCertPanel(false);
    if (module) return setModule(null);
    if (objective) {
      setObjective(null);
      setModules([]);
      return;
    }
    if (topic) return setTopic(null);
    if (skill) return setSkill(null);
    router.back();
  };

  const toggleModule = async (moduleId) => {
    try {
      const res = await toggleModuleComplete(moduleId);
      setDoneModules((prev) => {
        const next = new Set(prev);
        if (res?.completed) next.add(moduleId);
        else next.delete(moduleId);
        return next;
      });
      // Ticking the last module makes the skill certifiable — refresh so the bar goes live now
      // rather than on the next visit.
      if (topic?.id) loadCert(topic.id);
    } catch (e) {
      showToast(e?.message || 'Could not update your progress.', 'error');
    }
  };

  const viewCertificate = async () => {
    const id = cert?.submission?.id;
    if (!id) return;
    try {
      // Streamed through an authenticated endpoint — the S3 URL is never exposed. The student
      // token, not the staff one, or this 401s.
      await downloadAndShare(
        CERTIFICATE_DOWNLOAD(id),
        `certificate-${topic?.name || 'skill'}.pdf`,
        'application/pdf',
        'studentToken',
      );
    } catch (e) {
      showToast(e?.message || 'Could not open the certificate.', 'error');
    }
  };

  const openUrl = (url) => {
    if (url) Linking.openURL(url).catch(() => showToast('Could not open that link.', 'error'));
  };

  /* ── Derived lists ───────────────────────────────────────────────────── */

  // Chosen skills only, then the access filters. `importantSkills` holds names, so the match is
  // by normalised name — ids are not comparable across the two endpoints.
  const chosen = new Set(selected.map(norm));
  const skills = gate
    .visible('CHAPTER', tree)
    .filter((s) => chosen.has(norm(s.name)));

  const topics = gate.visible('TOPIC', skill?.topics || []);
  const objectives = gate.visible('LEARNING_OBJECTIVE', topic?.learningObjectives || []);
  const visibleModules = gate.visible('MODULE', modules);

  /* ── Certificate bar — six states, driven by reason + submission status ── */

  const renderCertBar = () => {
    if (certLoading && !cert) {
      return (
        <StudentCard>
          <Text style={styles.certChip}>Checking certificate eligibility…</Text>
        </StudentCard>
      );
    }
    if (!cert) return null;

    const { eligible, reason, totalModules, completedModules: done, submission } = cert;
    const status = submission?.status;

    if (status === 'APPROVED') {
      return (
        <StudentCard>
          <Text style={styles.certIssued}>
            🎓 Certificate issued
            {submission.certificateNumber ? ` · ${submission.certificateNumber}` : ''}
          </Text>
          <Pressable
            onPress={viewCertificate}
            style={({ pressed }) => [styles.certBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.certBtnText}>View Certificate</Text>
          </Pressable>
        </StudentCard>
      );
    }

    if (status === 'PENDING') {
      return (
        <StudentCard>
          <Text style={styles.certChip}>⏳ Certificate request under review</Text>
          <Pressable
            onPress={() => setCertPanel(true)}
            style={({ pressed }) => [styles.certBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.certBtnText}>View / edit submission</Text>
          </Pressable>
        </StudentCard>
      );
    }

    if (status === 'REJECTED') {
      return (
        <StudentCard>
          <Text style={styles.certRejected}>✎ Changes requested</Text>
          {submission.adminRemark ? (
            <Text style={styles.certNote}>{submission.adminRemark}</Text>
          ) : null}
          <Pressable
            onPress={() => setCertPanel(true)}
            style={({ pressed }) => [styles.certBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.certBtnText}>Revise &amp; Resubmit</Text>
          </Pressable>
        </StudentCard>
      );
    }

    if (eligible) {
      return (
        <StudentCard>
          <Text style={styles.certReady}>✅ All {totalModules} modules complete</Text>
          <Pressable
            onPress={() => setCertPanel(true)}
            style={({ pressed }) => [styles.certBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.certBtnText}>Submit Project for Certificate</Text>
          </Pressable>
        </StudentCard>
      );
    }

    if (reason === 'PLAN_LOCKED') {
      return (
        <StudentCard>
          <Text style={styles.certChip}>🔒 Certification not available on your plan</Text>
          <Text style={styles.certNote}>Upgrade to unlock this skill and earn its certificate.</Text>
        </StudentCard>
      );
    }

    const notes = {
      NO_MODULES_PUBLISHED: "Learning content for this skill hasn't been published yet.",
      MODULES_INCOMPLETE: 'Finish every module in this skill to unlock your certificate.',
    };
    return (
      <StudentCard>
        <Text style={styles.certChip}>
          🎓 Modules {done}/{totalModules}
        </Text>
        {notes[reason] ? <Text style={styles.certNote}>{notes[reason]}</Text> : null}
      </StudentCard>
    );
  };

  /* ── Levels ──────────────────────────────────────────────────────────── */

  const renderSkills = () =>
    skills.length === 0 ? (
      <EmptyState
        icon="construct-outline"
        title="No skills chosen yet"
        message="Pick the skills you care about in your profile, and their learning content appears here."
        actionLabel="Go to Profile"
        onAction={() => router.push('/student/profile')}
      />
    ) : (
      skills.map((s) => {
        const locked = skillLevel(s) === ACCESS.LOCKED;
        return (
          <Pressable
            key={s.id}
            onPress={() => openSkill(s)}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <StudentCard style={locked ? styles.lockedCard : undefined}>
              <View style={styles.rowHead}>
                <Text style={styles.rowTitle}>{s.name}</Text>
                <Ionicons
                  name={locked ? 'lock-closed' : 'chevron-forward'}
                  size={16}
                  color={locked ? SLATE[400] : palette.deep}
                />
              </View>
              <Text style={styles.rowSub}>
                {(s.topics || []).length} {(s.topics || []).length === 1 ? 'skill' : 'skills'}
              </Text>
            </StudentCard>
          </Pressable>
        );
      })
    );

  const renderTopics = () => (
    <>
      {topics.length === 0 ? (
        <StudentCard>
          <StudentNote>No skills have been published under this category yet.</StudentNote>
        </StudentCard>
      ) : (
        topics.map((t) => {
          const locked = topicLevel(t) === ACCESS.LOCKED;
          const done = doneTopics.has(t.id);
          return (
            <Pressable
              key={t.id}
              onPress={() => openTopic(t)}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <StudentCard style={locked ? styles.lockedCard : undefined}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowTitle}>{t.name}</Text>
                  {done ? <Ionicons name="checkmark-circle" size={16} color={DONE} /> : null}
                  <Ionicons
                    name={locked ? 'lock-closed' : 'chevron-forward'}
                    size={16}
                    color={locked ? SLATE[400] : palette.deep}
                  />
                </View>
                <Text style={styles.rowSub}>
                  {(t.learningObjectives || []).length} learning objectives
                </Text>
              </StudentCard>
            </Pressable>
          );
        })
      )}
    </>
  );

  /**
   * The topic view: its learning objectives, or one assessment drawn from every module beneath it.
   *
   * The website has this Assessment button and never wired it to anything. It is a separate thing
   * from a module's "Test Your Understanding" — same question bank, but sampled across the whole
   * topic rather than one module — so it reuses `UnderstandingTest` with a different loader instead
   * of duplicating the scorer.
   */
  const renderTopicBody = () => (
    <>
      <View style={styles.tabRow}>
        {[
          { key: 'objectives', label: 'Learning Objectives' },
          { key: 'assessment', label: 'Assessment' },
        ].map((t) => {
          const on = topicTab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTopicTab(t.key)}
              style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {topicTab === 'assessment' ? (
        // Keyed on the topic so switching topics starts a fresh attempt rather than carrying the
        // previous topic's answers across — the same reason the module test is keyed.
        <UnderstandingTest
          key={`assessment-${topic.id}`}
          moduleId={topic.id}
          loadQuestions={fetchTopicAssessment}
          showToast={showToast}
          // Skills Edge's vocabulary mapped onto the generator's: skill→subject, topic→chapter.
          topicName={topic?.name || ''}
          subjectName={skill?.name || 'Skills Edge'}
          chapterName={topic?.name || ''}
        />
      ) : (
        renderObjectives()
      )}
    </>
  );

  const renderObjectives = () => (
    <>
      {renderCertBar()}
      {objectives.length === 0 ? (
        <StudentCard>
          <StudentNote>No learning objectives yet for this skill.</StudentNote>
        </StudentCard>
      ) : (
        objectives.map((lo) => {
          const locked = objectiveLevel(lo) === ACCESS.LOCKED;
          return (
            <Pressable
              key={lo.id}
              onPress={() => openObjective(lo)}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <StudentCard style={locked ? styles.lockedCard : undefined}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowTitle}>{lo.text || lo.name}</Text>
                  <Ionicons
                    name={locked ? 'lock-closed' : 'chevron-forward'}
                    size={16}
                    color={locked ? SLATE[400] : palette.deep}
                  />
                </View>
              </StudentCard>
            </Pressable>
          );
        })
      )}
    </>
  );

  /**
   * The objective view: its modules, or the student's project for that objective.
   *
   * SKILLS EDGE KEYS ITS PROJECT ON THE LEARNING OBJECTIVE, not the topic — one project per
   * objective, upserted. Language Pro keys the same component on a topic instead, which is why
   * `MyProject` takes a section rather than assuming either.
   */
  const renderObjectiveBody = () => (
    <>
      <View style={styles.tabRow}>
        {[
          { key: 'modules', label: 'Content' },
          { key: 'project', label: 'My Project' },
        ].map((t) => {
          const on = objectiveTab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setObjectiveTab(t.key)}
              style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {objectiveTab === 'project' ? (
        <MyProject
          key={`project-${objective.id}`}
          section={SECTIONS.SKILLS_EDGE}
          learningObjectiveId={objective.id}
          chapterName={skill?.name || ''}
          topicName={topic?.name || ''}
          showToast={showToast}
        />
      ) : (
        renderModules()
      )}
    </>
  );

  const renderModules = () => {
    if (modulesLoading) {
      return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
    }
    if (visibleModules.length === 0) {
      return (
        <StudentCard>
          <StudentNote>No content has been published for this objective yet.</StudentNote>
        </StudentCard>
      );
    }
    return visibleModules.map((m, i) => {
      const locked = moduleLevel(m) === ACCESS.LOCKED;
      const done = doneModules.has(m.id);
      return (
        <Pressable
          key={m.id}
          onPress={() => openModule(m)}
          style={({ pressed }) => [pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <StudentCard style={locked ? styles.lockedCard : undefined}>
            <View style={styles.rowHead}>
              <Ionicons
                name={done ? 'checkmark-circle' : 'ellipse-outline'}
                size={17}
                color={done ? DONE : SLATE[300]}
              />
              <Text style={styles.rowTitle}>{moduleLabel(m, i)}</Text>
              <Ionicons
                name={locked ? 'lock-closed' : 'chevron-forward'}
                size={16}
                color={locked ? SLATE[400] : palette.deep}
              />
            </View>
          </StudentCard>
        </Pressable>
      );
    });
  };

  /**
   * The open module's display name.
   *
   * Its index comes from the list the student is actually looking at (`visibleModules`, already
   * filtered of hidden nodes) so the label on the detail screen matches the card they tapped. A
   * module missing from that list — reached by a deep link — falls back to position 0, which
   * `moduleLabel` then resolves through `moduleOrder`.
   */
  const openModuleLabel = () => {
    const i = visibleModules.findIndex((m) => m.id === module?.id);
    return moduleLabel(module, i < 0 ? 0 : i);
  };

  const renderModule = () => (
    <>
      <View style={styles.tabRow}>
        {[
          { key: 'content', label: 'Content' },
          { key: 'understanding', label: 'Test Your Understanding' },
        ].map((t) => {
          const on = moduleTab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setModuleTab(t.key)}
              style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {moduleTab === 'understanding' ? (
        // Keyed on the module so switching modules restarts the test rather than carrying
        // the previous module's answers over.
        <UnderstandingTest
          key={module.id}
          moduleId={module.id}
          showToast={showToast}
          // Skills Edge's vocabulary mapped onto the generator's: skill→subject, topic→chapter.
          topicName={openModuleLabel()}
          subjectName={skill?.name || 'Skills Edge'}
          chapterName={topic?.name || ''}
        />
      ) : (
        <>
          <StudentCard>
            <StudentCardTitle>{openModuleLabel()}</StudentCardTitle>

            {/* Skills Edge names its levels differently: the SKILL plays the part of the subject
                and the TOPIC that of the chapter, with the module title as the topic. That is the
                mapping the web's own call site uses. */}
            <AiActionBar
              contentLabel="Module Content"
              context={{
                subjectName: skill?.name || 'Skills Edge',
                chapterName: topic?.name || '',
                topicName: openModuleLabel(),
                contentLabel: 'Module Content',
                contentHtml: module.textContent || '',
              }}
            />

            {module.textContent ? (
              <RichText html={module.textContent} />
            ) : (
              <StudentNote>No written content for this module.</StudentNote>
            )}
            {module.videoUrl ? (
              <Pressable
                onPress={() => openUrl(module.videoUrl)}
                style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed]}
              >
                <Ionicons name="videocam-outline" size={15} color={palette.deep} />
                <Text style={styles.mediaText}>Watch the video</Text>
              </Pressable>
            ) : null}
            {module.imageUrl ? (
              <Pressable
                onPress={() => openUrl(module.imageUrl)}
                style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed]}
              >
                <Ionicons name="image-outline" size={15} color={palette.deep} />
                <Text style={styles.mediaText}>View the image</Text>
              </Pressable>
            ) : null}
            {module.pdfUrl ? (
              <Pressable
                onPress={() => openUrl(module.pdfUrl)}
                style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed]}
              >
                <Ionicons name="document-text-outline" size={15} color={palette.deep} />
                <Text style={styles.mediaText}>Open the PDF</Text>
              </Pressable>
            ) : null}
          </StudentCard>

          <Pressable
            onPress={() => toggleModule(module.id)}
            style={({ pressed }) => [
              styles.completeBtn,
              doneModules.has(module.id) && styles.completeOn,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Ionicons
              name={doneModules.has(module.id) ? 'checkmark-circle' : 'ellipse-outline'}
              size={17}
              color={doneModules.has(module.id) ? '#ffffff' : palette.onPrimary}
            />
            <Text
              style={[styles.completeText, doneModules.has(module.id) && styles.completeTextOn]}
            >
              {doneModules.has(module.id) ? 'Completed' : 'Mark as complete'}
            </Text>
          </Pressable>
        </>
      )}
    </>
  );

  const body = () => {
    if (certPanel) {
      return (
        <CertificateSubmission
          topicId={topic?.id}
          skillName={topic?.name}
          submission={cert?.submission}
          showToast={showToast}
          onDone={() => {
            setCertPanel(false);
            loadCert(topic?.id);
          }}
        />
      );
    }
    if (module) return renderModule();
    if (objective) return renderObjectiveBody();
    if (topic) return renderTopicBody();
    if (skill) return renderTopics();
    return renderSkills();
  };

  // The trail doubles as the screen subtitle — four levels deep, a title alone loses the student.
  const trail = [
    skill?.name,
    topic?.name,
    objective?.text || objective?.name,
    module ? openModuleLabel() : null,
  ]
    .filter(Boolean)
    .join(' › ');

  return (
    <StudentScaffold
      title="Skill Edge"
      loading={loading || gate.loading}
      error={error}
      onRetry={load}
      toast={toast}
    >
      {gate.limited && !gate.loading ? <LimitedAccessNote /> : null}

      {trail ? (
        <Pressable
          onPress={back}
          style={({ pressed }) => [styles.crumb, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back one level"
        >
          <Ionicons name="arrow-back" size={14} color={palette.onDark} />
          <Text style={styles.crumbText} numberOfLines={1}>
            {trail}
          </Text>
        </Pressable>
      ) : null}

      {body()}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },

  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: p.glass,
    borderWidth: 1,
    borderColor: p.glassBorder,
    marginBottom: SPACING.md,
  },
  crumbText: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: p.onDark },

  rowHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  rowTitle: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  rowSub: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 3 },
  lockedCard: { opacity: 0.6 },

  certChip: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[600] },
  certIssued: { fontSize: TYPE.body, fontWeight: '700', color: FEEDBACK.successOnBg },
  certRejected: { fontSize: TYPE.body, fontWeight: '700', color: FEEDBACK.warningText },
  certReady: { fontSize: TYPE.body, fontWeight: '700', color: FEEDBACK.successOnBg },
  certNote: { fontSize: TYPE.label, color: SLATE[500], lineHeight: 18, marginTop: 3 },
  certBtn: {
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: p.primary,
  },
  certBtnText: { fontSize: TYPE.label, fontWeight: '700', color: p.onPrimary },

  tabRow: { flexDirection: 'row', gap: 7, marginBottom: SPACING.md },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: p.headerBorder,
  },
  tabOn: { backgroundColor: p.primary, borderColor: p.primary },
  tabText: { fontSize: TYPE.label, fontWeight: '600', color: p.onDark },
  tabTextOn: { color: p.onPrimary },

  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: SPACING.sm,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: p.tint,
  },
  mediaText: { fontSize: TYPE.label, fontWeight: '600', color: p.deep },

  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.lg,
  },
  completeOn: { backgroundColor: DONE },
  completeText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  // `onPrimary` is near-black — correct on the light-blue button, unreadable on the green one.
  completeTextOn: { color: '#ffffff' },

  pressed: { opacity: 0.78 },
}));
