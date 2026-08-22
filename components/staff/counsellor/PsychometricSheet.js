import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';
import { SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../../components/ui/PaletteContext';
import { FormSheet, StatusChip } from '../../ui';
import {
  fetchPsychometricTree,
  fetchStudentEnables,
  fetchStudentStatus,
  toggleTopicEnabled,
} from '../../../services/counsellor/psychometricService';
import { fetchHiddenNodes } from '../../../services/teacher/upskillService';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * "🧠 Enable Psychometric" — per-student switches over the admin's psychometric topic tree.
 *
 * Read-only sheet with live writes: each switch posts immediately (the endpoint upserts) rather
 * than batching into a Save, because there is no save endpoint to batch into.
 *
 * Hidden nodes are honoured — `/api/public/hidden-nodes/PSYCHOMETRIC` is the admin's take-down
 * list, and skipping it shows counsellors content that was deliberately removed.
 */


export default function PsychometricSheet({ visible, student, onClose, showToast }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const [tree, setTree] = useState([]);
  const [enables, setEnables] = useState({});
  const [status, setStatus] = useState({});
  const [hidden, setHidden] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyTopic, setBusyTopic] = useState(null);

  const studentId = student?.studentId;

  // The parent passes inline arrows; holding them in a ref keeps the effect keyed on ids alone.
  // Putting onClose/showToast in the deps is what looped the teacher panel's report sheets.
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  useEffect(() => {
    if (!visible || !studentId) return undefined;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [treeData, enableData, statusData, hiddenData] = await Promise.all([
          fetchPsychometricTree(),
          fetchStudentEnables(studentId),
          fetchStudentStatus(studentId).catch(() => ({})),
          fetchHiddenNodes(undefined, 'PSYCHOMETRIC'),
        ]);
        if (!alive) return;
        setTree(Array.isArray(treeData) ? treeData : []);
        setEnables(enableData || {});
        setStatus(statusData || {});
        setHidden(hiddenData);
      } catch (e) {
        if (alive) toastRef.current?.(e?.message || 'Could not load the psychometric tree.', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [visible, studentId]);

  const toggle = async (topic, next) => {
    setBusyTopic(topic.id);
    // Optimistic: the switch is the only feedback, and a round trip of lag reads as a dead control.
    setEnables((prev) => ({ ...prev, [topic.id]: next }));
    try {
      await toggleTopicEnabled({ studentId, topicId: topic.id, enabled: next });
    } catch (e) {
      setEnables((prev) => ({ ...prev, [topic.id]: !next }));
      toastRef.current?.(e?.message || 'Could not change that setting.', 'error');
    } finally {
      setBusyTopic(null);
    }
  };

  const isHidden = (type, id) => hidden?.[type]?.has(Number(id));

  return (
    <FormSheet
      visible={visible}
      title="Enable Psychometric"
      subtitle={student?.studentName}
      onClose={onClose}
      fullHeight
    >
      {loading ? (
        <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
      ) : tree.length === 0 ? (
        <Text style={styles.empty}>No psychometric content is available.</Text>
      ) : (
        tree
          .filter((node) => !isHidden('CHAPTER', node.id))
          .map((node) => {
            const topics = (node.topics || []).filter((t) => !isHidden('TOPIC', t.id));
            if (topics.length === 0) return null;
            return (
              <View key={node.id} style={styles.group}>
                <Text style={styles.groupTitle}>{node.name || node.className}</Text>
                {topics.map((topic) => {
                  const on = !!enables[topic.id];
                  const state = status?.[topic.id];
                  return (
                    <View key={topic.id} style={styles.row}>
                      <View style={styles.rowText}>
                        <Text style={styles.topicName}>{topic.name || topic.topicName}</Text>
                        {state?.completed ? (
                          <StatusChip label="Completed" tone="success" style={styles.chip} />
                        ) : state?.attempted ? (
                          <StatusChip label="In progress" tone="warning" style={styles.chip} />
                        ) : null}
                      </View>
                      <Switch
                        value={on}
                        onValueChange={(next) => toggle(topic, next)}
                        disabled={busyTopic === topic.id}
                        trackColor={{ true: PALETTE.primary, false: SLATE[200] }}
                        thumbColor="#ffffff"
                      />
                    </View>
                  );
                })}
              </View>
            );
          })
      )}
    </FormSheet>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },
  empty: { fontSize: 13, color: SLATE[500], textAlign: 'center', paddingVertical: SPACING.xl },
  group: { marginBottom: SPACING.md },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: p.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  rowText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  topicName: { fontSize: 13.5, color: SLATE[700] },
  chip: { marginLeft: 0 },
}));
