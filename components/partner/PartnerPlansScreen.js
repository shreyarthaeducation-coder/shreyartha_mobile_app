import { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { SPACING, TYPE } from '../../constants/theme';
import { Card, EmptyState, ScreenScaffold, Select, StatusChip } from '../ui';
import { makeStyles } from '../../utils/makeStyles';
import useStaffResource from '../../hooks/useStaffResource';
import {
  availableClasses,
  availableStreams,
  fetchCustomPlans,
  filterPlans,
  streamLabel,
} from '../../services/partner/plansService';
import { formatRupees } from '../../utils/currency';
import htmlToText from '../../utils/htmlToText';

/**
 * Plans for Students — the admin-managed custom plans a partner quotes to families.
 *
 * Ports frontendmain/src/Partner/platform/PartnerPlans.js: class dropdown → stream dropdown →
 * plan cards, with the partner-code discount called out.
 *
 * ⚠️ This tab calls `GET /api/custom-plans`, NOT anything under /api/partner — it is the same
 * public endpoint the website's plans page uses. See services/partner/plansService.js.
 *
 * `details` is admin-authored HTML from the TipTap editor, so it goes through htmlToText rather
 * than into a <Text> raw — otherwise a partner reads "&nbsp;" and "<p>" to a parent.
 */

export default function PartnerPlansScreen({ homeRoute = '/partner' }) {
  const styles = useStyles();
  const { data, loading, error, refreshing, refresh, reload } = useStaffResource(fetchCustomPlans);

  const plans = Array.isArray(data) ? data : [];
  const classes = useMemo(() => availableClasses(plans), [plans]);

  const [className, setClassName] = useState('');
  const [stream, setStream] = useState('');

  // Settle on a class as soon as one exists, so the screen is never an empty pair of dropdowns.
  useEffect(() => {
    if (!className && classes.length > 0) setClassName(classes[0]);
  }, [classes, className]);

  const streams = useMemo(() => availableStreams(plans, className), [plans, className]);

  // The web resets the stream whenever the class changes; without that, picking Class 9 →
  // Commerce → Class 11 leaves a stream filter that class may not offer, and the list goes empty
  // with no visible reason.
  useEffect(() => {
    setStream('');
  }, [className]);

  const visible = useMemo(
    () => filterPlans(plans, className, stream),
    [plans, className, stream],
  );

  return (
    <ScreenScaffold
      title="Plans for Students"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {plans.length === 0 && !loading ? (
        <EmptyState
          icon="list-outline"
          title="No plans published"
          message="Custom plans appear here once an administrator publishes them."
        />
      ) : (
        <>
          <Select
            variant="chip"
            label="Class"
            value={className}
            options={classes.map((c) => ({ value: c, label: c }))}
            onChange={setClassName}
          />
          {streams.length > 0 ? (
            <Select
              variant="chip"
              label="Stream"
              value={stream}
              options={[
                { value: '', label: 'All streams' },
                ...streams.map((s) => ({ value: s, label: streamLabel(s) })),
              ]}
              onChange={setStream}
            />
          ) : null}

          {visible.length === 0 ? (
            <EmptyState
              icon="pricetag-outline"
              title="No plans for this selection"
              message="Try a different class or stream."
            />
          ) : (
            visible.map((plan) => {
              const details = htmlToText(plan.details || '');
              return (
                <Card key={plan.id}>
                  {plan.imageUrl ? (
                    <Image
                      source={{ uri: plan.imageUrl }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  ) : null}

                  <Text style={styles.name}>{plan.name}</Text>
                  <View style={styles.chips}>
                    {plan.className ? <StatusChip label={plan.className} tone="neutral" /> : null}
                    {plan.stream ? (
                      <StatusChip label={streamLabel(plan.stream)} tone="info" />
                    ) : null}
                    {plan.duration ? <StatusChip label={plan.duration} tone="neutral" /> : null}
                  </View>

                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{formatRupees(plan.discountedPriceInr)}</Text>
                    {/* Only strike the list price when it is actually higher — an equal value
                        struck through reads as a discount that does not exist. */}
                    {plan.companyPriceInr != null
                    && plan.discountedPriceInr != null
                    && Number(plan.companyPriceInr) > Number(plan.discountedPriceInr) ? (
                      <Text style={styles.was}>{formatRupees(plan.companyPriceInr)}</Text>
                    ) : null}
                  </View>

                  {plan.monthlyDiscountedPriceInr != null ? (
                    <Text style={styles.monthly}>
                      {`${formatRupees(plan.monthlyDiscountedPriceInr)} / month`}
                    </Text>
                  ) : null}

                  {plan.partnerCodeDiscountPercent ? (
                    <View style={styles.partnerBadge}>
                      <Text style={styles.partnerBadgeText}>
                        {`Extra ${plan.partnerCodeDiscountPercent}% off with your partner code`}
                      </Text>
                    </View>
                  ) : null}

                  {details ? <Text style={styles.details}>{details}</Text> : null}
                </Card>
              );
            })
          )}
        </>
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  image: { width: '100%', height: 140, borderRadius: 12, marginBottom: SPACING.sm },
  name: { fontSize: TYPE.title, fontWeight: '700', color: p.primaryDark },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: SPACING.sm },
  price: { fontSize: TYPE.headline, fontWeight: '800', color: p.primary },
  was: {
    fontSize: TYPE.label,
    color: p.primaryDark,
    opacity: 0.6,
    textDecorationLine: 'line-through',
  },
  monthly: { fontSize: TYPE.label, color: p.primaryDark, opacity: 0.85, marginTop: 2 },
  partnerBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: p.tint,
    marginTop: SPACING.sm,
  },
  partnerBadgeText: { fontSize: TYPE.caption, fontWeight: '700', color: p.primaryDark },
  details: { fontSize: TYPE.label, color: p.primaryDark, opacity: 0.85, marginTop: SPACING.sm, lineHeight: 18 },
}));
