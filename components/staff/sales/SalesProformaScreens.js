import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { ScreenScaffold, StatusChip, useToast } from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import useStaffResource from '../../../hooks/useStaffResource';
import { staffApi } from '../../../services/staffApi';
import { downloadAndShare } from '../../../utils/downloadFile';
import { formatRupees } from '../../../utils/currency';
import CrudListScreen from '../../portal/CrudListScreen';
import FieldsSheet from '../../portal/FieldsSheet';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Proformas (5 Nov 2026) — the website's SalesInvoices: the rep's proforma invoices, and the tax
 * invoices HQ issued for their schools (read-only), on `/api/staff/sales/invoices`.
 *
 * Every action on a document that exists is native — the PDF, issue, email (with the sender's own
 * mail id, which the server records), duplicate, cancel, delete — and each button follows the
 * server's `permissions`, never a guess from the status. Writing the line items (the GST
 * calculator) stays on the website, opened in the app's web view.
 */

const BASE = '/api/staff/sales/invoices';
const ROOT = '/staff/sales';
const WEB = '/sales/platform/dashboard/invoices';

const DOC_LABEL = { PROFORMA: 'Proforma', TAX_INVOICE: 'Tax Invoice', BILL_OF_SUPPLY: 'Bill of Supply' };
const STATUS_LABEL = { DRAFT: 'Draft', ISSUED: 'Issued', SENT: 'Sent', PAID: 'Paid', CANCELLED: 'Cancelled' };
const STATUS_TONE = { DRAFT: 'neutral', ISSUED: 'info', SENT: 'info', PAID: 'success', CANCELLED: 'error' };

