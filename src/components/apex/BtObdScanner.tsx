import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Bluetooth, BluetoothConnected, BluetoothOff, Loader2, RefreshCw,
  AlertTriangle, Gauge, Battery, Thermometer, Zap, Wind, Activity,
  TriangleAlert, Trash2, ScanLine, Cpu, Wifi, X,
} from "lucide-react";

// ============================================================
// Bluetooth OBD2 / ELM327 live diagnostics
// Uses the Web Bluetooth API to connect to an ELM327-style dongle,
// streams live PID data over GATT notifications, parses standard OBD2
// responses, renders gauges, reads & clears stored trouble codes.
// ============================================================

const SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
const CHAR_UUID = "0000fff2-0000-1000-8000-00805f9b34fb";

type ConnState = "idle" | "connecting" | "connected" | "error" | "unsupported";

interface LiveData {
  rpm: number | null;
  speed: number | null;        // km/h
  coolant: number | null;      // °C
  load: number | null;          // %
  voltage: number | null;       // V
  fuelPressure: number | null;  // kPa
  maf: number | null;           // g/s
}

const EMPTY: LiveData = {
  rpm: null, speed: null, coolant: null, load: null, voltage: null, fuelPressure: null, maf: null,
};

// DTC definitions — common sample (full lookup is large; codes still display raw)
const DTC_NAMES: Record<string, string> = {
  P0010: "Intake Camshaft Position Actuator Circuit (Bank 1)",
  P0011: "Camshaft Position A — Timing Over-Advanced (Bank 1)",
  P0012: "Camshaft Position A — Timing Over-Retarded (Bank 1)",
  P0014: "Exhaust Camshaft Position Actuator Circuit (Bank 1)",
  P0100: "Mass Air Flow Circuit Malfunction",
  P0101: "MAF Circuit Range/Performance",
  P0102: "MAF Circuit Low Input",
  P0103: "MAF Circuit High Input",
  P0106: "Manifold Absolute Pressure Circuit Range/Performance",
  P0115: "Engine Coolant Temperature Circuit Malfunction",
  P0116: "Engine Coolant Temperature Circuit Range/Performance",
  P0117: "Engine Coolant Temperature Circuit Low Input",
  P0118: "Engine Coolant Temperature Circuit High Input",
  P0120: "Throttle/Pedal Position Sensor A Circuit Malfunction",
  P0122: "Throttle Position Sensor A Circuit Low Input",
  P0123: "Throttle Position Sensor A Circuit High Input",
  P0128: "Coolant Thermostat Below Regulating Temperature",
  P0130: "O2 Sensor Circuit (Bank 1 Sensor 1)",
  P0131: "O2 Sensor Circuit Low Voltage (Bank 1 Sensor 1)",
  P0132: "O2 Sensor Circuit High Voltage (Bank 1 Sensor 1)",
  P0171: "System Too Lean (Bank 1)",
  P0172: "System Too Rich (Bank 1)",
  P0174: "System Too Lean (Bank 2)",
  P0200: "Injector Circuit Malfunction",
  P0230: "Fuel Pump Primary Circuit Malfunction",
  P0231: "Fuel Pump Secondary Circuit Low",
  P0232: "Fuel Pump Secondary Circuit High",
  P0300: "Random/Multiple Cylinder Misfire Detected",
  P0301: "Cylinder 1 Misfire Detected",
  P0302: "Cylinder 2 Misfire Detected",
  P0303: "Cylinder 3 Misfire Detected",
  P0304: "Cylinder 4 Misfire Detected",
  P0305: "Cylinder 5 Misfire Detected",
  P0306: "Cylinder 6 Misfire Detected",
  P0307: "Cylinder 7 Misfire Detected",
  P0308: "Cylinder 8 Misfire Detected",
  P0325: "Knock Sensor 1 Circuit (Bank 1)",
  P0335: "Crankshaft Position Sensor A Circuit Malfunction",
  P0336: "Crankshaft Position Sensor A Circuit Range/Performance",
  P0340: "Camshaft Position Sensor Circuit Malfunction",
  P0341: "Camshaft Position Sensor Circuit Range/Performance",
  P0400: "Exhaust Gas Recirculation Flow Malfunction",
  P0420: "Catalyst System Efficiency Below Threshold (Bank 1)",
  P0430: "Catalyst System Efficiency Below Threshold (Bank 2)",
  P0440: "Evaporative Emission Control System Malfunction",
  P0442: "EVAP Control System Leak Detected (small leak)",
  P0455: "EVAP Control System Leak Detected (gross leak)",
  P0462: "Fuel Level Sensor Circuit Low Input",
  P0480: "Cooling Fan 1 Control Circuit Malfunction",
  P0500: "Vehicle Speed Sensor A Malfunction",
  P0505: "Idle Air Control System Malfunction",
  P0506: "Idle Air Control System RPM Lower Than Expected",
  P0507: "Idle Air Control System RPM Higher Than Expected",
  P0562: "System Voltage Low",
  P0563: "System Voltage High",
  P0600: "Serial Communication Link Malfunction",
  P0601: "Internal Control Module Memory Check Sum Error",
  P0606: "PCM Processor Fault",
  P061B: "Internal Control Module Torque Sensor Performance",
  P2000: "NOx Trap Efficiency Below Threshold (Bank 1)",
  "U0001": "High Speed CAN Communication Bus",
  "U0073": "Control Module Communication Bus A Off",
  "U0100": "Lost Communication With ECM/PCM A",
  "U0101": "Lost Communication With TCM",
  "U0121": "Lost Communication With ABS Control Module",
  "U0140": "Lost Communication With Body Control Module",
  "U0151": "Lost Communication With Restraints Control Module",
  "U0155": "Lost Communication With Instrument Cluster",
};

