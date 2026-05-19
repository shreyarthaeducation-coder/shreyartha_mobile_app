import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { studentService } from '../services/studentService';

const SubscriptionContext = createContext({
  loading: true,
  isPremium: false,
  plan: 'Free',
  raw: null,
  refresh: async () => {},
});

/** Normalizes optional values into lowercase text for plan/status matching. */
const normalizeText = (value) => String(value ?? '').trim().toLowerCase();

const boolFromValue = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  const text = normalizeText(value);
  if (!text) return null;
  if (['true', 'yes', 'y', '1', 'premium', 'pro', 'paid', 'active', 'subscribed'].includes(text)) return true;
  if (['false', 'no', 'n', '0', 'free', 'basic', 'inactive', 'unsubscribed'].includes(text)) return false;
  return null;
};

const extractSubscription = (payload) => {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload || {};
  const student = data?.student || data?.user || data?.profile || {};
  const subscriptionCandidate =
    data?.subscription
    || data?.plan
    || data?.membership
    || data?.entitlement
    || student?.subscription
    || student?.plan
    || student?.membership
    || student?.entitlement
    || data;

  const candidate = subscriptionCandidate && typeof subscriptionCandidate === 'object'
    ? subscriptionCandidate
    : { value: subscriptionCandidate };

  const planRaw =
    candidate?.name
    || candidate?.plan
    || candidate?.tier
    || candidate?.type
    || candidate?.label
    || student?.planName
    || student?.plan
    || student?.membershipType
    || data?.planName
    || data?.plan
    || data?.subscriptionType
    || data?.membershipType
    || '';

  const boolCandidates = [
    candidate?.isPremium,
    candidate?.premium,
    candidate?.paid,
    candidate?.active,
    data?.isPremium,
    data?.premium,
    data?.isPaid,
    student?.isPremium,
    student?.premium,
    student?.isPaid,
    student?.subscriptionActive,
  ];

  const firstResolvedCandidate = boolCandidates.find((value) => boolFromValue(value) !== null);
  const resolvedPremiumValue = firstResolvedCandidate === undefined ? null : boolFromValue(firstResolvedCandidate);
  let isPremium = resolvedPremiumValue;

  const planText = normalizeText(planRaw || candidate?.status || data?.status);
  if (isPremium === null) {
    isPremium = ['premium', 'pro', 'paid', 'gold', 'platinum', 'enterprise'].some((token) => planText.includes(token));
  }

  return {
    isPremium: Boolean(isPremium),
    plan: String(planRaw || (isPremium ? 'Premium' : 'Free')).trim() || (isPremium ? 'Premium' : 'Free'),
    raw: data,
  };
};

export function SubscriptionProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [plan, setPlan] = useState('Free');
  const [raw, setRaw] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await studentService.getStudentSubscription();
      const parsed = extractSubscription(payload);
      setIsPremium(parsed.isPremium);
      setPlan(parsed.plan);
      setRaw(parsed.raw);
    } catch (error) {
      console.warn('[Subscription] Failed to resolve subscription state', error);
      setIsPremium(false);
      setPlan('Free');
      setRaw(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(
    () => ({ loading, isPremium, plan, raw, refresh }),
    [loading, isPremium, plan, raw, refresh],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
