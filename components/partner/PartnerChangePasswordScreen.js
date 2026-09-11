import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Banner, PrimaryButton } from '../auth';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { Card, ScreenScaffold } from '../ui';
import { forgotPassword } from '../../services/authService';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Change password for a partner — by emailed reset link, not by an old/new form.
 *
 * ── THERE IS NO PARTNER CHANGE-PASSWORD ENDPOINT ────────────────────────────
 * Every other persona has one — `/api/parent/account/change-password`,
 * `/api/student/change-password`, the school's own — and the partner does not.
 *
 * The odd part: `PartnerAuthService.changePassword(email, oldPassword, newPassword)` **is fully
 * written** and no controller anywhere calls it. It is dead code. So the ordinary three-field form
 * would compile, look right, and have nothing to post to.
 *
 * What IS reachable is the forgot/reset pair, which is public and already used by the login screen:
 *
 *     POST /api/partner/auth/forgot-password   { emailOrPhone }
 *     POST /api/partner/auth/reset-password    { token, newPassword }
 *
 * So this screen sends the link and says plainly that it has. It tells the truth about how the
 * change actually happens rather than presenting a form whose submit button cannot work.
 *
 * Wiring the existing service method to a ~15-line controller would let this become a normal form
 * later; the screen would change, the route would not.
 *
 * ── THE ADDRESS IS SHOWN, NOT TYPED ─────────────────────────────────────────
 * `partnerUserEmail` is written at login (one of the seven keys) and has never been read by any
 * partner screen until now. Showing it rather than asking for it means a partner cannot typo
 * themselves out of a reset, and it makes the destination unambiguous before they tap.
 */

export default function PartnerChangePasswordScreen() {
  const styles = useStyles();
  const palette = usePalette();

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem('partnerUserEmail')
      .then((value) => {
        if (alive) setEmail(value || '');
      })
      .catch(() => {
        // No stored address just means the button explains itself differently below.
      });
    return () => {
      alive = false;
    };
  }, []);

  const send = async () => {
    setSending(true);
    setBanner(null);
    try {
      await forgotPassword('partner', email);
      setBanner({
        variant: 'success',
        message: `We've emailed a password reset link to ${email}. It expires shortly, so use it soon.`,
      });
    } catch (e) {
      setBanner({ variant: 'error', message: e?.message || 'Could not send the reset link. Try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenScaffold title="Change Password" fallbackRoute="/partner">
      <Card>
        <View style={styles.head}>
          <View style={styles.icon}>
            <Ionicons name="mail-outline" size={20} color={palette.primaryDark} />
          </View>
          <Text style={styles.title}>Reset by email</Text>
        </View>

        <Text style={styles.body}>
          We&apos;ll send a secure link to your registered email address. Open it and choose a new
          password.
        </Text>

        {email ? (
          <View style={styles.address}>
            <Text style={styles.addressLabel}>Sending to</Text>
            <Text style={styles.addressValue}>{email}</Text>
          </View>
        ) : (
          <Text style={styles.note}>
            We couldn&apos;t read your saved email address. Sign in again, or use &quot;Forgot
            password&quot; on the login screen.
          </Text>
        )}

        {banner ? <Banner variant={banner.variant} message={banner.message} /> : null}

        <PrimaryButton
          title="Send reset link"
          onPress={send}
          loading={sending}
          disabled={!email}
          palette={palette}
        />
      </Card>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  title: { flex: 1, fontSize: TYPE.title, fontWeight: '700', color: SLATE[800] },
  body: { fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body), marginBottom: SPACING.md },
  address: {
    padding: SPACING.sm,
    borderRadius: 12,
    backgroundColor: SLATE[50],
    borderWidth: 1,
    borderColor: SLATE[200],
    marginBottom: SPACING.md,
  },
  addressLabel: { fontSize: TYPE.caption, color: SLATE[500] },
  addressValue: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800], marginTop: 2 },
  note: { fontSize: TYPE.body, color: SLATE[500], lineHeight: leading(TYPE.body), marginBottom: SPACING.md },
}));
