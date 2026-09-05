/**
 * Chart primitives for the staff panels.
 *
 * Hand-drawn on `react-native-svg` with no chart library. The deciding factor was the adaptive
 * report's six-metric radar, which no RN chart library provides — so a radar had to be built by
 * hand regardless, and mixing a library with hand-drawn SVG for the rest would have been worse
 * than doing all of it one way. Everything else here is either plain Views (bars) or a handful of
 * SVG primitives (ring, gauge).
 */

export { default as ProgressBar } from './ProgressBar';
export { default as GroupedBars } from './GroupedBars';
export { default as DonutChart } from './DonutChart';
// The multi-segment sibling of DonutChart — a real pie, which the kit lacked until the sales
// funnel needed one. DonutChart stays a single-value progress ring; the two are not merged
// because their call sites want opposite things (one percentage vs a set of counts).
export { default as SegmentedDonut } from './SegmentedDonut';
export { default as GaugeChart, gaugeSeverity, GAUGE_BANDS } from './GaugeChart';
export { default as RadarChart } from './RadarChart';
export { default as LineChart } from './LineChart';