// OBD2 PID definitions polled live.
interface PidDef {
  pid: string;     // 2-char hex
  key: keyof LiveData;
  label: string;
  unit: string;
  parse: (bytes: number[]) => number;
}
const LIVE_PIDS: PidDef[] = [
  { pid: "04", key: "load",          label: "Engine Load",      unit: "%",    parse: (b) => (b[0] * 100) / 255 },
  { pid: "05", key: "coolant",       label: "Coolant Temp",     unit: "°C",   parse: (b) => b[0] - 40 },
  { pid: "0C", key: "rpm",           label: "Engine RPM",       unit: "rpm",  parse: (b) => ((b[0] * 256) + b[1]) / 4 },
  { pid: "0D", key: "speed",         label: "Vehicle Speed",    unit: "km/h", parse: (b) => b[0] },
  { pid: "0A", key: "fuelPressure",  label: "Fuel Pressure",    unit: "kPa",  parse: (b) => b[0] * 3 },
  { pid: "10", key: "maf",           label: "MAF Airflow",      unit: "g/s",  parse: (b) => ((b[0] * 256) + b[1]) / 100 },
  { pid: "42", key: "voltage",       label: "Control Module V", unit: "V",    parse: (b) => ((b[0] * 256) + b[1]) / 1000 },
];

const PIDS_TO_SCAN = ["00", ...LIVE_PIDS.map((p) => p.pid)];

function descForCode(code: string): string {
  return DTC_NAMES[code] || "Unlisted code — see diagnostician for full description.";
}

// extract hex bytes from a raw OBD2 response string
function bytesFromResp(resp: string): number[] {
  const clean = resp.replace(/[\s>\r\n]/g, "").toUpperCase();
  const pairs = clean.match(/.{1,2}/g) || [];
  return pairs
    .filter((h) => /^[0-9A-F]{2}$/.test(h))
    .map((h) => parseInt(h, 16));
}

function parsePid(resp: string, pid: string): number[] | null {
  const all = bytesFromResp(resp);
  // find token sequence 41, pid
  for (let i = 0; i + 1 < all.length; i++) {
    if (all[i] === 0x41 && all[i + 1] === parseInt(pid, 16)) {
      return all.slice(i + 2);
    }
  }
  return null;
}

