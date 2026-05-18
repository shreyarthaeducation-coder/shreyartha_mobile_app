import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'student', 'school', 'parent'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const studentToken = await AsyncStorage.getItem('studentToken');
      const schoolToken = await AsyncStorage.getItem('schoolUserToken');
      const parentToken = await AsyncStorage.getItem('parentUserToken');
      const adminToken = await AsyncStorage.getItem('adminToken');
      const storedUserType = await AsyncStorage.getItem('userType');
      const storedUser = await AsyncStorage.getItem('userData');

      if (studentToken || schoolToken || parentToken || adminToken) {
        setUserType(storedUserType);
        if (storedUser) setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Auth check failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'studentToken', 'userToken', 'accessToken', 'token', 'adminToken',
        'schoolUserToken', 'parentUserToken',
        'studentLoggedIn', 'schoolLoggedIn', 'parentLoggedIn', 'adminLoggedIn',
        'userType', 'userData', 'schoolUserType',
      ]);
      setUser(null);
      setUserType(null);
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, userType, setUserType, loading, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
