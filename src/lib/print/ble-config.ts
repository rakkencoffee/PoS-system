/**
 * Web Bluetooth config for the barista sticker printer.
 *
 * Confirmed 2026-09-01 via src/app/debug/ble-test (a throwaway diagnostic
 * page, since deleted) against both physical printers on hand -- QPOS
 * EPM58UB and iWare/IW-J300H both expose the same ISSC/Microchip "UART over
 * BLE" service (a generic serial-bridge module apparently shared by both
 * vendors) and both print readable ESC/POS text through this exact
 * service/characteristic pair. Not guaranteed universal for every BLE
 * printer, but proven on the two units this project actually uses.
 */

export const BARISTA_PRINTER_SERVICE_UUID = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
export const BARISTA_PRINTER_CHARACTERISTIC_UUID = '49535343-8841-43f4-a8d4-ecbe34729bb3';

/**
 * BLE local-name prefix advertised by both current Kitchen and Barista label
 * printer units (confirmed via useBlePrinter.ts's requestDevice history).
 * Passing this to connect() as a namePrefix filter makes Chrome's device
 * chooser scan for only matching devices instead of every nearby BLE device
 * (acceptAllDevices), which is what made pairing feel heavy on lower-spec
 * tablets. Not guaranteed to match a future replacement unit -- that's what
 * the "Cari Semua Device" fallback (connect() with no options) is for.
 */
export const STATION_PRINTER_NAME_PREFIXES = ['RPP'];

/**
 * Conservative default for BLE writes without a negotiated larger MTU.
 * Left untouched during the 2026-09-01 speed tuning pass -- this is the one
 * proven-safe against real hardware (raising it risks the same kind of
 * silent data loss/corruption seen with the raster header that day), and
 * chunk count barely affects total time next to the per-chunk delay below.
 */
export const BLE_WRITE_CHUNK_SIZE = 20;

/**
 * Delay between chunked writes so the printer's BLE stack isn't overrun.
 * Lowered from 20ms 2026-09-01 to cut total transmission time on
 * multi-cup orders (proportional to chunk count) -- writeValueWithoutResponse
 * gives no flow-control feedback, so this still needs a physical print test
 * on both QPOS and iWare to confirm no dropped/corrupted bytes before
 * trusting it in production. Revert to 20 if either shows garbled output.
 */
export const BLE_WRITE_DELAY_MS = 8;
