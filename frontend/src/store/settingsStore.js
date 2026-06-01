import { create } from 'zustand'
import { settingsAPI } from '../api'

const useSettingsStore = create((set, get) => ({
  settings: null,
  loading: false,

  fetch: async () => {
    if (get().settings) return get().settings
    set({ loading: true })
    try {
      const res = await settingsAPI.get()
      set({ settings: res.data, loading: false })
      return res.data
    } catch {
      set({ loading: false })
    }
  },

  update: async (data) => {
    const res = await settingsAPI.update(data)
    set({ settings: res.data })
    return res.data
  },

  invalidate: () => set({ settings: null }),

  currency: () => get().settings?.currency || 'FCFA',
  storeName: () => get().settings?.store_name || 'MICROLOGIS',
}))

export default useSettingsStore
