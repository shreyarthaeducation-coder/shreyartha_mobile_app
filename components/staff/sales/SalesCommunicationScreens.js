import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { EmptyState, FormSheet, ScreenScaffold, SegmentedTabs, StatusChip, useToast } from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import useStaffResource from '../../../hooks/useStaffResource';
import { staffApi } from '../../../services/staffApi';
import { downloadAndShare } from '../../../utils/downloadFile';
import FieldsSheet from '../../portal/FieldsSheet';
import { pickFile } from '../../../utils/filePicker';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Email & Communication (5 Nov 2026) — the website's SalesCommunications, the rep's CRM: every
 * school they work (their leads, plus onboarded schools no lead of theirs covers), most recently
 * contacted first, and for one school its shared history with Email / Log a call / Add note.
 *
 * `/api/staff/sales/crm`. The email form is the website's, attachments included (6 Nov 2026) under
 * the compose answer's own limits; attachments anyone sent are opened from the history.
 */

const CRM = '/api/staff/sales/crm';
const ROOT = '/staff/sales';

const CHANNELS = {
  EMAIL: { icon: 'mail-outline', label: 'Email' },
  CALL: { icon: 'call-outline', label: 'Call' },
  NOTE: { icon: 'document-text-outline', label: 'Note' },
  VISIT: { icon: 'location-outline', label: 'Visit' },
  INVOICE_EMAIL: { icon: 'receipt-outline', label: 'Invoice email' },
};

const CALL_OUTCOMES = [
  { value: 'CONNECTED', label: 'Connected' },
  { value: 'NO_ANSWER', label: 'No answer' },
  { value: 'BUSY', label: 'Busy' },
  { value: 'CALL_BACK', label: 'Asked to call back' },
  { value: 'WRONG_NUMBER', label: 'Wrong number' },
  { value: 'OTHER', label: 'Other' },
];
const outcomeLabel = (code) => CALL_OUTCOMES.find((o) => o.value === code)?.label || code;

const toDate = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    const [y, mo, d, h = 0, mi = 0, s = 0] = value;
    return new Date(y, mo - 1, d, h, mi, s);
  }
  const d = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? null : d;
};
const when = (value) => {
  const d = toDate(value);
  return d ? d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
};
/**
 * "2026-11-05T14:05" in local time — what the server's LocalDateTime parse takes, as the website's
 * nowLocalInput sends. The date field hands back a UTC ISO string, which would fail to parse (the
 * trailing Z) and, read as local, land the call hours off.
 */
const localInput = (value) => {
  const d = value ? new Date(value) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const mb = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(bytes % 1048576 ? 1 : 0)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const humanise = (s) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** "Email sent by Ravi Kumar" — the website's headline, word for word. */
function headline(item) {
  const who = item.actorName || 'Someone';
  switch (item.channel) {
    case 'EMAIL':
      if (item.status === 'FAILED') return `Email by ${who} — not sent`;
      if (item.unconfirmed) return `Email by ${who} — not confirmed`;
      if (item.status === 'QUEUED') return `Email by ${who} — sending…`;
      return `Email sent by ${who}`;
    case 'INVOICE_EMAIL':
      return item.status === 'FAILED' ? `Invoice email by ${who} — not sent` : `Invoice emailed by ${who}`;
    case 'CALL':
      return `Call recorded by ${who}`;
    case 'NOTE':
      return `Note by ${who}`;
    case 'VISIT':
      return `${item.subject || 'Visit'} by ${who}`;
    default:
      return who;
  }
}

/* ── The rep's schools ─────────────────────────────────────────────────────────────────────── */

export function SalesCommunicationsScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const [search, setSearch] = useState('');
  const fetcher = useCallback((signal) => staffApi.get(`${CRM}/customers`, { signal }), []);
  const { data, loading, error, reload, refreshing, refresh } = useStaffResource(fetcher, { initialData: null });
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.schoolName, r.city, r.pincode, r.contactPerson].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [rows, search]);

  return (
    <ScreenScaffold title="Email & Communication" fallbackRoute={ROOT} loading={loading} error={error} onRetry={reload} refreshing={refreshing} onRefresh={refresh}>
      <Text style={styles.lead}>Email a school, log a call or a note, and read everything your colleagues have exchanged with it.</Text>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search school, city or PIN…"
        placeholderTextColor={SLATE[400]}
        style={styles.search}
        accessibilityLabel="Search your schools"
      />
      {rows.length === 0 ? (
        <EmptyState title="You have no schools yet" message="Add a lead from LEAD and it will appear here." />
      ) : visible.length === 0 ? (
        <EmptyState title="No school matches" message={`Nothing matches “${search.trim()}”.`} />
      ) : (
        visible.map((r) => (
          <Pressable
            key={`${r.kind}-${r.id}`}
            onPress={() => router.push(`${ROOT}/sales-customer?kind=${r.kind}&id=${r.id}`)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={styles.cardText}>
              <Text style={styles.title}>{r.schoolName || 'Unnamed school'}</Text>
              <Text style={styles.muted}>
                {[r.city, r.pincode, r.stage && humanise(r.stage)].filter(Boolean).join(' · ') || (r.kind === 'school' ? 'Onboarded school' : '')}
              </Text>
              <Text style={styles.small}>{r.lastActivity ? `${r.lastActivity} · ${when(r.lastActivityAt)}` : 'No contact recorded yet'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.primaryDark} />
          </Pressable>
        ))
      )}
    </ScreenScaffold>
  );
}

