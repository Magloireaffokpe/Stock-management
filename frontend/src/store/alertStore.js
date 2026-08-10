import { create } from 'zustand'
import { stockAPI } from '../api'

const useAlertStore = create((set, get) => ({
  unreadCount: 0,
  alerts: [],
  wsConnected: false,

  fetchCount: async () => {
    try {
      const res = await stockAPI.alertCount()
      set({ unreadCount: res.data.unread_count })
    } catch {}
  },

  fetchAlerts: async () => {
    try {
      const res = await stockAPI.alerts()
      const data = res.data?.results ?? res.data
      set({ alerts: data })
    } catch {}
  },

  incrementUnread: () => set(s => ({ unreadCount: s.unreadCount + 1 })),

  markAllRead: async () => {
    await stockAPI.markAllRead()
    set({ unreadCount: 0, alerts: get().alerts.map(a => ({ ...a, is_read: true })) })
  },

  connectWS: () => {
    if (get().wsConnected) return
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${protocol}://${window.location.host}/ws/stock/`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => set({ wsConnected: true })

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'STOCK_ALERT') {
          get().incrementUnread()
          get().fetchAlerts()
          // Son d'alerte si activé
          try {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.setValueAtTime(880, ctx.currentTime)
            gain.gain.setValueAtTime(0.1, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
            osc.start()
            osc.stop(ctx.currentTime + 0.4)
          } catch {}
        }
        if (msg.type === 'STOCK_UPDATE') {
          // Le store catalog peut réagir ici via event
          window.dispatchEvent(new CustomEvent('stock:update', { detail: msg }))
        }
      } catch {}
    }

    ws.onclose = () => {
      set({ wsConnected: false })
      // Reconnexion automatique après 5s
      setTimeout(() => get().connectWS(), 5000)
    }

    // Ping keep-alive toutes les 30s
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PING' }))
      }
    }, 30000)

    ws._pingInterval = ping
  },
}))

export default useAlertStore
