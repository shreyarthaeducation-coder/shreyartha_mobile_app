import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UNIVERSITY_STAFF_HOME } from '../../services/portalClients';

/** /unistaff opens the signed-in role's own dashboard. */
export default function UniversityStaffIndex() {
  const [home, setHome] = useState(null);
  useEffect(() => {
    AsyncStorage.getItem('universityStaffUserType').then((t) => setHome(UNIVERSITY_STAFF_HOME[String(t || '').toUpperCase()] || '/auth/sign-in'));
  }, []);
  return home ? <Redirect href={home} /> : null;
}
