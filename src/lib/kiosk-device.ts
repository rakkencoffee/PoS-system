const STORAGE_KEY = 'rakken-kiosk-device-id';

/**
 * Identifies which physical kiosk device (and therefore which physical EDC
 * terminal) this browser is running on. Set once per device via the launch
 * shortcut's URL (?device=A), persisted to localStorage so it survives
 * client-side navigation to routes that don't carry the query string.
 */
export function getKioskDeviceId(): string | null {
  if (typeof window === 'undefined') return null;

  const fromUrl = new URLSearchParams(window.location.search).get('device');
  if (fromUrl) {
    try {
      localStorage.setItem(STORAGE_KEY, fromUrl);
    } catch {
      // ignore — private mode / storage disabled
    }
    return fromUrl;
  }

  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
