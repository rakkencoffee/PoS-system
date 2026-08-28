/**
 * Direct Print — sends raw ESC/POS bytes straight from the server to a WiFi/LAN
 * printer over the internet (port-forwarding + DDNS), bypassing the local
 * print-bridge daemon entirely for stations configured here.
 *
 * Requires the Node.js runtime (uses `net`, unavailable on the Edge runtime).
 */

import net from 'net';
import { formatReceipt, type ReceiptData } from './format-receipt';

export interface StationPrinterConfig {
  host: string;
  port: number;
  /** chars per line — 48 for 80mm (iWare D260WF), 32 for 58mm. Defaults to 48. */
  lineWidth?: number;
}

/**
 * Reads STATION_PRINTER_MAP env var, e.g.:
 * STATION_PRINTER_MAP={"A":{"host":"rakken-a.duckdns.org","port":19100,"lineWidth":48}}
 *
 * A station with no entry here still gets its PrintJob written normally and
 * falls back to the local print-bridge daemon polling it — this map only
 * opts specific stations into direct server-to-printer delivery.
 */
export function getStationPrinterConfig(station: string | null | undefined): StationPrinterConfig | null {
  if (!station) return null;
  const raw = process.env.STATION_PRINTER_MAP;
  if (!raw) return null;

  try {
    const map = JSON.parse(raw) as Record<string, StationPrinterConfig>;
    return map[station] || null;
  } catch (err) {
    console.warn('[DirectPrint] STATION_PRINTER_MAP is not valid JSON, ignoring:', (err as Error).message);
    return null;
  }
}

function writeToSocket(host: string, port: number, buffer: Buffer, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      err ? reject(err) : resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.once('timeout', () => finish(new Error(`Timed out connecting to printer ${host}:${port}`)));
    socket.once('error', (err) => finish(err));

    socket.connect(port, host, () => {
      socket.write(buffer, (err) => {
        if (err) return finish(err);
        // write()'s callback only means the OS accepted the bytes — cheap
        // embedded printers on a slow WiFi link (RTT can be 800ms+) can still
        // be mid-print; destroying the socket immediately truncates the job.
        // Give it a moment to actually finish before tearing down.
        setTimeout(() => finish(), 2000);
      });
    });
  });
}

/**
 * Best-effort direct print. Never throws — callers should fire this without
 * blocking the customer-facing response, since printer reachability over the
 * internet is inherently less reliable than local network/Bluetooth.
 *
 * Returns true if the bytes were handed off successfully, false otherwise
 * (caller should leave the PrintJob row alone on false so the local daemon,
 * if any, can still pick it up as a fallback).
 */
export async function tryDirectPrint(
  station: string | null | undefined,
  data: ReceiptData
): Promise<boolean> {
  const config = getStationPrinterConfig(station);
  if (!config) return false;

  try {
    const lineWidth = config.lineWidth ?? 48;
    // Direct-print stations only print the receipt, not drink labels — unlike
    // the print-bridge daemon path, these printers aren't set up for the
    // combined receipt+labels roll.
    const receiptBuffer = formatReceipt(data, lineWidth);

    await writeToSocket(config.host, config.port, receiptBuffer);
    console.log(`[DirectPrint] Sent order ${data.orderId} straight to station ${station} (${config.host}:${config.port})`);
    return true;
  } catch (err) {
    console.warn(`[DirectPrint] Failed to reach station ${station} printer directly:`, (err as Error).message);
    return false;
  }
}
