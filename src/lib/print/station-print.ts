function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Fetches a station label (barista sticker or kitchen food label) by
 * PrintJob.id OR Order.id (the API route tries both, see its comments) and
 * writes it to an already-connected BLE printer. Shared by StationPrinterPanel
 * (auto-print on the `print-queue` NEW_JOB Pusher event) and each KDS order
 * card's manual "Print Label" button (a safety net for when the automatic
 * path is missed -- e.g. the printer wasn't connected yet when NEW_JOB fired).
 */
export async function printStationLabel(
  labelEndpointBase: string,
  id: string,
  writeBytes: (bytes: Uint8Array) => Promise<void>
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${labelEndpointBase}/${id}`);
  if (res.status === 204) {
    return { ok: true, message: 'Tidak ada item untuk station ini.' };
  }
  if (!res.ok) {
    return { ok: false, message: 'Gagal ambil data label.' };
  }
  const { bytes } = await res.json();
  await writeBytes(base64ToBytes(bytes));
  return { ok: true, message: 'Label tercetak.' };
}

/**
 * Same idea as printStationLabel, but for a fixed test endpoint (dummy
 * sample data, no PrintJob/order involved) -- lets staff verify physical
 * print layout without placing a real order first.
 */
export async function printTestLabel(
  endpoint: string,
  writeBytes: (bytes: Uint8Array) => Promise<void>
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(endpoint);
  if (!res.ok) {
    return { ok: false, message: 'Gagal ambil data test print.' };
  }
  const { bytes } = await res.json();
  await writeBytes(base64ToBytes(bytes));
  return { ok: true, message: 'Test label tercetak.' };
}
