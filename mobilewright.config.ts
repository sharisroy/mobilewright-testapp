import { defineConfig } from 'mobilewright';
import { execSync } from 'child_process';

// With both an emulator and a physical device connected, mobilewright otherwise
// picks the first online device (.at(0)), which is non-deterministic. Pin one:
//   1. MW_DEVICE_ID / ANDROID_SERIAL if set,
//   2. otherwise the first PHYSICAL device (its mobilecli id == its adb serial).
// The adb helpers in tests/advance/utiles.ts (getAdbSerial) resolve the SAME
// device, so the driver and raw adb calls always act on one device.
function resolveDeviceId(): string | undefined {
  if (process.env.MW_DEVICE_ID) return process.env.MW_DEVICE_ID;
  if (process.env.ANDROID_SERIAL) return process.env.ANDROID_SERIAL;
  try {
    const out = execSync('adb devices', { encoding: 'utf8' });
    const serials = out.split('\n')
      .filter(l => l.includes('\tdevice'))
      .map(l => l.split('\t')[0].trim());
    return serials.find(s => !s.startsWith('emulator-')); // undefined → let mobilewright choose
  } catch {
    return undefined;
  }
}

export default defineConfig({
  testDir: './tests',
  reporter: 'html',
  platform: 'android',
  timeout: 30_000,  // global locator + RPC timeout in ms — covers slow device and foreground cold-start
  deviceId: resolveDeviceId(),
});