/* ── One school ────────────────────────────────────────────────────────────────────────────── */

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'EMAIL', label: 'Emails' },
  { value: 'CALL', label: 'Calls' },
  { value: 'NOTE', label: 'Notes' },
  { value: 'VISIT', label: 'Visits' },
  { value: 'INVOICE_EMAIL', label: 'Invoices' },
];

const splitAddresses = (s) =>
  String(s || '')
    .split(/[,;\s]+/)
    .map((a) => a.trim())
    .filter(Boolean);

export function SalesCustomerScreen({ kind, id }) {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const [filter, setFilter] = useState('ALL');
  const [sheet, setSheet] = useState(null); // 'email' | 'call' | 'note'
  const [draft, setDraft] = useState(null);
  const [files, setFiles] = useState([]);
  const [entry, setEntry] = useState(null);
  const [busy, setBusy] = useState('');
  const fetcher = useCallback((signal) => staffApi.get(`${CRM}/${kind}/${id}`, { signal }), [kind, id]);
  const { data, loading, error, reload, refreshing, refresh } = useStaffResource(fetcher, { initialData: null });
  const c = data?.customer;
  const timeline = data?.timeline || [];
  const shown = filter === 'ALL' ? timeline : timeline.filter((i) => i.channel === filter);

  const openEmail = async () => {
    setBusy('compose');
    try {
      setDraft(await staffApi.get(`${CRM}/${kind}/${id}/email/compose`));
      setFiles([]);
      setSheet('email');
    } catch (e) {
      showToast(e?.message || 'Could not prepare the email.', 'error');
    } finally {
      setBusy('');
    }
  };

  const openEntry = async (item) => {
    if (item.channel === 'VISIT' || item.channel === 'INVOICE_EMAIL') {
      setEntry({ ...item, bodyText: item.preview });
      return;
    }
    setBusy(`entry-${item.id}`);
    try {
      setEntry(await staffApi.get(`${CRM}/communications/${item.id}`));
    } catch (e) {
      showToast(e?.message || 'Could not open this entry.', 'error');
    } finally {
      setBusy('');
    }
  };

  const retry = async (item) => {
    setBusy(`retry-${item.id}`);
    try {
      await staffApi.post(`${CRM}/communications/${item.id}/retry`, {});
      showToast('Email sent.', 'success');
    } catch (e) {
      showToast(e?.message || 'The email could not be sent.', 'error');
    } finally {
      setBusy('');
      reload();
    }
  };

  const contact = c
    ? [
        ['Contact', [c.contactPerson, c.contactDesignation].filter(Boolean).join(' — ')],
        ['Phone', c.contactPhone],
        ['Email', c.contactEmail || c.schoolEmail],
        ['School code', c.schoolCode],
        ['Board', c.board],
        ['Place', [c.city, c.state, c.pincode].filter(Boolean).join(', ')],
        ['Address', c.address],
        ['Next follow-up', c.nextFollowUpDate ? when(c.nextFollowUpDate).split(',').slice(0, 2).join(',') : ''],
        ['Stage', c.stage ? humanise(c.stage) : ''],
      ].filter(([, v]) => v)
    : [];

  return (
    <ScreenScaffold
      title={c?.schoolName || 'School'}
      fallbackRoute={`${ROOT}/sales-communication`}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      {c ? (
        <>
          <View style={styles.card}>
            <View style={styles.cardText}>
              {contact.map(([label, value]) => (
                <View key={label} style={styles.row}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <Text style={styles.rowValue}>{String(value)}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.actions}>
            {[
              { key: 'email', label: 'Email', icon: 'mail-outline', onPress: openEmail },
              { key: 'call', label: 'Log a call', icon: 'call-outline', onPress: () => setSheet('call') },
              { key: 'note', label: 'Add note', icon: 'create-outline', onPress: () => setSheet('note') },
            ].map((a, i) => (
              <Pressable
                key={a.key}
                onPress={a.onPress}
                disabled={busy === 'compose'}
                style={({ pressed }) => [
                  styles.action,
                  i === 0 ? { backgroundColor: palette.primary, borderColor: palette.primary } : { borderColor: palette.primary },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <Ionicons name={a.icon} size={16} color={i === 0 ? palette.onPrimary : palette.primaryDark} />
                <Text style={[styles.actionText, { color: i === 0 ? palette.onPrimary : palette.primaryDark }]}>
                  {a.key === 'email' && busy === 'compose' ? '…' : a.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <SegmentedTabs scrollable options={FILTERS} value={filter} onChange={setFilter} style={styles.tabs} />

          {shown.length === 0 ? <EmptyState title="Nothing yet" message="Emails, calls, notes and visits for this school appear here." /> : null}
          {shown.map((item) => {
            const ch = CHANNELS[item.channel] || CHANNELS.NOTE;
            const failed = item.status === 'FAILED';
            return (
              <Pressable
                key={item.key || `${item.channel}-${item.id}`}
                onPress={() => openEntry(item)}
                style={({ pressed }) => [styles.entry, { borderLeftColor: failed ? FEEDBACK.errorText : palette.accent }, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <View style={styles.entryHead}>
                  <Ionicons name={ch.icon} size={16} color={palette.primaryDark} />
                  <Text style={styles.entryTitle}>{headline(item)}</Text>
                </View>
                <Text style={styles.small}>{when(item.occurredAt)}</Text>
                {item.subject && item.channel !== 'VISIT' ? <Text style={styles.entrySubject}>{item.subject}</Text> : null}
                {item.channel === 'CALL' ? (
                  <Text style={styles.muted}>
                    {[outcomeLabel(item.callOutcome), item.contactPerson, item.durationMinutes ? `${item.durationMinutes} min` : ''].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                {item.to ? <Text style={styles.muted}>To {item.to}</Text> : null}
                {item.preview ? (
                  <Text style={styles.muted} numberOfLines={3}>
                    {item.preview}
                  </Text>
                ) : null}
                {item.attachmentCount ? <Text style={styles.small}>{item.attachmentCount} attachment(s)</Text> : null}
                {failed && item.retryable ? (
                  <Pressable onPress={() => retry(item)} hitSlop={6} accessibilityRole="button">
                    <Text style={[styles.retry, { color: palette.primaryDark }]}>{busy === `retry-${item.id}` ? 'Sending…' : 'Try sending again'}</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}

          <FieldsSheet
            visible={sheet === 'email'}
            title={`Email ${c.schoolName || 'the school'}`}
            subtitle={
              draft && !draft.senderReady
                ? draft.senderMessage
                : draft
                  ? `From ${draft.from}${(draft.replyTo || []).length ? ` · replies go to ${draft.replyTo.join(', ')}` : ''}`
                  : ''
            }
            submitLabel="Send"
            fields={[
              {
                key: 'to',
                label: 'To',
                type: 'email',
                required: true,
                helper: (draft?.toSuggestions || []).length > 1 ? `Also on record: ${draft.toSuggestions.map((s) => s.email).join(', ')}` : undefined,
              },
              { key: 'cc', label: 'CC', type: 'text', placeholder: 'Separate addresses with commas' },
              { key: 'bcc', label: 'BCC', type: 'text', placeholder: 'Separate addresses with commas' },
              { key: 'subject', label: 'Subject', type: 'text', required: true, maxLength: 300 },
              { key: 'body', label: 'Message', type: 'multiline', required: true },
            ]}
            initial={draft ? { to: draft.to || '', subject: draft.subject || '', body: draft.body || '' } : null}
            onSubmit={async (p) => {
              if (draft && !draft.senderReady) throw new Error(draft.senderMessage || 'Email is not set up for your account yet.');
              const payload = { to: p.to.trim(), cc: splitAddresses(p.cc), bcc: splitAddresses(p.bcc), subject: p.subject.trim(), body: p.body };
              try {
                const limits = draft?.limits || {};
                const total = files.reduce((n, f) => n + (f.size || 0), 0);
                if (limits.maxTotalBytes && total > limits.maxTotalBytes) {
                  throw new Error(`The attachments add up to more than ${mb(limits.maxTotalBytes)}.`);
                }
                await staffApi.multipart(`${CRM}/${kind}/${id}/emails`, {
                  fields: { payload: JSON.stringify(payload) },
                  files: files.length ? { files } : undefined,
                });
              } finally {
                // A failed send is recorded server-side too, so the history moves either way.
                reload();
              }
              setSheet(null);
              setFiles([]);
              showToast('Email sent. It is saved below.', 'success');
            }}
            onClose={() => setSheet(null)}
          >
            {/* Attachments, with the website's checks: blocked extensions, size each, count. */}
            <View style={styles.attachBox}>
              {files.map((f) => (
                <View key={`${f.name}-${f.size}`} style={styles.attachment}>
                  <Ionicons name="attach-outline" size={16} color={palette.primaryDark} />
                  <Text style={[styles.attachmentText, { color: SLATE[800], flex: 1 }]} numberOfLines={1}>
                    {f.name}
                    {f.size ? ` · ${mb(f.size)}` : ''}
                  </Text>
                  <Pressable onPress={() => setFiles((list) => list.filter((x) => x !== f))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`}>
                    <Ionicons name="close-circle" size={18} color={SLATE[500]} />
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={async () => {
                  const limits = draft?.limits || {};
                  if (limits.maxFiles && files.length >= limits.maxFiles) {
                    showToast(`Attach at most ${limits.maxFiles} files.`, 'error');
                    return;
                  }
                  const f = await pickFile(['*/*']);
                  if (!f) return;
                  const ext = (f.name.split('.').pop() || '').toLowerCase();
                  if (f.name.includes('.') && (limits.blockedExtensions || []).includes(ext)) {
                    showToast(`"${f.name}" cannot be sent — email providers block .${ext} files.`, 'error');
                    return;
                  }
                  if (limits.maxFileBytes && f.size > limits.maxFileBytes) {
                    showToast(`"${f.name}" is larger than ${mb(limits.maxFileBytes)}.`, 'error');
                    return;
                  }
                  if (files.some((x) => x.name === f.name && x.size === f.size)) return;
                  setFiles((list) => [...list, f]);
                }}
                style={styles.attachment}
                accessibilityRole="button"
              >
                <Ionicons name="add-circle-outline" size={16} color={palette.primaryDark} />
                <Text style={[styles.attachmentText, { color: palette.primaryDark }]}>Attach a file</Text>
              </Pressable>
              {draft?.limits?.maxFiles ? (
                <Text style={styles.small}>
                  Up to {draft.limits.maxFiles} files
                  {draft.limits.maxFileBytes ? `, ${mb(draft.limits.maxFileBytes)} each` : ''}
                  {draft.limits.maxTotalBytes ? `, ${mb(draft.limits.maxTotalBytes)} in total` : ''}.
                </Text>
              ) : null}
            </View>
          </FieldsSheet>
          <FieldsSheet
            visible={sheet === 'call'}
            title={`Log a call — ${c.schoolName || ''}`}
            fields={[
              { key: 'occurredAt', label: 'When', type: 'datetime', required: true },
              { key: 'outcome', label: 'Outcome', type: 'select', options: CALL_OUTCOMES, default: 'CONNECTED', required: true },
              { key: 'contactPerson', label: 'Spoke to', type: 'text', maxLength: 150 },
              { key: 'contactPhone', label: 'Phone', type: 'phone' },
              { key: 'durationMinutes', label: 'Duration (minutes)', type: 'number' },
              { key: 'notes', label: 'What was discussed', type: 'multiline', maxLength: 20000 },
            ]}
            initial={{ contactPerson: c.contactPerson || '', contactPhone: c.contactPhone || '', outcome: 'CONNECTED', occurredAt: localInput() }}
            onSubmit={async (p) => {
              await staffApi.post(`${CRM}/${kind}/${id}/calls`, {
                occurredAt: localInput(p.occurredAt),
                contactPerson: p.contactPerson || '',
                contactPhone: p.contactPhone || '',
                outcome: p.outcome,
                durationMinutes: p.durationMinutes ?? '',
                notes: p.notes || '',
              });
              setSheet(null);
              showToast('Call saved.', 'success');
              reload();
            }}
            onClose={() => setSheet(null)}
          />
          <FieldsSheet
            visible={sheet === 'note'}
            title={`Add a note — ${c.schoolName || ''}`}
            fields={[{ key: 'notes', label: 'Note', type: 'multiline', required: true, maxLength: 20000 }]}
            onSubmit={async (p) => {
              await staffApi.post(`${CRM}/${kind}/${id}/notes`, { notes: p.notes.trim() });
              setSheet(null);
              showToast('Note saved.', 'success');
              reload();
            }}
            onClose={() => setSheet(null)}
          />
          <FormSheet visible={!!entry} title={entry ? headline(entry) : ''} subtitle={entry ? when(entry.occurredAt) : ''} onClose={() => setEntry(null)}>
            {entry ? (
              <View>
                {entry.subject ? <Text style={styles.entrySubject}>{entry.subject}</Text> : null}
                {entry.status ? (
                  <View style={styles.chipRow}>
                    <StatusChip label={humanise(entry.status)} tone={entry.status === 'FAILED' ? 'error' : 'neutral'} />
                  </View>
                ) : null}
                {entry.channel === 'CALL' ? (
                  <Text style={styles.muted}>
                    {[outcomeLabel(entry.callOutcome), entry.contactPerson, entry.contactPhone, entry.durationMinutes ? `${entry.durationMinutes} min` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
                <Text style={styles.body}>{entry.bodyText || entry.preview || ''}</Text>
                {(entry.attachments || []).map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() =>
                      downloadAndShare(`${CRM}/attachments/${a.id}`, a.fileName || `attachment-${a.id}`, '').catch((e) =>
                        showToast(e?.message || 'Download failed.', 'error'),
                      )
                    }
                    style={styles.attachment}
                    accessibilityRole="button"
                  >
                    <Ionicons name="attach-outline" size={16} color={palette.primaryDark} />
                    <Text style={[styles.attachmentText, { color: palette.primaryDark }]}>{a.fileName}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </FormSheet>
        </>
      ) : null}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  lead: { fontSize: TYPE.body, color: SLATE[600], marginBottom: SPACING.md },
  search: {
    borderWidth: 1,
    borderColor: SLATE[300],
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: TYPE.body,
    color: SLATE[900],
    backgroundColor: '#ffffff',
    marginBottom: SPACING.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardText: { flex: 1 },
  pressed: { opacity: 0.85 },
  title: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[900] },
  muted: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  small: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: 5 },
  rowLabel: { fontSize: TYPE.label, color: SLATE[600] },
  rowValue: { flex: 1, fontSize: TYPE.label, fontWeight: '700', color: SLATE[900], textAlign: 'right' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginVertical: SPACING.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, minHeight: 40 },
  actionText: { fontSize: TYPE.label, fontWeight: '800' },
  tabs: { marginBottom: SPACING.md },
  entry: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: SLATE[200], borderLeftWidth: 4, padding: SPACING.md, marginBottom: SPACING.sm },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryTitle: { flex: 1, fontSize: TYPE.label, fontWeight: '800', color: SLATE[900] },
  entrySubject: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800], marginTop: 4 },
  retry: { fontSize: TYPE.caption, fontWeight: '800', marginTop: SPACING.xs },
  chipRow: { flexDirection: 'row', marginVertical: SPACING.xs },
  body: { fontSize: TYPE.body, color: SLATE[800], marginTop: SPACING.sm, lineHeight: 22 },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  attachBox: { marginTop: SPACING.xs, marginBottom: SPACING.sm },
  attachmentText: { fontSize: TYPE.label, fontWeight: '700' },
}));
