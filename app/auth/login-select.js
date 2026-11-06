import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS, SPACING, TYPE } from "../../constants/theme";
import { LOGIN_GROUPS } from "../../constants/authPortals";
import SignupTiles from "../../components/auth/SignupTiles";
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
  const registerOptions = LOGIN_GROUPS.find((g) => g.key === "general")?.options ?? [];

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
        <Text style={styles.headerTitle}>Create an account</Text>
        <Text style={styles.headerSubtitle}>
          Pick what you are — signing up differs for each
        </Text>
      </View>

      {/* Two layers of tiles (6 Nov 2026), the same picker as under Sign in: the kind of
          organisation first, then the role in it. Customer-facing doors only, the general group;
          see the docblock on why the employee group stays out. ?tab=signup — this is the REGISTER
          picker; each page still carries its own login tab, so a deep link keeps working. */}
      <ScrollView contentContainerStyle={styles.optionsContainer}>
        <SignupTiles options={registerOptions} onPick={(opt) => router.push(`${opt.route}?tab=signup`)} />
        <TouchableOpacity
          style={styles.signInLink}
          activeOpacity={0.75}
          onPress={() => router.replace("/auth/sign-in")}
          accessibilityRole="button"
        >
          <Text style={styles.signInLinkText}>
            Already have an account? <Text style={styles.signInLinkStrong}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
  },
  signInLink: { marginTop: SPACING.md, alignItems: "center", paddingVertical: SPACING.sm },
  signInLinkText: { fontSize: TYPE.body, color: COLORS.textSecondary },
  signInLinkStrong: { fontWeight: "800", color: COLORS.primary },
});
