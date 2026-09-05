import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SLATE, SPACING } from '../../../constants/theme';
import {
  Card,
  EmptyState,
  FormSheet,
  ScreenScaffold,
  Select,
  StatusChip,
  TextField,
  useToast,
} from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import makeStyles from '../../../utils/makeStyles';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  DEAL_STATUS_TONE,
  PAYMENT_METHODS,
  createDeal,
  deleteDeal,
  fetchDeals,
  fetchMySchools,
  fetchProducts,
  fetchQuotation,
  submitDeal,
  updateDeal,
} from '../../../services/sales/salesService';
import { quotationHtml } from './salesQuotation';
import { GST_PERCENT, gstLabel, humanise, inr, shortDate } from './salesFormat';

/**
 * Recording a sale.
 *
 * The GST preview is computed here as well as on the server, and that duplication is deliberate:
 * a rep quoting a school across a desk needs the total before the request round-trips. The server
 * still recomputes on save and its number is the one that is stored — this is a preview, never a
 * source of truth, which is why nothing here is sent as a total.
 */
export default function SalesDealsScreen({ homeRoute = '/staff/sales' }) {
  const palette = usePalette();
  const styles = useStyles();
  const { toast, showToast } = useToast();
  const [editing, setEditing] = useState(null);

  const fetcher = useCallback((signal) => fetchDeals(signal), []);
  const { data, loading, error, refreshing, reload, refresh, revalidate } = useStaffResource(fetcher);

  const schoolsFetcher = useCallback((signal) => fetchMySchools(signal), []);
  const { data: schoolsData } = useStaffResource(schoolsFetcher);
  const schools = useMemo(() => (Array.isArray(schoolsData) ? schoolsData : []), [schoolsData]);

  const productsFetcher = useCallback((signal) => fetchProducts(signal), []);
  const { data: productsData } = useStaffResource(productsFetcher);
  const products = useMemo(() => (Array.isArray(productsData) ? productsData : []), [productsData]);

  const deals = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const send = async (deal) => {
    try {
      await submitDeal(deal.id);
      showToast('Sent to the admin team for approval.', 'success');
      revalidate();
    } catch (err) {
      showToast(err?.message || 'Could not submit the deal.', 'error');
    }
  };

  const remove = (deal) => {
    Alert.alert('Delete draft', 'Delete this draft sale?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDeal(deal.id);
            revalidate();
          } catch (err) {
            showToast(err?.message || 'Could not delete the draft.', 'error');
          }
        },
      },
    ]);
  };

  /**
   * Renders the quotation and hands it to the share sheet.
   *
   * expo-print, not a PDF library: the HTML is a table and printToFileAsync already ships with
   * the app. Sharing rather than saving is what a rep actually does with it — it goes straight to
   * the school on WhatsApp.
   */
  const quote = async (deal) => {
    try {
      const payload = await fetchQuotation(deal.id);
      const { uri } = await Print.printToFileAsync({ html: quotationHtml(payload) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        showToast('Quotation saved to the app’s files.', 'success');
      }
    } catch (err) {
      showToast(err?.message || 'Could not build the quotation.', 'error');
    }
  };

  return (
    <ScreenScaffold
      title="Sales"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      notice={
        schools.length === 0
          ? 'No schools are assigned to you yet, so a sale cannot be filed. Ask the admin team to link your schools.'
          : ''
      }
      toast={toast}
    >
      <View style={styles.bar}>
        <Pressable
          onPress={() => setEditing({ mode: 'new' })}
          disabled={schools.length === 0}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: palette.primaryDark },
            schools.length === 0 && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryBtnText}>+ Record a sale</Text>
        </Pressable>
      </View>

      {deals.length === 0 ? (
        <EmptyState
          icon="cash-outline"
          title="No sales recorded"
          message="File a sale once a school commits. Admin approves it, then marks the money collected — incentive accrues only on what is collected."
        />
      ) : (
        deals.map((d) => (
          <Card key={d.id} style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.school}>{d.schoolName}</Text>
              <StatusChip label={humanise(d.status)} tone={DEAL_STATUS_TONE[d.status] || 'neutral'} />
            </View>

            <Text style={styles.meta}>
              {(d.items || [])
                .map((i) => `${i.productName}${i.grade ? ` (${i.grade})` : ''}`)
                .join(', ') || '—'}
            </Text>
            <Text style={styles.meta}>
              {`${shortDate(d.createdAt)} · ${humanise(d.paymentMethod)}`}
            </Text>

            <View style={styles.amounts}>
              <Text style={styles.amountLine}>{`Base ${inr(d.baseAmountInr)}`}</Text>
              <Text style={styles.amountLine}>{`GST ${inr(d.gstAmountInr)}`}</Text>
              <Text style={styles.amountTotal}>{inr(d.totalAmountInr)}</Text>
            </View>

            {d.rejectionReason ? (
              <Text style={styles.rejected}>{d.rejectionReason}</Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable onPress={() => quote(d)} hitSlop={6}>
                <Text style={[styles.link, { color: palette.link }]}>Quotation</Text>
              </Pressable>
              {d.status === 'DRAFT' || d.status === 'REJECTED' ? (
                <>
                  <Pressable onPress={() => setEditing({ mode: 'edit', deal: d })} hitSlop={6}>
                    <Text style={[styles.link, { color: palette.link }]}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => send(d)} hitSlop={6}>
                    <Text style={[styles.link, { color: palette.primaryDark }]}>Submit</Text>
                  </Pressable>
                </>
              ) : null}
              {d.status === 'DRAFT' ? (
                <Pressable onPress={() => remove(d)} hitSlop={6}>
                  <Text style={[styles.link, styles.danger]}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        ))
      )}

      <DealSheet
        editing={editing}
        schools={schools}
        products={products}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          showToast('Saved as a draft. Submit it when you are ready.', 'success');
          revalidate();
        }}
        onError={(message) => showToast(message, 'error')}
      />
    </ScreenScaffold>
  );
}

