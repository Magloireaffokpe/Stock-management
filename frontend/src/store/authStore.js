import { create } from 'zustand'
import { authAPI } from '../api'

const useAuthStore = create((set, get) => ({
  user:          null,
  accessToken:   localStorage.getItem('access_token') || null,
  refreshToken:  localStorage.getItem('refresh_token') || null,
  loading:       false,
  initialized:   false,

  login: async (username, password) => {
    set({ loading: true })
    const res = await authAPI.login({ username, password })
    const { access, refresh, user } = res.data
    localStorage.setItem('access_token',  access)
    localStorage.setItem('refresh_token', refresh)
    set({ accessToken: access, refreshToken: refresh, user, loading: false })
    return user
  },

  logout: async () => {
    const refresh = get().refreshToken
    try { await authAPI.logout({ refresh }) } catch {}
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, accessToken: null, refreshToken: null })
  },

  fetchMe: async () => {
    try {
      const res = await authAPI.me()
      set({ user: res.data, initialized: true })
    } catch {
      set({ initialized: true })
    }
  },

  isAdmin: () => {
    const u = get().user
    return u?.role === 'admin' || u?.is_superuser
  },
}))

export default useAuthStore
