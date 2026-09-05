// Minimal Web Bluetooth ambient types used by DigitalTwin. The browser pairing
// flow is optional (live OBD2 data is simulated), so a full @types/web-bluetooth
// dependency isn't justified — this declares just enough surface for the casts
// in the component. No runtime code; ambient globals merged with lib.dom.d.ts.

interface BluetoothDevice {
  id?: string;
  name?: string;
  gatt?: { connect(): Promise<unknown>; disconnect(): void };
}

interface RequestDeviceOptions {
  acceptAllDevices?: boolean;
  filters?: Array<{ name?: string; namePrefix?: string; services?: string[] }>;
  optionalServices?: string[];
}

interface Bluetooth {
  getAvailability(): Promise<boolean>;
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
}

interface Navigator {
  bluetooth?: Bluetooth;
}