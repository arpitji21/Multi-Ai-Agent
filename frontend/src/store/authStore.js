import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post('/auth/login', { email, password });
          const { token, user } = res.data;
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ user, token, isLoading: false, error: null });
          return { success: true, role: user.role };
        } catch (err) {
          const msg = err.response?.data?.error || 'Login failed';
          set({ isLoading: false, error: msg });
          return { success: false, error: msg };
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post('/auth/register', data);
          const { token, user } = res.data;
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ user, token, isLoading: false, error: null });
          return { success: true, role: user.role };
        } catch (err) {
          const msg = err.response?.data?.error || 'Registration failed';
          set({ isLoading: false, error: msg });
          return { success: false, error: msg };
        }
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, token: null, error: null });
      },

      setToken: (token) => {
        if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        else delete api.defaults.headers.common['Authorization'];
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'mediai-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

// Restore auth header on app load
const { token } = useAuthStore.getState();
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export default useAuthStore;
