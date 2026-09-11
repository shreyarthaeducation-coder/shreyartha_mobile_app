import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS, SHADOWS, SPACING, TYPE, leading } from "../../constants/theme";
import { LOGIN_GROUPS } from "../../constants/authPortals";
const LOGO = require("../../assets/images/The3CEdge.png");

/**
 * The full-screen role picker — the CUSTOMER-facing doors only.
 *
 * The employee group is deliberately filtered out. The landing tab's top-right control is the one
 * entrance to it, exactly as on the website, where only the landing page's own top-right menu mounts
 * `variant="employee"` and the eleven marketing pages offer the general list alone. Employees know
 * they are employees; offering that door in a general picker is what had partner-school teachers
 * signing themselves up as Shreyartha teachers in the first place.
 *
 * The list is still LOGIN_GROUPS from constants/authPortals.js rather than a local literal — the
 * landing's compact modal renders the same doors, and the two copies had already drifted once.
 */
export default function LoginSelectScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Branded header */}
      <View style={styles.headerBand}>
        <View style={styles.headerCircle1} />
        <View style={styles.headerCircle2} />
        <TouchableOpacity
          style={styles.backBtnHeader}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        >
          <Text style={styles.backBtnHeaderText}>← Back</Text>
        </TouchableOpacity>
        <Image
          source={LOGO}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>Welcome Back</Text>
        <Text style={styles.headerSubtitle}>Select your role to continue</Text>
      </View>

      {/* Customer-facing doors only — see the docblock on why `employee` is filtered out here. */}
      <View style={styles.optionsContainer}>
        {LOGIN_GROUPS.filter((group) => group.key !== "employee").map((group, _i, shown) => (
          <View key={group.key} style={styles.group}>
            {/* A section heading earns its place only when there is more than one section. With the
                employee group filtered out there is currently one, and a lone "GET STARTED" label
                under "Select your role to continue" reads as noise. Kept conditional rather than
                deleted so a second customer group would bring its heading back. */}
            {shown.length > 1 && <Text style={styles.groupLabel}>{group.label}</Text>}
            {group.options.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.option, SHADOWS.md]}
                onPress={() => router.push(opt.route)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${opt.label} login`}
              >
                <View style={[styles.optionIconBg, { backgroundColor: opt.color }]}>
                  <Text style={styles.optionIcon}>{opt.icon}</Text>
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, { color: opt.iconColor }]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.optionSublabel}>{opt.sublabel}</Text>
                </View>
                <Text style={[styles.arrow, { color: opt.iconColor }]}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceAlt },

  // Header band
  headerBand: {
    backgroundColor: COLORS.secondary,
    paddingTop: 50,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
    overflow: "hidden",
  },
  headerCircle1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(176,0,58,0.14)",
    top: -60,
    right: -40,
  },
  headerCircle2: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(176,0,58,0.08)",
    bottom: -30,
    left: -20,
  },
  backBtnHeader: {
    alignSelf: "flex-start",
    marginBottom: SPACING.md,
  },
  backBtnHeaderText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: TYPE.heading,
    fontWeight: "600",
  },
  headerLogo: { width: 190, height: 62, marginBottom: SPACING.md },
  headerTitle: {
    color: COLORS.white,
    fontSize: TYPE.display,
    fontWeight: "800",
    marginBottom: 4,
  },
  headerSubtitle: { color: "rgba(255,255,255,0.6)", fontSize: TYPE.body },

  // Options
  optionsContainer: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    flex: 1,
  },
  // One group's heading plus its cards. The gap here is tighter than the gap between groups, so
  // the two sections read as two sections rather than as one list with labels in it.
  group: { gap: 12 },
  groupLabel: {
    fontSize: TYPE.label,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: COLORS.textSecondary,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
    flexShrink: 0,
  },
  optionIcon: { fontSize: 26 },
  optionText: { flex: 1 },
  optionLabel: { fontSize: TYPE.title, fontWeight: "700", marginBottom: 2 },
  optionSublabel: { fontSize: TYPE.label, color: COLORS.textSecondary, lineHeight: leading(TYPE.label) },
  arrow: { fontSize: 26, marginLeft: 8 },
});
