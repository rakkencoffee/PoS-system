'use client';

import { useCallback, useRef, useState } from 'react';
import {
  BARISTA_PRINTER_SERVICE_UUID,
  BARISTA_PRINTER_CHARACTERISTIC_UUID,
  BLE_WRITE_CHUNK_SIZE,
  BLE_WRITE_DELAY_MS,
} from '@/lib/print/ble-config';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Web Bluetooth connection to the barista's paired sticker printer.
 * requestDevice() must be called from a real user click (BLE permission
 * requirement) -- that's what connect() is for. Once connected, writeBytes()
 * can be called freely from any event handler (Pusher callbacks included).
 */
export function useBaristaPrinter() {
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  const connect = useCallback(async () => {
    if (!navigator.bluetooth) {
      throw new Error('Browser ini tidak mendukung Web Bluetooth. Pakai Chrome di Android.');
    }

    // Filtering by services: [UUID] would require the printer to advertise that
    // GATT service in its BLE advertisement packet -- confirmed via
    // src/app/debug/ble-test (since deleted) that neither the QPOS nor the
    // iWare unit does this, they only advertise their local name. Filter by
    // that name instead; optionalServices still grants access to the service
    // once connected.
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'RPP' }],
      optionalServices: [BARISTA_PRINTER_SERVICE_UUID],
    });

    const server = await device.gatt?.connect();
    if (!server) throw new Error('Gagal connect ke printer.');

    const service = await server.getPrimaryService(BARISTA_PRINTER_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(BARISTA_PRINTER_CHARACTERISTIC_UUID);

    characteristicRef.current = characteristic;
    setDeviceName(device.name || 'Printer');
    setConnected(true);

    device.addEventListener('gattserverdisconnected', () => {
      characteristicRef.current = null;
      setConnected(false);
    });
  }, []);

  const disconnect = useCallback(() => {
    characteristicRef.current = null;
    setConnected(false);
    setDeviceName(null);
  }, []);

  const writeBytes = useCallback(async (bytes: Uint8Array) => {
    const characteristic = characteristicRef.current;
    if (!characteristic) throw new Error('Printer belum connect.');

    for (let offset = 0; offset < bytes.length; offset += BLE_WRITE_CHUNK_SIZE) {
      const chunk = bytes.slice(offset, offset + BLE_WRITE_CHUNK_SIZE);
      await characteristic.writeValueWithoutResponse(chunk);
      await sleep(BLE_WRITE_DELAY_MS);
    }
  }, []);

  return { connected, deviceName, connect, disconnect, writeBytes };
}
