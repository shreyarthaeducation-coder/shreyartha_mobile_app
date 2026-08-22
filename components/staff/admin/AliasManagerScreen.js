import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { Card, EmptyState, ScreenScaffold, StatusChip, TextField, useToast } from '../../ui';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  clearAlias,
  countAliases,
  fetchAliasTree,
  saveAlias,
} from '../../../services/admin/aliasService';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * ONE SCREEN FOR ALL THREE ALIAS MANAGERS — Academic IQ, Language Pro and Coding Pro.
 *
 * The web keeps three near-identical files (330 + 311 + 311 lines) that differ in exactly two
 * ways: the namespace, and how deep the tree is. Both are props here.
 *
 *   Academic IQ   class → subject → chapter → topic
 *   Language Pro  class → chapter → topic
 *   Coding Pro    class → chapter → topic
 *
 * `levels` (from ALIAS_TREES) names the child array at each depth, so the renderer walks the real
 * shape instead of assuming one. Hardcoding four levels would show Language Pro an empty tree;
 * hardcoding three would hide every Academic IQ topic behind an unrendered subject tier.
 *
 * The web renders the whole tree expanded with an input beside every topic. On a phone that is
 * thousands of rows, so every level here is a collapsed accordion and edits open per topic.
 */

function AliasRow({ topic, apiBase, onSaved }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const [name, setName] = useState(topic.aliasName || '');
  const [order, setOrder] = useState(
    topic.aliasDisplayOrder == null ? '' : String(topic.aliasDisplayOrder),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const dirty =
    name !== (topic.aliasName || '') ||
    order !== (topic.aliasDisplayOrder == null ? '' : String(topic.aliasDisplayOrder));

  const run = async (fn, okMessage) => {
    setBusy(true);
    setMessage('');
    try {
      await fn();
      setMessage(okMessage);
      onSaved();
    } catch (e) {
      setMessage(e?.message || 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.topicName} numberOfLines={2}>
          {topic.name}
        </Text>
        {topic.aliasName ? <StatusChip label="Aliased" tone="info" /> : null}
      </View>

      <TextField
        label="Alias"
        value={name}
        onChangeText={setName}
        placeholder={topic.name}
      />
      <TextField
        label="Display order"
        value={order}
        onChangeText={setOrder}
        placeholder="Platform default"
        keyboardType="number-pad"
      />

      <View style={styles.rowActions}>
        <Pressable
          onPress={() =>
            run(() => saveAlias(apiBase, topic.id, { aliasName: name, displayOrder: order }), 'Saved.')
          }
          disabled={busy || !dirty}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: PALETTE.primary },
            (pressed || busy || !dirty) && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() =>
            run(async () => {
              await clearAlias(apiBase, topic.id);
              setName('');
              setOrder('');
            }, 'Cleared.')
          }
          disabled={busy || (!topic.aliasName && topic.aliasDisplayOrder == null)}
          style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
        {message ? <Text style={styles.rowMessage}>{message}</Text> : null}
      </View>
    </View>
  );
}

/** One accordion level. Recurses until `levels` runs out, then renders alias rows. */
function TreeLevel({ nodes, levels, depth, apiBase, onSaved, path }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const [open, setOpen] = useState({});

  if (depth >= levels.length) {
    return (
      <View>
        {(nodes || []).map((topic) => (
          <AliasRow key={topic.id} topic={topic} apiBase={apiBase} onSaved={onSaved} />
        ))}
      </View>
    );
  }

  const childKey = levels[depth];

  return (
    <View>
      {(nodes || []).map((node) => {
        const key = `${path}/${node.id}`;
        const expanded = !!open[key];
        const children = node[childKey] || [];
        return (
          <View key={key} style={[styles.node, depth > 0 && styles.nodeNested]}>
            <Pressable
              onPress={() => setOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
              style={({ pressed }) => [styles.nodeHead, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
            >
              <Ionicons
                name={expanded ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={PALETTE.primaryDark}
              />
              <Text style={styles.nodeName} numberOfLines={2}>
                {node.aliasName || node.name}
              </Text>
              <Text style={styles.nodeCount}>{children.length}</Text>
            </Pressable>
            {expanded ? (
              <View style={styles.nodeBody}>
                <TreeLevel
                  nodes={children}
                  levels={levels}
                  depth={depth + 1}
                  apiBase={apiBase}
                  onSaved={onSaved}
                  path={key}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default function AliasManagerScreen({ homeRoute, apiBase, title, levels }) {
  const styles = useStyles();
  const { toast, showToast } = useToast();

  const fetcher = useCallback((signal) => fetchAliasTree(apiBase, signal), [apiBase]);
  const { data, loading, error, refreshing, reload, refresh, revalidate } = useStaffResource(
    fetcher,
    { initialData: [] },
  );

  const roots = data || [];
  const counts = useMemo(() => countAliases(roots, levels), [roots, levels]);

  const onSaved = useCallback(() => {
    // Silent re-read so the "Aliased" chips and the counter stay honest without a spinner.
    revalidate();
    showToast('Alias updated.', 'success');
  }, [revalidate, showToast]);

  return (
    <ScreenScaffold
      title={title}
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <Text style={styles.intro}>
        Rename or reorder topics for your school&apos;s users only. Changes apply everywhere your
        students see these topics.
      </Text>
      <Card style={styles.summary}>
        <Text style={styles.summaryText}>
          <Text style={styles.summaryStrong}>{counts.aliased}</Text> of {counts.total} topics
          aliased
        </Text>
      </Card>

      {roots.length === 0 ? (
        <EmptyState
          icon="pricetag-outline"
          title="Nothing to alias yet"
          message="No classes are linked to curriculum content for your school."
        />
      ) : (
        <TreeLevel
          nodes={roots}
          levels={levels}
          depth={0}
          apiBase={apiBase}
          onSaved={onSaved}
          path="root"
        />
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  intro: { fontSize: 13, color: SLATE[500], lineHeight: 19 },
  summary: { marginTop: SPACING.sm, marginBottom: SPACING.sm },
  summaryText: { fontSize: 13, color: SLATE[600] },
  summaryStrong: { fontWeight: '800', color: p.primaryDark },
  node: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    backgroundColor: '#ffffff',
    marginBottom: 8,
    overflow: 'hidden',
  },
  nodeNested: { borderColor: SLATE[100], marginBottom: 6 },
  nodeHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.sm },
  nodeName: { flex: 1, fontSize: 14, fontWeight: '700', color: SLATE[800] },
  nodeCount: {
    fontSize: 11.5,
    fontWeight: '700',
    color: p.primaryDark,
    backgroundColor: p.tint,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  nodeBody: { paddingHorizontal: SPACING.sm, paddingBottom: SPACING.sm },
  pressed: { opacity: 0.7 },
  row: {
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  topicName: { flex: 1, fontSize: 13.5, fontWeight: '700', color: SLATE[700] },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  saveBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  clearBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  clearText: { color: SLATE[600], fontWeight: '700', fontSize: 13 },
  rowMessage: { fontSize: 12, color: SLATE[500], flex: 1 },
}));
