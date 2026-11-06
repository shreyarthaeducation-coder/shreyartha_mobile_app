import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PortalHomeScreen from '../../components/portal/PortalHomeScreen';
import { UNIVERSITY_STAFF_LABEL } from '../../services/portalClients';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';

/**
 * University Staff whose role has no dashboard yet — Counselor and Admission Officer — the website's
 * UniversityStaffWelcome: who they are, change password and log out, and a plain note that their
 * dashboard is on its way. Verified staff only reach it; the layout's gate sends the rest to the
 * pending screen.
 */
export default function UniversityStaffWelcome() {
  const [role, setRole] = useState('');
  useEffect(() => {
    AsyncStorage.getItem('universityStaffUserType').then((t) => setRole(String(t || '').toUpperCase()));
  }, []);
  const label = UNIVERSITY_STAFF_LABEL[role] || 'University Staff';
  return (
    <PortalHomeScreen portalLabel={label} nameKey="universityStaffName" tiles={[]} changePasswordRoute="/unistaff/change-password">
      <View style={styles.card}>
        <Text style={styles.title}>Your dashboard is on its way</Text>
        <Text style={styles.body}>
          The {label} dashboard is being built. Your account is ready — you will find it here as soon as it opens, with nothing more to do.
        </Text>
      </View>
    </PortalHomeScreen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.md },
  title: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[900] },
  body: { fontSize: TYPE.body, lineHeight: leading(TYPE.body), color: SLATE[600], marginTop: SPACING.xs },
});
