import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import AuthScreen from './AuthScreen';
import Banner from './Banner';
import CheckboxRow from './CheckboxRow';
import FormField from './FormField';
import LinkButton from './LinkButton';
import PasswordField from './PasswordField';
import PrimaryButton from './PrimaryButton';
import SelectField from './SelectField';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';

/**
 * Sign-up for the portals that joined the app on 6 Nov 2026 — Alumni, University, University
 * Staff, Industry and Investor — each a short description of the website's own form rather than a
 * hand-rolled screen (the older role screens predate the auth kit).
 *
 * SIGN-UP ONLY, like every role screen: signing in is the single gate at /auth/sign-in, which
 * already resolves all five portals. None of them gets a token back from sign-up — each account
 * waits for an approval (the platform admin, or for an alumnus their school) — so success is a
 * message beside the "Sign in" link, never a navigation.
 *
 * Props:
 *   palette, title, subtitle, cardTitle
 *   fields      `[{ key, label, required, placeholder, kind: text|email|phone|password|select|multiline|number,
 *                   options, helper, maxLength }]`
 *   initial     starting values
 *   terms       the checkbox's sentence, when the website asks for one
 *   validate(values) → '' or the website's own first message
 *   submit(values)   → the server's message (shown on success)
 *   renderBefore(values, set)   anything above the fields (the alumni school search)
 *   renderAfterField(key, values, set)   anything right under one field (a code lookup)
 */
export default function PortalSignupScreen({
  palette,
  title,
  subtitle,
  cardTitle,
  fields,
  initial = {},
  terms,
  validate,
  submit,
  renderBefore,
  renderAfterField,
  successFallback = 'Registration received. You can sign in once your account is approved.',
}) {
  const router = useRouter();
  const blank = () => ({ ...Object.fromEntries(fields.map((f) => [f.key, ''])), ...initial, terms: false });
  const [values, setValues] = useState(blank);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (patch) => {
    setError('');
    setValues((prev) => ({ ...prev, ...patch }));
  };

  const onSubmit = async () => {
    const missing = fields.find((f) => f.required && !String(values[f.key] ?? '').trim());
    if (missing) {
      setError(`Please enter ${missing.label.toLowerCase()}.`);
      return;
    }
    if (fields.some((f) => f.kind === 'password') && String(values.password || '').length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    const problem = validate ? validate(values) : '';
    if (problem) {
      setError(problem);
      return;
    }
    if (terms && !values.terms) {
      setError('You must acknowledge and agree to the terms and conditions of The 3C Edge platform.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const message = await submit(values);
      setValues(blank());
      setNotice(message || successFallback);
    } catch (e) {
      setError(e?.message || 'Signup failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      palette={palette}
      title={title}
      subtitle={subtitle}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    >
      {cardTitle ? <Text style={styles.cardTitle}>{cardTitle}</Text> : null}
      <Banner message={notice} variant="success" />
      {notice ? (
        <PrimaryButton title="Go to Sign in" onPress={() => router.replace('/auth/sign-in')} palette={palette} />
      ) : null}
      <Banner message={error} variant="error" />
      {renderBefore ? renderBefore(values, set) : null}
      {fields.map((f) => (
        <View key={f.key}>
          {f.kind === 'password' ? (
            <PasswordField
              palette={palette}
              label={f.label}
              required={f.required}
              value={values[f.key]}
              onChangeText={(v) => set({ [f.key]: v })}
              placeholder={f.placeholder || 'Create a password (min 8 characters)'}
              editable={!busy}
            />
          ) : f.kind === 'select' ? (
            <SelectField
              palette={palette}
              label={f.label}
              required={f.required}
              value={values[f.key]}
              options={f.options}
              onChange={(v) => set({ [f.key]: v })}
              placeholder={f.placeholder || 'Select…'}
            />
          ) : (
            <FormField
              palette={palette}
              label={f.label}
              required={f.required}
              value={String(values[f.key] ?? '')}
              onChangeText={(v) =>
                set({ [f.key]: f.kind === 'phone' || f.kind === 'number' ? v.replace(/[^0-9]/g, '') : f.upper ? v.toUpperCase() : v })
              }
              placeholder={f.placeholder}
              keyboardType={
                f.kind === 'email' ? 'email-address' : f.kind === 'phone' ? 'phone-pad' : f.kind === 'number' ? 'number-pad' : 'default'
              }
              autoCapitalize={f.kind === 'email' || f.upper ? (f.upper ? 'characters' : 'none') : 'words'}
              autoCorrect={false}
              maxLength={f.maxLength || (f.kind === 'phone' ? 10 : undefined)}
              multiline={f.kind === 'multiline'}
              editable={!busy}
            />
          )}
          {f.helper ? <Text style={styles.helper}>{typeof f.helper === 'function' ? f.helper(values) : f.helper}</Text> : null}
          {renderAfterField ? renderAfterField(f.key, values, set) : null}
        </View>
      ))}
      {terms ? (
        <CheckboxRow palette={palette} checked={values.terms} onToggle={() => set({ terms: !values.terms })} label={terms} />
      ) : null}
      <PrimaryButton title="Create account" onPress={onSubmit} loading={busy} palette={palette} />
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <LinkButton label="Sign in" onPress={() => router.replace('/auth/sign-in')} color={palette.primaryDark} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[900], marginBottom: SPACING.sm },
  helper: { fontSize: TYPE.caption, lineHeight: leading(TYPE.caption), color: SLATE[500], marginTop: -SPACING.xs, marginBottom: SPACING.sm },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: SPACING.md },
  footerText: { fontSize: TYPE.label, color: SLATE[600] },
});