function parseDtcs(resp: string): string[] {
  const all = bytesFromResp(resp);
  let start = -1;
  for (let i = 0; i + 1 < all.length; i++) {
    if (all[i] === 0x43) { start = i + 1; break; }
  }
  if (start < 0) return [];
  const codes: string[] = [];
  const body = all.slice(start);
  for (let i = 0; i + 1 < body.length; i += 2) {
    const b1 = body[i];
    const b2 = body[i + 1];
    if (b1 === 0 && b2 === 0) continue; // not set
    const letters = ["P", "C", "B", "U"];
    const first = (b1 >> 6) & 0x3;
    const d1 = (b1 >> 4) & 0x3;
    const d2 = b1 & 0x0f;
    const d3 = (b2 >> 4) & 0x0f;
    const d4 = b2 & 0x0f;
    codes.push(
      `${letters[first]}${d1}${d2.toString(16).toUpperCase()}${d3.toString(16).toUpperCase()}${d4.toString(16).toUpperCase()}`,
    );
  }
  return codes;
}

function parseSupportedPids(resp: string): number[] {
  const bytes = parsePid(resp, "00");
  if (!bytes || bytes.length < 4) return [];
  let bits = 0;
  for (let k = 0; k < 4; k++) bits = (bits << 8) | (bytes[k] & 0xff);
  const supported: number[] = [];
  for (let p = 1; p <= 32; p++) {
    if (bits & (1 << (31 - (p - 1)))) supported.push(p);
  }
  return supported;
}