const inr = (v) => (v === null || v === undefined || v === '' ? '—' : formatRupees(v));
const day = (v) => {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const docTitle = (inv) => `${DOC_LABEL[inv.docType] || inv.docType} ${inv.docNumber || `draft #${inv.id}`}`;

const openOnWebsite = (label) => router.push({ pathname: `${ROOT}/feature`, params: { path: WEB, label } });

export function SalesProformasScreen() {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <CrudListScreen
      title="Proformas"
      fallbackRoute={ROOT}
      load={() => staffApi.get(BASE)}
      tabs={[
        { value: 'all', label: 'All' },
        { value: 'PROFORMA', label: 'Proformas', filter: (r) => r.docType === 'PROFORMA' },
        { value: 'tax', label: 'Tax invoices', filter: (r) => r.docType !== 'PROFORMA' },
      ]}
      header={() => (
        <>
          <Text style={styles.lead}>
            Raise a proforma invoice for one of your schools and email it from the company support address. Tax invoices are issued by HQ and appear here read-only.
          </Text>
          <Pressable
            onPress={() => openOnWebsite('New proforma')}
            style={({ pressed }) => [styles.primary, { backgroundColor: palette.primary }, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="add-circle-outline" size={18} color={palette.onPrimary} />
            <Text style={[styles.primaryText, { color: palette.onPrimary }]}>New proforma</Text>
          </Pressable>
        </>
      )}
      emptyTitle="No documents yet"
      emptyMessage="Proformas you raise, and invoices HQ issues for your schools, appear here."
      describe={(r) => ({
        title: docTitle(r),
        subtitle: [r.buyerName, r.financialYearLabel].filter(Boolean).join(' · '),
        chips: [
          { label: STATUS_LABEL[r.status] || r.status, tone: STATUS_TONE[r.status] },
          r.overdue ? { label: 'Overdue', tone: 'error' } : null,
        ],
        meta: [
          ['Total', inr(r.totalInr)],
          ['Issued', day(r.issueDate)],
          ['Due', day(r.dueDate)],
          ['Buyer email', r.buyerEmail],
          ['GSTIN', r.buyerGstin],
        ],
      })}
      actions={[{ key: 'open', label: 'Open', icon: 'open-outline', run: (r) => router.push(`${ROOT}/sales-proforma?id=${r.id}`) }]}
    />
  );
}

export function SalesProformaScreen({ id }) {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const [busy, setBusy] = useState('');
  const [sheet, setSheet] = useState(null); // 'email' | 'cancel'
  const [draft, setDraft] = useState(null);
  const fetcher = useCallback((signal) => staffApi.get(`${BASE}/${id}`, { signal }), [id]);
  const { data: inv, loading, error, reload, refreshing, refresh } = useStaffResource(fetcher, { initialData: null });
  const p = inv?.permissions || {};

  const act = async (key, fn, message) => {
    setBusy(key);
    try {
      const out = await fn();
      if (message) showToast(message, 'success');
      return out;
    } catch (e) {
      showToast(e?.message || 'That did not work.', 'error');
      return null;
    } finally {
      setBusy('');
    }
  };
  const confirmFirst = (message, run) =>
    Alert.alert('Are you sure?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: run },
    ]);

  const openEmail = async () => {
    const d = await act('compose', () => staffApi.get(`${BASE}/${id}/email/compose`));
    if (d) {
      setDraft(d);
      setSheet('email');
    }
  };

  const Button = ({ label, icon, onPress, tone = 'ghost', k }) => (
    <Pressable
      onPress={onPress}
      disabled={!!busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        tone === 'primary'
          ? { backgroundColor: palette.primary, borderColor: palette.primary }
          : { borderColor: tone === 'danger' ? FEEDBACK.errorText : palette.primary },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={16} color={tone === 'primary' ? palette.onPrimary : tone === 'danger' ? FEEDBACK.errorText : palette.primaryDark} />
      <Text style={[styles.buttonText, { color: tone === 'primary' ? palette.onPrimary : tone === 'danger' ? FEEDBACK.errorText : palette.primaryDark }]}>
        {busy === k ? '…' : label}
      </Text>
    </Pressable>
  );

  const buyer = inv?.buyer || {};

  return (
    <ScreenScaffold
      title={inv ? docTitle(inv) : 'Document'}
      fallbackRoute={`${ROOT}/sales-proformas`}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      {inv ? (
        <>
          <View style={styles.chips}>
            <StatusChip label={STATUS_LABEL[inv.status] || inv.status} tone={STATUS_TONE[inv.status]} />
            {inv.overdue ? <StatusChip label="Overdue" tone="error" /> : null}
          </View>
          {inv.status === 'CANCELLED' ? <Text style={styles.warn}>Cancelled{inv.cancelReason ? `: ${inv.cancelReason}` : ''}.</Text> : null}
          {!p.canEdit && !p.canEmail && inv.docType !== 'PROFORMA' ? (
            <Text style={styles.info}>This {String(DOC_LABEL[inv.docType] || '').toLowerCase()} was issued by HQ. You can view and download it.</Text>
          ) : null}

          <View style={styles.buttons}>
            <Button
              k="pdf"
              label={inv.status === 'DRAFT' ? 'Preview PDF' : 'View PDF'}
              icon="document-outline"
              onPress={() => act('pdf', () => downloadAndShare(`${BASE}/${id}/pdf`, `${inv.docNumber || `draft-${id}`}.pdf`))}
            />
            {p.canEdit ? <Button k="edit" label="Edit on the website" icon="create-outline" onPress={() => openOnWebsite(docTitle(inv))} /> : null}
            {p.canIssue ? (
              <Button
                k="issue"
                tone="primary"
                label="Issue"
                icon="checkmark-done-outline"
                onPress={() =>
                  confirmFirst('Issue this document? A number is assigned and it can no longer be edited.', async () => {
                    await act('issue', () => staffApi.post(`${BASE}/${id}/issue`, {}), 'Issued. You can now email it.');
                    reload();
                  })
                }
              />
            ) : null}
            {p.canEmail ? <Button k="compose" tone="primary" label="Email…" icon="mail-outline" onPress={openEmail} /> : null}
            {p.canDuplicate ? (
              <Button
                k="duplicate"
                label="Duplicate"
                icon="copy-outline"
                onPress={async () => {
                  const copy = await act('duplicate', () => staffApi.post(`${BASE}/${id}/duplicate`, {}), 'Copied into a new draft.');
                  if (copy?.id) router.replace(`${ROOT}/sales-proforma?id=${copy.id}`);
                }}
              />
            ) : null}
            {p.canCancel ? <Button k="cancel" tone="danger" label="Cancel document" icon="close-circle-outline" onPress={() => setSheet('cancel')} /> : null}
            {p.canDelete ? (
              <Button
                k="delete"
                tone="danger"
                label="Delete draft"
                icon="trash-outline"
                onPress={() =>
                  confirmFirst('Delete this draft?', async () => {
                    const ok = await act('delete', () => staffApi.del(`${BASE}/${id}`).then(() => true), 'Draft deleted.');
                    if (ok) router.replace(`${ROOT}/sales-proformas`);
                  })
                }
              />
            ) : null}
          </View>

          <View style={styles.card}>
            {[
              ['Buyer', inv.buyerName || buyer.name],
              ['GSTIN', buyer.gstin],
              ['Email', buyer.email],
              ['Place of supply', inv.placeOfSupplyLabel],
              ['Issued', day(inv.issueDate)],
              ['Due', day(inv.dueDate)],
              ['Raised by', inv.ownerName],
              ['Paid', inv.status === 'PAID' ? [day(inv.paymentDate), inv.paymentMethod, inv.paymentReference].filter(Boolean).join(' · ') : ''],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <View key={label} style={styles.row}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <Text style={styles.rowValue}>{String(value)}</Text>
                </View>
              ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Items</Text>
            {(inv.items || []).map((i) => (
              <View key={i.seq ?? i.description} style={styles.item}>
                <Text style={styles.itemTitle}>{i.description}</Text>
                {i.subDescription ? <Text style={styles.muted}>{i.subDescription}</Text> : null}
                <Text style={styles.muted}>
                  {Number(i.quantity)}
                  {i.unit ? ` ${i.unit}` : ''} × {inr(i.unitPrice)} · GST {Number(i.gstRate)}%{i.sac ? ` · SAC ${i.sac}` : ''}
                </Text>
                <Text style={styles.itemAmount}>{inr(i.taxable)}</Text>
              </View>
            ))}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Subtotal</Text>
              <Text style={styles.rowValue}>{inr(inv.subtotalInr)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Tax{inv.taxMode ? ` (${String(inv.taxMode).replace(/_/g, ' + ')})` : ''}</Text>
              <Text style={styles.rowValue}>{inr(inv.taxInr)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, styles.total]}>Total</Text>
              <Text style={[styles.rowValue, styles.total]}>{inr(inv.totalInr)}</Text>
            </View>
          </View>

          {(inv.emails || []).length ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Emails</Text>
              {inv.emails.map((e) => (
                <View key={e.id} style={styles.item}>
                  <Text style={styles.itemTitle}>Email to {e.to}</Text>
                  <Text style={styles.muted}>
                    {[day(e.sentAt || e.createdAt), e.status === 'FAILED' ? 'Not sent' : e.status ? String(e.status).toLowerCase() : '', e.sentByName, e.senderEmail]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <FieldsSheet
            visible={sheet === 'email'}
            title={`Email ${docTitle(inv)}`}
            subtitle="Sent from the company support address. Your own mail id is recorded with it and gets a copy."
            submitLabel="Send"
            fields={[
              { key: 'senderEmail', label: 'Your email id', type: 'email', required: true },
              { key: 'to', label: 'To', type: 'email', required: true },
              { key: 'cc', label: 'CC', type: 'text', placeholder: 'Separate addresses with commas' },
              { key: 'subject', label: 'Subject', type: 'text', required: true },
              { key: 'body', label: 'Message', type: 'multiline', required: true },
            ]}
            initial={
              draft
                ? {
                    to: draft.to || '',
                    cc: (draft.cc || []).map((c) => c.email).join(', '),
                    subject: draft.subject || '',
                    body: draft.body || '',
                  }
                : null
            }
            onSubmit={async (v) => {
              const known = new Map((draft?.cc || []).map((c) => [c.email, c]));
              const cc = String(v.cc || '')
                .split(/[,;\s]+/)
                .filter(Boolean)
                .map((email) => known.get(email) || { email, source: 'MANUAL' });
              try {
                await staffApi.post(`${BASE}/${id}/email`, { senderEmail: v.senderEmail.trim(), to: v.to.trim(), cc, subject: v.subject, body: v.body });
              } finally {
                reload();
              }
              setSheet(null);
              showToast('Email sent.', 'success');
            }}
            onClose={() => setSheet(null)}
          />
          <FieldsSheet
            visible={sheet === 'cancel'}
            title="Cancel this document"
            submitLabel="Cancel document"
            fields={[{ key: 'reason', label: 'Reason', type: 'multiline', required: true }]}
            onSubmit={async (v) => {
              await staffApi.post(`${BASE}/${id}/cancel`, { reason: v.reason });
              setSheet(null);
              showToast('Cancelled.', 'success');
              reload();
            }}
            onClose={() => setSheet(null)}
          />
        </>
      ) : null}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  lead: { fontSize: TYPE.body, color: SLATE[600], marginBottom: SPACING.md },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12, marginBottom: SPACING.md },
  primaryText: { fontSize: TYPE.label, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  warn: { fontSize: TYPE.caption, color: FEEDBACK.errorText, backgroundColor: FEEDBACK.errorBg, borderRadius: 10, padding: SPACING.sm, marginBottom: SPACING.sm },
  info: { fontSize: TYPE.caption, color: SLATE[700], backgroundColor: SLATE[100], borderRadius: 10, padding: SPACING.sm, marginBottom: SPACING.sm },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, minHeight: 40 },
  buttonText: { fontSize: TYPE.label, fontWeight: '800' },
  card: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.md },
  sectionTitle: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[900], marginBottom: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: 6 },
  rowLabel: { fontSize: TYPE.body, color: SLATE[600] },
  rowValue: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[900], textAlign: 'right' },
  total: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[900] },
  item: { paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: SLATE[100] },
  itemTitle: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[900] },
  itemAmount: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[800], marginTop: 2, textAlign: 'right' },
  muted: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
}));
