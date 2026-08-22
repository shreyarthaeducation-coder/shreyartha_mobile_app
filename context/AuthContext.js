import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ALL_AUTH_KEYS } from "../constants/storageKeys";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'student', 'school', 'parent', 'partner'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const studentToken = await AsyncStorage.getItem("studentToken");
      const schoolToken = await AsyncStorage.getItem("schoolUserToken");
      const parentToken = await AsyncStorage.getItem("parentUserToken");
      const partnerToken = await AsyncStorage.getItem("partnerUserToken");
      const storedUserType = await AsyncStorage.getItem("userType");
      const storedUser = await AsyncStorage.getItem("userData");

      if (studentToken || schoolToken || parentToken || partnerToken) {
        setUserType(storedUserType);
        if (storedUser) setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error("Auth check failed:", e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clear every auth key for every role.
   *
   * Staff callers must run endStaffAttendanceSession() BEFORE this — the attendance end-ping
   * needs the token this removes.
   */
  const logout = async () => {
    try {
      // Shared with apiService.clearAuthAndRedirect — see constants/storageKeys.js. This list
      // used to be maintained here separately and missed schoolUserVerified/Name/Email and
      // schoolCode, so stale profile data survived a logout.
      await AsyncStorage.multiRemove(ALL_AUTH_KEYS);
      setUser(null);
      setUserType(null);
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        userType,
        setUserType,
        loading,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