export default function BtObdScanner() {
  const [conn, setConn] = useState<ConnState>("idle");
  const [err, setErr] = useState<string>("");
  const [deviceName, setDeviceName] = useState<string>("");
  const [live, setLive] = useState<LiveData>(EMPTY);
  const [dtcs, setDtcs] = useState<string[]>([]);
  const [supported, setSupported] = useState<number[]>([]);
  const [scanning, setScanning] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);
  const [readingCodes, setReadingCodes] = useState<boolean>(false);

  const deviceRef = useRef<any>(null);
  const serverRef = useRef<any>(null);
  const writeChRef = useRef<any>(null);
  const notifyChRef = useRef<any>(null);
  const bufRef = useRef<string>("");
  const pendingRef = useRef<{ resolve: ((v: string) => void) | null; timer: number | null }>({
    resolve: null,
    timer: null,
  });
  const pollRef = useRef<boolean>(false);
  const autoTimer = useRef<number | null>(null);

  const supportedRef = useRef<boolean>(false);
  useEffect(() => {
    supportedRef.current =
      typeof navigator !== "undefined" && !!(navigator as any).bluetooth;
    if (!supportedRef.current) {
      setConn("unsupported");
      setErr("Bluetooth OBD2 requires Chrome or Edge. Open this page in Chrome to connect your dongle.");
    }
  }, []);

  // ----- GATT notification accumulator -----
  const onNotify = useCallback((e: any) => {
    const dec = new TextDecoder();
    bufRef.current += dec.decode(e.target.value);
    // ELM327 signals command completion with a '>' prompt
    if (bufRef.current.includes(">") && pendingRef.current.resolve) {
      const res = bufRef.current;
      const r = pendingRef.current.resolve;
      if (pendingRef.current.timer) window.clearTimeout(pendingRef.current.timer);
      pendingRef.current.resolve = null;
      pendingRef.current.timer = null;
      bufRef.current = "";
      r(res);
    }
  }, []);

  const sendOBD = useCallback(async (cmd: string): Promise<string> => {
    const ch = writeChRef.current;
    if (!ch) throw new Error("Dongle not connected.");
    bufRef.current = "";
    const p = new Promise<string>((resolve) => {
      pendingRef.current = {
        resolve,
        timer: window.setTimeout(() => {
          const res = bufRef.current;
          bufRef.current = "";
          pendingRef.current.resolve = null;
          pendingRef.current.timer = null;
          resolve(res);
        }, 3500),
      };
    });
    const enc = new TextEncoder().encode(cmd + "\r");
    const chAny = ch as any;
    try {
      if (chAny.writeValueWithoutResponse) await chAny.writeValueWithoutResponse(enc);
      else if (chAny.writeValue) await chAny.writeValue(enc);
      else await chAny.writeValueWithResponse(enc);
    } catch {
      // some clones reject writeValue on a notify-only characteristic → ignore
    }
    return p;
  }, []);

  // ----- connect -----
  const connect = useCallback(async () => {
    if (!supportedRef.current) return;
    setConn("connecting");
    setErr("");
    try {
      const bt = (navigator as any).bluetooth;
      const device = await bt.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });
      device.addEventListener("gattserverdisconnected", onDisconnected);
      deviceRef.current = device;
      setDeviceName(device.name || "ELM327 Dongle");

      const server = await device.gatt.connect();
      serverRef.current = server;
      const service = await server.getPrimaryService(SERVICE_UUID);
      const chars = await service.getCharacteristics();

      // prefer the canonical fff2 characteristic; otherwise pick by property
      let writeCh =
        chars.find((c: any) => c.uuid === CHAR_UUID) ||
        chars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse) ||
        chars.find((c: any) => c.properties.writeWithoutResponse) ||
        chars[0];
      let notifyCh =
        chars.find((c: any) => c.uuid === CHAR_UUID) ||
        chars.find((c: any) => c.properties.notify) ||
        writeCh;

      writeChRef.current = writeCh;
      notifyChRef.current = notifyCh;

      if (notifyCh && notifyCh.properties?.notify) {
        notifyCh.addEventListener("characteristicvaluechanged", onNotify);
        try { await notifyCh.startNotifications(); } catch { /* ignore */ }
      }

      // init ELM327: reset, disable echo, linefeeds off, headers off, select protocol auto
      await sendOBD("ATZ");
      await sendOBD("ATE0");
      await sendOBD("ATL0");
      await sendOBD("ATS0");
      await sendOBD("ATH0");
      await sendOBD("ATSP0");

      setConn("connected");

      // read supported PIDs once
      const sup = parseSupportedPids(await sendOBD("0100"));
      setSupported(sup);

      // start live polling
      pollRef.current = true;
      startPoll();
      // read stored codes
      void readCodes();
    } catch (e: any) {
      const name = e?.name || "";
      if (name === "NotFoundError") {
        setErr("No device selected or dongle not found. Make sure the ELM327/OBD2 dongle is powered and paired.");
      } else if (name === "SecurityError" || name === "NotAllowedError") {
        setErr("Bluetooth permission denied. Enable Bluetooth access for this site and retry.");
      } else {
        setErr(e?.message || "Could not connect to the dongle.");
      }
      setConn("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendOBD]);

  function onDisconnected() {
    setConn("error");
    setErr("Dongle disconnected.");
    pollRef.current = false;
    if (autoTimer.current) window.clearTimeout(autoTimer.current);
    // auto-reconnect once
    setConn((c) => c);
    if (deviceRef.current && deviceRef.current.gatt?.connected === false) {
      deviceRef.current.gatt.connect().then(() => {
        setConn("connected");
        pollRef.current = true;
        startPoll();
      }).catch(() => setConn("error"));
    }
  }

  const startPoll = useCallback(() => {
    if (autoTimer.current) window.clearTimeout(autoTimer.current);
    const tick = async () => {
      if (!pollRef.current) return;
      const data: LiveData = { ...EMPTY };
      for (const p of LIVE_PIDS) {
        try {
          const resp = await sendOBD("01" + p.pid);
          const bytes = parsePid(resp, p.pid);
          if (bytes && bytes.length) data[p.key] = p.parse(bytes);
        } catch { /* keep going */ }
      }
      setLive(data);
      if (pollRef.current) autoTimer.current = window.setTimeout(tick, 1500);
    };
    void tick();
  }, [sendOBD]);

  const readCodes = useCallback(async () => {
    if (conn !== "connected" && conn !== "connecting" && deviceRef.current) return;
    setReadingCodes(true);
    try {
      const resp = await sendOBD("03");
      const codes = parseDtcs(resp);
      setDtcs(codes);
    } catch { /* ignore */ } finally {
      setReadingCodes(false);
    }
  }, [sendOBD, conn]);

  const clearCodes = useCallback(async () => {
    setClearing(true);
    try {
      await sendOBD("04");
      setDtcs([]);
    } catch { /* ignore */ } finally {
      setClearing(false);
    }
  }, [sendOBD]);

  const toggleScan = () => {
    if (scanning) {
      pollRef.current = false;
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
      setScanning(false);
    } else {
      pollRef.current = true;
      startPoll();
      setScanning(true);
    }
  };

  const disconnect = () => {
    pollRef.current = false;
    if (autoTimer.current) window.clearTimeout(autoTimer.current);
    try {
      if (notifyChRef.current) notifyChRef.current.removeEventListener?.("characteristicvaluechanged", onNotify);
    } catch { /* ignore */ }
    try { serverRef.current?.disconnect?.(); } catch { /* ignore */ }
    setConn("idle");
    setLive(EMPTY);
    setDtcs([]);
    setSupported([]);
    setDeviceName("");
  };

  useEffect(() => () => {
    pollRef.current = false;
    if (autoTimer.current) window.clearTimeout(autoTimer.current);
    try { serverRef.current?.disconnect?.(); } catch { /* ignore */ }
  }, []);

  const temp = live.coolant;
  const tempColor =
    temp == null ? "#6b7280" : temp < 90 ? "#22c55e" : temp < 105 ? "#eab308" : "#ef4444";
  const rpmPct = live.rpm != null ? (live.rpm / 8000) * 100 : 0;
  const spdPct = live.speed != null ? (live.speed / 120) * 100 : 0;

  return (
    <section className="relative bg-titanium border-t border-cyan/10">
      <div className="circuit-grid absolute inset-0 opacity-20 pointer-events-none" />
      <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 py-12">
        {/* ===== header / connection bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Bluetooth className="w-5 h-5 text-cyan" />
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// Live OBD2 Telemetry</span>
          </div>
          <div className="flex items-center gap-2">
            <ConnPill state={conn} />
            {conn === "connected" && (
              <button onClick={disconnect} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase px-3 py-2 border border-heat/40 text-heat hover:bg-heat hover:text-titanium">
                <BluetoothOff className="w-3.5 h-3.5" /> Disconnect
              </button>
            )}
          </div>
        </div>

        {deviceName && (
          <div className="font-mono text-[11px] text-cyan/70 mb-4">
            // {deviceName} {supported.length ? `· ${supported.length} PIDs available` : ""}
          </div>
        )}

        {/* ===== unsupported / error notices */}
        {conn === "unsupported" && (
          <div className="border border-heat/30 bg-heat/5 p-6 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-8 h-8 text-heat" />
            <p className="font-mono text-xs text-heat max-w-lg leading-relaxed">{err}</p>
            <Link to="/contact" className="font-mono text-[10px] uppercase tracking-wider text-cyan/70 hover:text-cyan underline underline-offset-4">Book a live diagnostic instead</Link>
          </div>
        )}

        {conn === "error" && (
          <div className="border border-heat/30 bg-heat/5 p-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
            <AlertTriangle className="w-8 h-8 text-heat shrink-0" />
            <p className="font-mono text-xs text-heat max-w-lg leading-relaxed">{err}</p>
            <button onClick={connect} className="inline-flex items-center gap-2 border border-cyan/40 text-cyan font-mono text-xs uppercase px-5 py-3 hover:bg-cyan hover:text-titanium shrink-0">
              <RefreshCw className="w-3.5 h-3.5" /> Scan for Dongle
            </button>
          </div>
        )}

        {/* ===== idle / connect prompt */}
        {conn === "idle" && (
          <div className="border border-cyan/20 bg-blueprint/30 p-8 text-center">
            <Bluetooth className="w-10 h-10 text-cyan mx-auto mb-4" />
            <h3 className="font-heading text-2xl uppercase text-data mb-2">Connect Your OBD2 Dongle</h3>
            <p className="font-body text-sm text-muted-foreground max-w-xl mx-auto mb-6">
              Pair an ELM327-style Bluetooth OBD2 dongle to read live engine telemetry — RPM,
              speed, coolant temp, battery voltage, engine load, fuel pressure, MAF airflow
              and stored trouble codes. Works in Chrome, Edge & Safari.
            </p>
            <button onClick={connect} className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase px-6 py-3 hover:glow-cyan">
              <ScanLine className="w-4 h-4" /> Scan for Dongle
            </button>
            <p className="font-mono text-[10px] uppercase tracking-wider text-cyan/40 mt-4">
              // tip: turn the dongle on & keep the ignition in the ON position
            </p>
          </div>
        )}

        {/* ===== connecting */}
        {conn === "connecting" && (
          <div className="border border-cyan/20 bg-blueprint/30 p-12 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-cyan animate-spin" />
            <span className="font-mono text-xs uppercase tracking-widest text-cyan/70">Establishing GATT link…</span>
          </div>
        )}

        {/* ===== connected dashboard */}
        {conn === "connected" && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <button onClick={toggleScan} className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase px-3 py-2 border ${scanning ? "border-cyan text-cyan bg-cyan/10" : "border-cyan/30 text-muted-foreground"}`}>
                <Activity className="w-3.5 h-3.5" /> {scanning ? "Pausing" : "Live Scan"}
              </button>
              <button onClick={readCodes} disabled={readingCodes} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase px-3 py-2 border border-cyan/40 text-cyan hover:bg-cyan hover:text-titanium disabled:opacity-40">
                {readingCodes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />} Read Codes
              </button>
              <button onClick={clearCodes} disabled={clearing} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase px-3 py-2 border border-heat/40 text-heat hover:bg-heat hover:text-titanium disabled:opacity-40">
                {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Clear Codes
              </button>
            </div>

            {/* gauges grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ArcGauge
                icon={<Gauge className="w-4 h-4" />} label="Engine RPM" value={live.rpm ?? 0} max={8000} unit="rpm"
                color={rpmPct > 90 ? "#ef4444" : rpmPct > 70 ? "#eab308" : "#00e5ff"}
              />
              <ArcGauge
                icon={<Activity className="w-4 h-4" />} label="Speed" value={live.speed ?? 0} max={120} unit="km/h" color="#00e5ff"
              />
              <Tile icon={<Battery className="w-4 h-4" />} label="Control Module Voltage" value={live.voltage} unit="V" color={live.voltage != null && (live.voltage < 11.5 || live.voltage > 14.8) ? "#eab308" : "#22c55e"} />
              <Tile icon={<Zap className="w-4 h-4" />} label="Engine Load" value={live.load} unit="%" max={100} color={live.load != null && live.load > 85 ? "#eab308" : "#00e5ff"} />
              <Tile icon={<Thermometer className="w-4 h-4" />} label="Coolant Temp" value={live.coolant} unit="°C" color={tempColor} warn={temp != null && temp >= 105} />
              <Tile icon={<Wind className="w-4 h-4" />} label="MAF Airflow" value={live.maf} unit="g/s" color="#22c55e" />
              <Tile icon={<Gauge className="w-4 h-4" />} label="Fuel Pressure" value={live.fuelPressure} unit="kPa" color="#00e5ff" />

              <div className="border border-cyan/20 bg-blueprint/30 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-cyan"><Wifi className="w-4 h-4" /><span className="font-mono text-[10px] uppercase tracking-wider">Bus Status</span></div>
                <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                  {supported.length ? `${supported.length} mode-01 PIDs supported by this ECU.` : "Reading PID support…"}
                </div>
                <div className="font-mono text-[10px] text-cyan/60">link · {deviceName || "ELM327"}</div>
              </div>
            </div>

            {/* DTC list */}
            <div className="mt-6 border border-cyan/20 bg-blueprint/30 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-heat">
                  <TriangleAlert className="w-4 h-4" />
                  <span className="font-mono text-xs uppercase tracking-wider">Stored Trouble Codes</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{dtcs.length} stored</span>
              </div>
              {readingCodes && (
                <div className="flex items-center gap-2 font-mono text-xs text-cyan/70"><Loader2 className="w-3.5 h-3.5 animate-spin" /> reading codes…</div>
              )}
              {!readingCodes && dtcs.length === 0 && (
                <div className="flex items-center gap-2 font-mono text-xs text-cyan/70">
                  <X className="w-3.5 h-3.5" /> No stored codes — system nominal.
                </div>
              )}
              {dtcs.length > 0 && (
                <ul className="space-y-2">
                  {dtcs.map((c) => (
                    <li key={c} className="border border-heat/30 bg-heat/5 p-3 flex items-start gap-3">
                      <span className="font-mono text-sm font-bold text-heat shrink-0">{c}</span>
                      <span className="font-body text-xs text-data/80">{descForCode(c)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {dtcs.length > 0 && (
                <button onClick={clearCodes} disabled={clearing} className="mt-4 inline-flex items-center gap-1.5 bg-heat text-titanium font-mono text-xs uppercase px-5 py-2.5 hover:glow-heat disabled:opacity-50">
                  {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Clear All Codes
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ============================================================
// Arc gauge (270° SVG)
// ============================================================
function ArcGauge({
  icon, label, value, max, unit, color,
}: {
  icon: React.ReactNode; label: string; value: number; max: number; unit: string; color: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const R = 70;
  const C = 2 * Math.PI * R;
  const arcLen = C * 0.75; // 270°
  const dash = pct * arcLen;
  return (
    <div className="border border-cyan/20 bg-blueprint/30 p-4 flex flex-col items-center">
      <div className="flex items-center gap-2 text-cyan mb-2 self-start">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <svg viewBox="0 0 180 180" className="w-full max-w-[180px]">
        <path d="M 30 150 A 70 70 0 1 1 150 150" fill="none" stroke="rgba(0,229,255,0.12)" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M 30 150 A 70 70 0 1 1 150 150"
          fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`} style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: "stroke-dasharray 0.4s ease-out" }}
        />
      </svg>
      <div className="-mt-6 text-center">
        <div className="font-heading text-2xl text-data tabular-nums">{value.toFixed(0)}</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{unit}</div>
      </div>
    </div>
  );
}

