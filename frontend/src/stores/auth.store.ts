import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  userId: string;
  name: string;
  email: string | null;
  role: string;
  restaurantId: string | null;
  branchId: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  operatingMode: string | null;
  /** SA-granted modules (what the plan includes) */
  enabledModules: string[];
  /** Owner's active subset of enabledModules (drives sidebar + route guards) */
  activeModules: string[];
  login: (user: AuthUser, token: string, refreshToken: string) => void;
  logout: () => void;
  setUser: (user: AuthUser) => void;
  setRestaurantConfig: (operatingMode: string | null, enabledModules: string[], activeModules: string[]) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      operatingMode: null,
      enabledModules: [],
      activeModules: [],
      login: (user, token, refreshToken) =>
        set({ user, token, refreshToken, isAuthenticated: true }),
      logout: () =>
        set({
          user: null, token: null, refreshToken: null,
          isAuthenticated: false, operatingMode: null, enabledModules: [], activeModules: [],
        }),
      setUser: (user) => set({ user }),
      setRestaurantConfig: (operatingMode, enabledModules, activeModules) =>
        set({ operatingMode, enabledModules, activeModules }),
    }),
    { name: 'restrosync-auth' }
  )
);
