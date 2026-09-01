/**
 * Minimal Web Bluetooth ambient types -- only the subset used by
 * useBaristaPrinter.ts. Not in lib.dom.d.ts; no @types/web-bluetooth
 * dependency added for this one file.
 */

interface BluetoothCharacteristicProperties {
  read: boolean;
  write: boolean;
  writeWithoutResponse: boolean;
  notify: boolean;
  indicate: boolean;
}

interface BluetoothRemoteGATTCharacteristic {
  uuid: string;
  properties: BluetoothCharacteristicProperties;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  writeValue(value: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTService {
  uuid: string;
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
}

interface RequestDeviceOptions {
  filters?: { services?: string[]; name?: string; namePrefix?: string }[];
  optionalServices?: string[];
  acceptAllDevices?: boolean;
}

interface Bluetooth {
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
  getDevices?(): Promise<BluetoothDevice[]>;
}

interface Navigator {
  bluetooth?: Bluetooth;
}
