/**
 * Shared UI kit for the native staff panels (teacher + app/staff/[role]).
 *
 * Like components/auth, every component takes an optional `palette` prop defaulting to
 * PORTALS.school, so nothing here hardcodes the teal and the parent/student portals can adopt the
 * same primitives later.
 *
 * Do not confuse this with app/components/* — those are the public landing-page components and
 * are painted in the red marketing palette.
 */

export { Card, CardTitle, InfoRow } from './Card';
export { default as StatusChip } from './StatusChip';
export { default as Toast, useToast } from './Toast';
export { default as EmptyState } from './EmptyState';
export { default as ScreenScaffold } from './ScreenScaffold';
// The shared "Welcome / photo / name" identity block for every portal's home screen.
export { default as WelcomeHeader } from './WelcomeHeader';
export { default as AnalyticsSummaryCard } from './AnalyticsSummaryCard';
export { default as SensitiveGate } from './SensitiveGate';
export { default as MonthNavigator, MONTH_NAMES } from './MonthNavigator';
export { default as CalendarGrid } from './CalendarGrid';
export { default as Select } from './Select';
export { default as ScopePicker, EMPTY_SCOPE } from './ScopePicker';
export { default as SchoolClassPicker, EMPTY_SCHOOL_SCOPE } from './SchoolClassPicker';
export { default as SegmentedTabs } from './SegmentedTabs';
export { default as ChipMultiSelect } from './ChipMultiSelect';
export { default as FormSheet } from './FormSheet';
export { default as DateTimeField } from './DateTimeField';
export {
  ProgressBar,
  GroupedBars,
  DonutChart,
  SegmentedDonut,
  GaugeChart,
  RadarChart,
  LineChart,
  gaugeSeverity,
} from './charts';

// Re-exported rather than duplicated: components/auth/FormField is already a plain labelled
// TextInput with no auth-specific behaviour (it accepts `palette` and ignores it), and it encodes
// the "no per-focus setState" rule that keeps the Android keyboard open. Staff screens import it
// from here so the kit stays the single import surface.
export { default as TextField } from '../auth/FormField';
