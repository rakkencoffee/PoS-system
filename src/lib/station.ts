/**
 * Station identity — dipakai buat routing print job ke printer yang benar
 * pas ada beberapa tablet kiosk (masing-masing punya printer sendiri).
 *
 * Tablet dibuka dengan URL ?station=A (atau B, C, dst). Begitu ke-capture,
 * disimpan ke localStorage supaya tetap kebawa walau navigasi antar halaman
 * kiosk (menu -> cart -> checkout) tanpa perlu nyelipin query param di tiap link.
 */

const STORAGE_KEY = 'rakken_kiosk_station';

/** Panggil sekali di root kiosk layout — capture ?station= dari URL kalau ada. */
export function captureStationFromUrl() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const station = params.get('station');
  if (station) {
    window.localStorage.setItem(STORAGE_KEY, station.toUpperCase());
  }
}

/** Ambil station yang lagi aktif buat tablet ini. Null kalau belum pernah di-set. */
export function getStation(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}
