import { create } from 'zustand'
import { stockAPI } from '../api'

// ── Son d'alerte ────────────────────────────────────────────────────────────
// AudioContext partagé : les navigateurs bloquent l'audio tant qu'aucune
// interaction utilisateur n'a eu lieu, on débloque au premier clic / touche.
let _audioCtx = null
let _unlocked = false

function getAudioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!_audioCtx) {
    try { _audioCtx = new Ctx() } catch { return null }
  }
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {})
  }
  return _audioCtx
}

function unlockAudio() {
  if (_unlocked) return
  _unlocked = true
  getAudioCtx()
}

if (typeof window !== 'undefined') {
  const events = ['pointerdown', 'keydown', 'touchstart']
  for (const ev of events) window.addEventListener(ev, unlockAudio, { once: true, capture: true })
}

function playAlertSound() {
  try {
    const ctx = getAudioCtx()
    if (!ctx) return

    // Suite de deux bips courts et aigus
    const beep = (freq, start, dur, vol = 0.12) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(vol, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur + 0.05)
    }

    beep(880, 0, 0.18)
    beep(660, 0.22, 0.25)
  } catch {}
}

const useAlertStore = create((set, get) => ({
  unreadCount: 0,
  alerts: [],
  wsConnected: false,
  // Notification à afficher dans une modale centrale
  notification: null,

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

  dismissNotification: () => set({ notification: null }),

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
          // Son d'alerte
          playAlertSound()
          // Notification en modale centrale
          set({
            notification: {
              id: Date.now(),
              product_name: msg.product_name || 'Produit',
              alert_level: msg.alert_level || 'low',
              stock_quantity: msg.stock_quantity,
            },
          })
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
