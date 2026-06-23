import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getLocalIP } from '../src/main/signaling'
import { networkInterfaces } from 'os'

vi.mock('os', async (importOriginal) => {
  const original = await importOriginal<typeof import('os')>()
  return {
    ...original,
    networkInterfaces: vi.fn(),
  }
})

describe('getLocalIP', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should prioritize Wi-Fi/WLAN over Ethernet and other interfaces', () => {
    vi.mocked(networkInterfaces).mockReturnValue({
      'Ethernet': [
        { address: '192.168.1.10', family: 'IPv4', internal: false, mac: '', netmask: '' }
      ] as any,
      'Wi-Fi': [
        { address: '192.168.1.25', family: 'IPv4', internal: false, mac: '', netmask: '' }
      ] as any,
      'vEthernet (WSL)': [
        { address: '172.20.10.1', family: 'IPv4', internal: false, mac: '', netmask: '' }
      ] as any,
    })

    expect(getLocalIP()).toBe('192.168.1.25')
  })

  it('should fall back to Ethernet if Wi-Fi is not available', () => {
    vi.mocked(networkInterfaces).mockReturnValue({
      'vEthernet (WSL)': [
        { address: '172.20.10.1', family: 'IPv4', internal: false, mac: '', netmask: '' }
      ] as any,
      'Ethernet': [
        { address: '192.168.1.10', family: 'IPv4', internal: false, mac: '', netmask: '' }
      ] as any,
    })

    expect(getLocalIP()).toBe('192.168.1.10')
  })

  it('should fall back to other interfaces if neither Wi-Fi nor Ethernet is available', () => {
    vi.mocked(networkInterfaces).mockReturnValue({
      'vEthernet (WSL)': [
        { address: '172.20.10.1', family: 'IPv4', internal: false, mac: '', netmask: '' }
      ] as any,
      'some-other-physical': [
        { address: '10.0.0.5', family: 'IPv4', internal: false, mac: '', netmask: '' }
      ] as any,
    })

    expect(getLocalIP()).toBe('10.0.0.5')
  })

  it('should return 127.0.0.1 if no external IPv4 interface is found', () => {
    vi.mocked(networkInterfaces).mockReturnValue({
      'lo': [
        { address: '127.0.0.1', family: 'IPv4', internal: true, mac: '', netmask: '' }
      ] as any,
    })

    expect(getLocalIP()).toBe('127.0.0.1')
  })
})
