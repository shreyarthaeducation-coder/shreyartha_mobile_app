import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { Card, CardTitle, ScreenScaffold, TextField, useToast } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { pickImage, formatFileSize } from '../../utils/filePicker';
import {
  MAX_UPI_IMAGE_BYTES,
  UPPERCASE_FIELDS,
  fetchBankDetails,
  saveBankDetails,
  uploadUpiImage,
  validateBankDetails,
} from '../../services/partner/bankService';
import { formatShortDate } from '../../utils/currency';

/**
 * Bank Information — where the partner's commission is paid.
 *
 * Ports frontendmain/src/Partner/platform/PartnerBankInfo.js. The four validation regexes live in
 * services/partner/bankService.js, copied verbatim rather than re-derived; an IFSC pattern
 * rewritten from memory is how a valid account gets rejected on a Friday evening.
 *
 * `pickImage`, NOT `pickPhoto` — pickPhoto forces a 1:1 crop because it exists for profile
 * avatars, and cropping a UPI QR code to a square is how you make it unscannable.
 *
 * The upload is a separate request from the form save, exactly as on the web: PUT
 * /bank-details for the fields, POST /bank-details/upi-image for the file. Doing the image first
 * on submit would mean a failed save leaves a new QR attached to old account details.
 */

const FIELDS = [
  ['bankName', 'Bank name', true, 'default'],
  ['accountHolderName', 'Account holder name', true, 'default'],
  ['accountNumber', 'Account number', true, 'number-pad'],
  ['ifscCode', 'IFSC code', true, 'default'],
  ['pan', 'PAN', false, 'default'],
  ['gstin', 'GSTIN', false, 'default'],
];

const EMPTY = {
  bankName: '',
  accountHolderName: '',
  accountNumber: '',
  ifscCode: '',
  pan: '',
  gstin: '',
};

export default function PartnerBankInfoScreen({ homeRoute = '/partner' }) {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();

  const [form, setForm] = useState(EMPTY);
  const [upiImageUrl, setUpiImageUrl] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async (mode) => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setLoadError('');
    try {
      const data = await fetchBankDetails();
      setForm({ ...EMPTY, ...(data || {}) });
      setUpiImageUrl(data?.upiImageUrl || null);
      setUpdatedAt(data?.updatedAt || null);
    } catch (e) {
      // A partner who has never saved bank details legitimately has no record; only surface a
      // real failure, and let the empty form stand otherwise.
      if (e?.status && e.status !== 404) setLoadError(e?.message || 'Could not load bank details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load('load');
  }, [load]);

  const patch = (key, value) => {
    // Uppercased on CHANGE, not on submit: all three of these regexes are uppercase-only, so a
    // lowercase IFSC would fail validation while looking perfectly correct on screen.
    const next = UPPERCASE_FIELDS.includes(key) ? value.toUpperCase() : value;
    setForm((p) => ({ ...p, [key]: next }));
    setErrors((p) => (p[key] ? { ...p, [key]: undefined } : p));
  };

  const submit = async () => {
    const found = validateBankDetails(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      showToast('Please correct the highlighted fields.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveBankDetails(form);
      showToast('Bank details saved.', 'success');
      await load('refresh');
    } catch (e) {
      showToast(e?.message || 'Could not save bank details.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const changeUpiImage = async () => {
    const picked = await pickImage();
    if (!picked) return;
    if (picked.denied) {
      showToast('Photo permission is needed to attach a UPI QR.', 'error');
      return;
    }
    if (picked.size && picked.size > MAX_UPI_IMAGE_BYTES) {
      showToast(
        `That image is ${formatFileSize(picked.size)} — the limit is ${formatFileSize(MAX_UPI_IMAGE_BYTES)}.`,
        'error',
      );
      return;
    }
    setUploading(true);
    try {
      const res = await uploadUpiImage(picked);
      setUpiImageUrl(res?.upiImageUrl || picked.uri);
      showToast('UPI image updated.', 'success');
    } catch (e) {
      showToast(e?.message || 'Could not upload the image.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScreenScaffold
      title="Bank Information"
      fallbackRoute={homeRoute}
      loading={loading}
      error={loadError}
      onRetry={() => load('load')}
      refreshing={refreshing}
      onRefresh={() => load('refresh')}
      toast={toast}
    >
      <Card>
        <CardTitle>Payout account</CardTitle>
        <Text style={styles.hint}>
          Commission is paid to this account. PAN and GSTIN are optional but speed up payouts.
        </Text>

        {FIELDS.map(([key, label, required, keyboard]) => (
          <TextField
            key={key}
            label={label}
            required={required}
            value={form[key] || ''}
            onChangeText={(v) => patch(key, v)}
            error={errors[key]}
            keyboardType={keyboard}
            autoCapitalize={UPPERCASE_FIELDS.includes(key) ? 'characters' : 'words'}
            autoCorrect={false}
          />
        ))}

        {updatedAt ? (
          <Text style={styles.updated}>{`Last updated ${formatShortDate(updatedAt)}`}</Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={saving}
          style={({ pressed }) => [styles.save, saving && styles.saveOff, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator size="small" color={palette.onPrimary} />
          ) : (
            <Text style={styles.saveText}>Save bank details</Text>
          )}
        </Pressable>
      </Card>

      <Card>
        <CardTitle>UPI QR code</CardTitle>
        <Text style={styles.hint}>
          Optional. Attach a QR image if you would rather be paid over UPI.
        </Text>

        {upiImageUrl ? (
          <Image source={{ uri: upiImageUrl }} style={styles.qr} resizeMode="contain" />
        ) : (
          <View style={styles.qrEmpty}>
            <Ionicons name="qr-code-outline" size={30} color={palette.cardBorder} />
            <Text style={styles.qrEmptyText}>No UPI image attached</Text>
          </View>
        )}

        <Pressable
          onPress={changeUpiImage}
          disabled={uploading}
          style={({ pressed }) => [styles.upload, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          {uploading ? (
            <ActivityIndicator size="small" color={palette.primaryDark} />
          ) : (
            <>
              <Ionicons name="image-outline" size={18} color={palette.primaryDark} />
              <Text style={styles.uploadText}>
                {upiImageUrl ? 'Replace image' : 'Attach image'}
              </Text>
            </>
          )}
        </Pressable>
      </Card>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  hint: {
    fontSize: TYPE.label,
    color: SLATE[600],
    marginBottom: SPACING.sm,
    lineHeight: leading(TYPE.label),
  },
  updated: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 4 },
  save: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: p.primary,
    marginTop: SPACING.md,
  },
  saveOff: { opacity: 0.6 },
  saveText: { fontSize: TYPE.body, fontWeight: '700', color: p.onPrimary },

  qr: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: p.tile,
    marginBottom: SPACING.sm,
  },
  qrEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: p.cardBorder,
    marginBottom: SPACING.sm,
  },
  qrEmptyText: { fontSize: TYPE.caption, color: SLATE[600] },
  upload: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.cardBorder,
  },
  uploadText: { fontSize: TYPE.label, fontWeight: '600', color: p.primaryDark },
  pressed: { opacity: 0.75 },
}));
