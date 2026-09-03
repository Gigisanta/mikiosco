import { beforeEach, describe, expect, it } from 'vitest'
import { areInterfaceSoundsEnabled, playInterfaceSound, setInterfaceSoundsEnabled } from './sound'

describe('sonidos de interfaz', () => {
  beforeEach(() => localStorage.clear())

  it('los activa por defecto', () => {
    expect(areInterfaceSoundsEnabled()).toBe(true)
  })

  it('respeta la preferencia anterior del lector de códigos', () => {
    localStorage.setItem('mikiosco-scan-sound', 'off')
    expect(areInterfaceSoundsEnabled()).toBe(false)
  })

  it('guarda la preferencia nueva y la mantiene compatible con el POS', () => {
    setInterfaceSoundsEnabled(false)
    expect(localStorage.getItem('mikiosco-interface-sounds')).toBe('off')
    expect(localStorage.getItem('mikiosco-scan-sound')).toBe('off')
  })

  it('falla silenciosamente cuando Web Audio no está disponible', () => {
    expect(playInterfaceSound('success')).toBe(false)
  })
})
