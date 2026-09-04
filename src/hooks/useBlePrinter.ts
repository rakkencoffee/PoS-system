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
 * Web Bluetooth connection to a station's paired label printer (Barista or
 * Kitchen, both using the same QPOS/iWare printer family for now).
 * requestDevice() must be called from a real user click (BLE permission
 * requirement) -- that's what connect() is for. Once connected, writeBytes()
 * can be called freely from any event handler (Pusher callbacks included).
 */
export function useBlePrinter() {
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  const bindDevice = useCallback(async (device: BluetoothDevice) => {
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

  const connect = useCallback(async () => {
    if (!navigator.bluetooth) {
      throw new Error('Browser ini tidak mendukung Web Bluetooth. Pakai Chrome di Android.');
    }

    // Filtering by services: [UUID] would require the printer to advertise that
    // GATT service in its BLE advertisement packet -- confirmed via
    // src/app/debug/ble-test (since deleted) that neither the QPOS nor the
    // iWare unit does this, they only advertise their local name. A
    // namePrefix filter worked for the Kitchen/Barista iWare units (both
    // "RPP...") but a second iWare unit bought for kiosk receipts turned out
    // not to show up under that filter -- rather than guess at every
    // possible BLE local name, show every nearby BLE device and let staff
    // pick the right one by eye during pairing.
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [BARISTA_PRINTER_SERVICE_UUID],
    });

    await bindDevice(device);
  }, [bindDevice]);

  /**
   * Silently reconnect to a printer the browser already has permission for
   * (from a previous requestDevice() pairing) -- no picker, no click needed.
   * Chrome persists that permission per-origin, so this is what lets a kiosk
   * tablet come back online after a page reload/reboot without staff
   * touching the hidden pairing control again. Resolves to false (not an
   * error) if there's nothing to reconnect to yet, or the browser doesn't
   * support the persistent-permissions API (navigator.bluetooth.getDevices).
   */
  const tryAutoReconnect = useCallback(async () => {
    if (!navigator.bluetooth?.getDevices) return false;

    const devices = await navigator.bluetooth.getDevices();
    for (const device of devices) {
      try {
        await bindDevice(device);
        return true;
      } catch {
        // try the next previously-paired device, if any
      }
    }
    return false;
  }, [bindDevice]);

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

  return { connected, deviceName, connect, tryAutoReconnect, disconnect, writeBytes };
}
