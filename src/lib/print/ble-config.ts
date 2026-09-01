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

/** Conservative default for BLE writes without a negotiated larger MTU; tune once real hardware is available. */
export const BLE_WRITE_CHUNK_SIZE = 20;

/** Delay between chunked writes so the printer's BLE stack isn't overrun. */
export const BLE_WRITE_DELAY_MS = 20;
