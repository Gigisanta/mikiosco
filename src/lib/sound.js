const SOUND_PREFERENCE_KEY = 'mikiosco-interface-sounds'
const LEGACY_SOUND_PREFERENCE_KEY = 'mikiosco-scan-sound'

const soundPatterns = {
  tap: [{ frequency: 610, endFrequency: 560, duration: 0.032, volume: 0.012 }],
  selection: [{ frequency: 680, endFrequency: 720, duration: 0.038, volume: 0.014 }],
  navigate: [
    { frequency: 470, endFrequency: 560, duration: 0.05, volume: 0.015 },
    { frequency: 720, endFrequency: 760, delay: 0.018, duration: 0.042, volume: 0.008 },
  ],
  add: [
    { frequency: 660, endFrequency: 740, duration: 0.055, volume: 0.02 },
    { frequency: 990, endFrequency: 1040, delay: 0.018, duration: 0.045, volume: 0.01 },
  ],
  success: [
    { frequency: 659, endFrequency: 698, duration: 0.075, volume: 0.022 },
    { frequency: 880, endFrequency: 932, delay: 0.048, duration: 0.095, volume: 0.019 },
  ],
  warning: [
    { frequency: 440, endFrequency: 415, duration: 0.075, volume: 0.018 },
    { frequency: 370, endFrequency: 350, delay: 0.055, duration: 0.085, volume: 0.016 },
  ],
  error: [
    { frequency: 310, endFrequency: 260, duration: 0.11, volume: 0.02 },
    { frequency: 230, endFrequency: 210, delay: 0.06, duration: 0.08, volume: 0.012 },
  ],
}

let audioContext
let masterGain
const lastSoundAt = new Map()

export function areInterfaceSoundsEnabled() {
  const saved = globalThis.localStorage?.getItem(SOUND_PREFERENCE_KEY)
  if (saved) return saved !== 'off'
  return globalThis.localStorage?.getItem(LEGACY_SOUND_PREFERENCE_KEY) !== 'off'
}

export function setInterfaceSoundsEnabled(enabled) {
  const value = enabled ? 'on' : 'off'
  globalThis.localStorage?.setItem(SOUND_PREFERENCE_KEY, value)
  globalThis.localStorage?.setItem(LEGACY_SOUND_PREFERENCE_KEY, value)
  globalThis.dispatchEvent?.(new CustomEvent('mikiosco:sound-preference', { detail: { enabled } }))
}

function getAudioOutput() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!AudioContextClass) return null
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextClass()
    masterGain = audioContext.createGain()
    masterGain.gain.value = 0.72
    masterGain.connect(audioContext.destination)
  }
  if (audioContext.state === 'suspended') void audioContext.resume()
  return { context: audioContext, output: masterGain }
}

function playTone(note, audio) {
  const { context, output } = audio
  const start = context.currentTime + 0.004 + (note.delay || 0)
  const end = start + note.duration
  const oscillator = context.createOscillator()
  const envelope = context.createGain()
  const filter = context.createBiquadFilter()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(note.frequency, start)
  oscillator.frequency.exponentialRampToValueAtTime(note.endFrequency, end)
  filter.type = 'lowpass'
  filter.frequency.value = 4200
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(note.volume, start + 0.006)
  envelope.gain.exponentialRampToValueAtTime(0.0001, end)

  oscillator.connect(filter).connect(envelope).connect(output)
  oscillator.start(start)
  oscillator.stop(end + 0.01)
}

export function playInterfaceSound(type = 'tap') {
  if (!areInterfaceSoundsEnabled()) return false
  const pattern = soundPatterns[type] || soundPatterns.tap
  const now = performance.now()
  if (now - (lastSoundAt.get(type) || 0) < 22) return false
  const audio = getAudioOutput()
  if (!audio) return false
  lastSoundAt.set(type, now)
  pattern.forEach((note) => playTone(note, audio))
  return true
}

function soundForControl(control) {
  const explicit = control.dataset.sound
  if (explicit === 'none') return null
  if (explicit && soundPatterns[explicit]) return explicit
  if (control.matches('.nav-item, .panel-link')) return 'navigate'
  return 'tap'
}

export function bindInterfaceSounds() {
  function handleClick(event) {
    if (event.detail === 0) return
    const control = event.target.closest('button, a[href], [role="button"]')
    if (!control || control.matches(':disabled, [aria-disabled="true"]')) return
    const sound = soundForControl(control)
    if (sound) playInterfaceSound(sound)
  }

  function handleChange(event) {
    if (event.target.matches('select, input[type="checkbox"], input[type="radio"]')) {
      playInterfaceSound('selection')
    }
  }

  const alertObserver = new MutationObserver((mutations) => {
    const hasNewLocalAlert = mutations.some((mutation) =>
      [...mutation.addedNodes].some((node) => {
        if (!(node instanceof Element)) return false
        const alert = node.matches('[role="alert"]') ? node : node.querySelector('[role="alert"]')
        return alert && !alert.classList.contains('toast')
      }),
    )
    if (hasNewLocalAlert) playInterfaceSound('error')
  })

  document.addEventListener('click', handleClick)
  document.addEventListener('change', handleChange)
  alertObserver.observe(document.body, { childList: true, subtree: true })

  return () => {
    document.removeEventListener('click', handleClick)
    document.removeEventListener('change', handleChange)
    alertObserver.disconnect()
  }
}
