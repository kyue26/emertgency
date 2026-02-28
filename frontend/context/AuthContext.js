import { createContext } from 'react';

/**
 * Auth context: isAuthenticated, userRole ('member' | 'commander'), handleLogout.
 * Consumed by ProfileScreen and other screens; provided by App.js.
 */
export const AuthContext = createContext(null);