/* ── Editor ───────────────────────────────────────────────────────────────── */

const blankItem = () => ({ productId: '', grade: '', studentCount: '', months: '12' });

function DealSheet({ editing, schools, products, onClose, onSaved, onError }) {
  const styles = useStyles();
  const palette = usePalette();
  const [schoolId, setSchoolId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState([blankItem()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const deal = editing.deal;
    setSchoolId(deal?.schoolId ? String(deal.schoolId) : '');
    setPaymentMethod(deal?.paymentMethod || '');
    setPaymentReference(deal?.paymentReference || '');
    setRemarks(deal?.remarks || '');
    setItems(
      deal?.items?.length
        ? deal.items.map((i) => ({
            productId: String(i.productId ?? ''),
            grade: i.grade || '',
            studentCount: String(i.studentCount ?? ''),
            months: String(i.months ?? 12),
          }))
        : [blankItem()],
    );
  }, [editing]);

  const productOf = useCallback(
    (id) => products.find((p) => String(p.id) === String(id)),
    [products],
  );

  const { base, gst, total, lines } = useMemo(() => {
    const lineTotals = items.map((it) => {
      const product = productOf(it.productId);
      if (!product) return 0;
      const unit = Number(product.unitPriceInr || 0);
      if (product.pricingMode === 'ONE_TIME_ANNUAL') return unit;
      return unit * Number(it.studentCount || 0) * Number(it.months || 0);
    });
    const b = lineTotals.reduce((a, v) => a + v, 0);
    const g = Math.round(b * GST_PERCENT) / 100;
    return { base: b, gst: g, total: b + g, lines: lineTotals };
  }, [items, productOf]);

  const schoolOptions = useMemo(
    () => schools.map((s) => ({ value: String(s.schoolId), label: `${s.schoolName} (${s.schoolCode})` })),
    [schools],
  );
  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: String(p.id),
        label: `${p.name} — ${inr(p.unitPriceInr, { decimals: false })}${
          p.pricingMode === 'PER_STUDENT_PER_MONTH' ? '/student/month' : ' one-time'
        }`,
      })),
    [products],
  );

  const setItem = (index, patch) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const save = async () => {
    if (!schoolId) {
      onError('Pick the school.');
      return;
    }
    const payloadItems = items.filter((i) => i.productId);
    if (payloadItems.length === 0) {
      onError('Add at least one product.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        schoolId,
        paymentMethod: paymentMethod || null,
        paymentReference,
        remarks,
        items: payloadItems,
      };
      if (editing.mode === 'new') await createDeal(payload);
      else await updateDeal(editing.deal.id, payload);
      onSaved();
    } catch (err) {
      onError(err?.message || 'Could not save the sale.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) return null;

  return (
    <FormSheet
      visible
      title={editing.mode === 'new' ? 'Record a sale' : 'Edit sale'}
      onClose={onClose}
      onSubmit={save}
      submitLabel="Save draft"
      submitting={saving}
      fullHeight
    >
      <Select label="School *" value={schoolId} options={schoolOptions} onChange={setSchoolId} searchable />
      <Select
        label="Method of payment *"
        value={paymentMethod}
        options={PAYMENT_METHODS}
        onChange={setPaymentMethod}
      />
      <TextField
        label="Reference"
        value={paymentReference}
        onChangeText={setPaymentReference}
        placeholder="Cheque no., UTR, txn id…"
      />

      {items.map((it, index) => {
        const product = productOf(it.productId);
        const perStudent = !product || product.pricingMode === 'PER_STUDENT_PER_MONTH';
        return (
          <View key={index} style={styles.itemCard}>
            <Select
              label={`Product ${index + 1}`}
              value={it.productId}
              options={productOptions}
              onChange={(v) => setItem(index, { productId: v })}
              searchable
            />
            <TextField
              label="Grade(s)"
              value={it.grade}
              onChangeText={(v) => setItem(index, { grade: v })}
              placeholder={product?.applicableGrades || '9-10'}
            />
            {perStudent ? (
              <>
                <TextField
                  label="Number of students"
                  value={it.studentCount}
                  onChangeText={(v) => setItem(index, { studentCount: v.replace(/\D/g, '') })}
                  keyboardType="number-pad"
                />
                <TextField
                  label="Months"
                  value={it.months}
                  onChangeText={(v) => setItem(index, { months: v.replace(/\D/g, '') })}
                  keyboardType="number-pad"
                />
              </>
            ) : null}
            <View style={styles.itemFoot}>
              <Text style={styles.meta}>{`Line total ${inr(lines[index] || 0)}`}</Text>
              {items.length > 1 ? (
                <Pressable onPress={() => setItems(items.filter((_, i) => i !== index))} hitSlop={6}>
                  <Text style={[styles.link, styles.danger]}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}

      <Pressable
        onPress={() => setItems([...items, blankItem()])}
        style={({ pressed }) => [styles.addItem, pressed && styles.pressed]}
      >
        <Text style={[styles.link, { color: palette.link }]}>+ Add another product</Text>
      </Pressable>

      <View style={[styles.summary, { backgroundColor: palette.tint }]}>
        <SummaryRow label="Subtotal (ex-GST)" value={inr(base)} />
        {/* A live preview of an unsaved draft, so there is no snapshotted rate to prefer yet —
            gstLabel() falls back to the current rate for exactly this case. */}
        <SummaryRow label={gstLabel()} value={inr(gst)} />
        <SummaryRow label="Total payable by the school" value={inr(total)} strong />
        <Text style={styles.summaryNote}>
          Your incentive is calculated on the ex-GST subtotal, once the payment is collected.
        </Text>
      </View>

      <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline />
    </FormSheet>
  );
}

function SummaryRow({ label, value, strong }) {
  const styles = useStyles();
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  bar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: SPACING.md },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  primaryBtn: { paddingHorizontal: SPACING.md, paddingVertical: 9, borderRadius: 10 },
  primaryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },

  card: { marginBottom: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  school: { flex: 1, fontSize: 15, fontWeight: '700', color: SLATE[800] },
  meta: { fontSize: 12.5, color: SLATE[500], marginTop: 2 },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.md, marginTop: SPACING.sm },
  amountLine: { fontSize: 12.5, color: SLATE[500] },
  amountTotal: { marginLeft: 'auto', fontSize: 16, fontWeight: '800', color: p.primaryDark },
  rejected: { fontSize: 12.5, color: '#dc2626', marginTop: 6 },
  actions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  link: { fontSize: 13, fontWeight: '600' },
  danger: { color: '#dc2626' },

  itemCard: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  itemFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addItem: { paddingVertical: SPACING.sm },

  summary: { borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { fontSize: 13, color: SLATE[600] },
  summaryValue: { fontSize: 13, color: SLATE[700], fontWeight: '600' },
  summaryStrong: { fontWeight: '800', color: p.primaryDark },
  summaryNote: { fontSize: 11.5, color: SLATE[500], marginTop: 6 },
}));