// ============================================================
// Stat tile
// ============================================================
function Tile({
  icon, label, value, unit, color, warn, max,
}: {
  icon: React.ReactNode; label: string; value: number | null; unit: string; color: string; warn?: boolean; max?: number;
}) {
  return (
    <div className={`border p-4 ${warn ? "border-heat/50 bg-heat/5" : "border-cyan/20 bg-blueprint/30"}`}>
      <div className="flex items-center gap-2 mb-3" style={{ color }}>
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-heading text-3xl text-data tabular-nums">{value == null ? "--" : value.toFixed(value < 10 && unit !== "%" ? 1 : 0)}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{unit}</span>
      </div>
      {max != null && (
        <div className="mt-3 h-1.5 bg-cyan/10 overflow-hidden">
          <div className="h-full transition-all duration-300" style={{ width: `${Math.min(100, ((value ?? 0) / max) * 100)}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Connection pill
// ============================================================
function ConnPill({ state }: { state: ConnState }) {
  const map: Record<ConnState, { text: string; color: string; icon: React.ReactNode }> = {
    idle: { text: "Disconnected", color: "#6b7280", icon: <BluetoothOff className="w-3 h-3" /> },
    connecting: { text: "Connecting…", color: "#eab308", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    connected: { text: "Connected", color: "#22c55e", icon: <BluetoothConnected className="w-3 h-3" /> },
    error: { text: "Disconnected", color: "#ef4444", icon: <BluetoothOff className="w-3 h-3" /> },
    unsupported: { text: "Unsupported", color: "#ef4444", icon: <BluetoothOff className="w-3 h-3" /> },
  };
  const s = map[state];
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-3 py-2 border" style={{ color: s.color, borderColor: `${s.color}55` }}>
      {s.icon} {s.text}
    </span>
  );
}