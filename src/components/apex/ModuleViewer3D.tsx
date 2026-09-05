import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ChevronRight, MousePointerClick, Layers, GitCompareArrows, Zap, Scan } from "lucide-react";
import { Link } from "react-router-dom";
import { matchEcm, FAULT_COLOR, type FaultPin } from "@/lib/ecmCatalog";
import { hasWebGL } from "@/lib/webgl";

interface Props {
  year?: string;
  make?: string;
  model?: string;
  vin?: string;
  faults?: FaultPin[];
}

type ViewId = "default" | "top" | "bottom" | "side" | "connector";

const VIEWS: Record<ViewId, { pos: [number, number, number]; target: [number, number, number] }> = {
  default: { pos: [3.6, 2.6, 4.6], target: [0, 0.2, 0] },
  top: { pos: [0.1, 5.2, 0.6], target: [0, 0.2, 0] },
  bottom: { pos: [0.1, -4.6, 1.4], target: [0, 0, 0] },
  side: { pos: [5.4, 0.6, 0.2], target: [0, 0.2, 0] },
  connector: { pos: [0.2, 0.4, 5.2], target: [0, 0.2, 0] },
};

const HOTSPOTS = [
  {
    id: "connector",
    label: "Connector Pins",
    title: "Harness connector & pin map",
    text: "Sealed multi-way connector carrying CAN-High/Low, LIN, K-Line, power and ground to the harness. Pin mapping is vehicle-specific — we cross-reference the factory pinout before cloning or re-flashing.",
  },
  {
    id: "board",
    label: "Circuit Board",
    title: "Internal PCB — component map",
    text: "32-bit MCU, EEPROM/Flash memory cell, and the CAN transceiver sit on a green FR4 substrate under the heatsink. We read the EEPROM directly when the bus is locked or the MCU won't boot.",
  },
  {
    id: "housing",
    label: "Housing & Part #",
    title: "Aluminium housing / ECU identification",
    text: "Cast aluminium housing doubles as EMI shield and heatsink. The OEM part number label on top ties this exact module to a factory application — we match it before sourcing a donor.",
  },
];

export default function ModuleViewer3D({ year, make, model, vin, faults }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<{
    renderer?: THREE.WebGLRenderer;
    camera?: THREE.PerspectiveCamera;
    scene?: THREE.Scene;
    ecm?: THREE.Group;
    lid?: THREE.Group;
    comp?: THREE.Group;
    pins?: THREE.Mesh[];
    hotspots?: THREE.Object3D[];
    setView?: (v: ViewId) => void;
    setExplode?: (on: boolean) => void;
    setCompare?: (on: boolean) => void;
    targetZoom?: number;
  }>({});
  const [active, setActive] = useState<(typeof HOTSPOTS)[number] | null>(null);
  const [view, setView] = useState<ViewId>("default");
  const [exploded, setExploded] = useState(false);
  const [compare, setCompare] = useState(false);
  const [noWebGL, setNoWebGL] = useState(false);
  const [xray, setXray] = useState(false);
  const aluMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const plasticMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const ecm = matchEcm(year, make, model, vin);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const mountEl: HTMLDivElement = mount;
    const width = mountEl.clientWidth || 600;
    const height = 440;
    if (!hasWebGL()) { setNoWebGL(true); return; }
    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(...VIEWS.default.pos);
    camera.lookAt(...VIEWS.default.target);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(6, 9, 7);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x66ccff, 0.6);
    fill.position.set(-7, 4, -4);
    scene.add(fill);
    const rim = new THREE.PointLight(0x00e5ff, 0.6, 30);
    rim.position.set(-3, 3, -4);
    scene.add(rim);
    const heat = new THREE.PointLight(0xff3e00, 0.4, 18);
    heat.position.set(3, 0.5, 2);
    scene.add(heat);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setNoWebGL(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    try {
      mountEl.appendChild(renderer.domElement);
    } catch {
      setNoWebGL(true);
      renderer.dispose();
      return;
    }

    // ---- image-based lighting: RoomEnvironment gives realistic metal & plastic reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    // ---- materials (PBR: clearcoat housing, reflective metals & solder)
    const alu = new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, metalness: 0.1, roughness: 0.7, envMapIntensity: 1.0, transparent: true, opacity: 1 });
    aluMatRef.current = alu;
    const aluDark = new THREE.MeshStandardMaterial({ color: 0x8a8f95, metalness: 0.9, roughness: 0.5, envMapIntensity: 1.1 });
    const plastic = new THREE.MeshPhysicalMaterial({ color: 0x121416, roughness: 0.55, metalness: 0.2, envMapIntensity: 1.0, transparent: true, opacity: 1 });
    plasticMatRef.current = plastic;
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1.0, roughness: 0.2, emissive: 0x3a2a00, emissiveIntensity: 0.25, envMapIntensity: 1.6 });
    const pcbGreen = new THREE.MeshStandardMaterial({ color: 0x0a5c0a, roughness: 0.6, metalness: 0.3, envMapIntensity: 1.0 });
    const chipDark = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.4, metalness: 0.5, envMapIntensity: 1.0 });
    const silk = new THREE.MeshStandardMaterial({ color: 0xd6d8b0, roughness: 0.7, metalness: 0.0 });
    const led = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.4 });
    const trace = new THREE.MeshStandardMaterial({ color: 0xc9a227, emissive: 0x3a2a00, emissiveIntensity: 0.3, roughness: 0.45, metalness: 0.7 });

    // ---- ECM group (user module)
    const ecmGroup = new THREE.Group();
    scene.add(ecmGroup);

    // housing base + label
    const lidGroup = new THREE.Group();
    ecmGroup.add(lidGroup);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.7), alu);
    housing.position.set(0, 0.5, 0);
    lidGroup.add(housing);
    // torx-style screw heads at the 4 corners (real module fasteners)
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x4a4e52, metalness: 1.0, roughness: 0.35, envMapIntensity: 1.2 });
    ([[-1.45, -0.7], [1.45, -0.7], [-1.45, 0.7], [1.45, 0.7]] as [number, number][]).forEach(([sx, sz]) => {
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), screwMat);
      sc.position.set(sx, 0.96, sz); lidGroup.add(sc);
      for (let k = 0; k < 6; k++) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 6), new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.8, roughness: 0.4 }));
        pin.position.set(sx + 0.03 * Math.cos((k / 6) * Math.PI * 2), 0.99, sz + 0.03 * Math.sin((k / 6) * Math.PI * 2));
        lidGroup.add(pin);
      }
    });
    // heatsink fins
    for (let i = -2; i <= 2; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 1.6), aluDark);
      fin.position.set(i * 0.5, 1.04, 0);
      lidGroup.add(fin);
    }
    // label plate with part number
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 1024; labelCanvas.height = 256;
    const lctx = labelCanvas.getContext("2d")!;
    lctx.fillStyle = "#9aa0a6"; lctx.fillRect(0, 0, 1024, 256);
    lctx.fillStyle = "#1a1c1e"; lctx.font = "bold 96px JetBrains Mono, monospace";
    lctx.fillText(ecm.partNumber, 40, 110);
    lctx.fillStyle = "#4a4e54"; lctx.font = "48px Inter, sans-serif";
    lctx.fillText(ecm.manufacturer, 40, 190);
    lctx.fillText(ecm.application.slice(0, 26), 40, 240);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    labelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const labelMat = new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.55, metalness: 0.3 });
    const label = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.6), labelMat);
    label.position.set(0, 1.12, 0.5);
    lidGroup.add(label);
    (lidGroup.userData as any).openY = 0.9;

    // concealed PCB (revealed on explode)
    const compGroup = new THREE.Group();
    ecmGroup.add(compGroup);
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 1.5), pcbGreen);
    pcb.position.set(0, 0.05, 0);
    compGroup.add(pcb);
    const silkTop = new THREE.Mesh(new THREE.BoxGeometry(2.92, 0.012, 1.42), silk);
    silkTop.position.set(0, 0.12, 0);
    compGroup.add(silkTop);
    // main MCU
    const mcu = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.9), chipDark);
    mcu.position.set(0, 0.2, 0);
    compGroup.add(mcu);
    // silver QFP-style legs around the MCU (real chip-package look)
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1.0, roughness: 0.3, envMapIntensity: 1.2 });
    const legGeo = new THREE.BoxGeometry(0.05, 0.035, 0.09);
    for (let s = 0; s < 9; s++) {
      [0.46, -0.46].forEach((sx) => { const lg = new THREE.Mesh(legGeo, silverMat); lg.position.set(sx, 0.2, -0.36 + s * 0.09); lg.rotation.y = Math.PI / 2; compGroup.add(lg); });
      [0.46, -0.46].forEach((sz) => { const lg = new THREE.Mesh(legGeo, silverMat); lg.position.set(-0.36 + s * 0.09, 0.2, sz); compGroup.add(lg); });
    }
    // EEPROM + flash
    const eeprom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), chipDark);
    eeprom.position.set(-1.05, 0.16, -0.35);
    compGroup.add(eeprom);
    const flash = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.46), chipDark);
    flash.position.set(1.05, 0.15, -0.35);
    compGroup.add(flash);
    // caps
    ([[-1.1, 0.55], [1.1, 0.55], [0.6, -0.55]] as [number, number][]).forEach(([x, z]) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 18), plastic);
      c.position.set(x, 0.22, z);
      compGroup.add(c);
    });
    // traces
    const addTrace = (x: number, z: number, w: number, d: number) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), trace);
      t.position.set(x, 0.13, z);
      compGroup.add(t);
    };
    addTrace(-0.5, 0.3, 1.6, 0.03);
    addTrace(0.5, -0.3, 1.6, 0.03);
    addTrace(0.0, 0.0, 0.04, 1.0);
    // status LED
    const ledMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 14), led);
    ledMesh.position.set(1.3, 0.15, 0.55);
    compGroup.add(ledMesh);

    // ---- connector end (front -z)
    const connBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.55), plastic);
    connBody.position.set(0, 0.5, -1.05);
    ecmGroup.add(connBody);
    // gold pins grid (carries the 6 bus lines we visualize)
    const pins: THREE.Mesh[] = [];
    const pinRows = 3;
    const pinCols = 8;
    for (let r = 0; r < pinRows; r++) {
      for (let c = 0; c < pinCols; c++) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 12), gold);
        pin.rotation.x = Math.PI / 2;
        pin.position.set(-0.7 + c * 0.2, 0.28 + r * 0.24, -1.32);
        pins.push(pin);
        ecmGroup.add(pin);
      }
    }

    // ---- replacement ECM (compare mode) — offset, cleaner tint + part "-NEW"
    const compEcm = ecmGroup.clone(true) as THREE.Group;
    compEcm.position.set(5.0, 0, 0);
    compEcm.visible = false;
    // recolor a label marker visually via a small floating tag (kept light)
    scene.add(compEcm);

    // ---- hotspots (clickable spheres)
    const spotMat = new THREE.MeshBasicMaterial({ color: 0xff3e00, transparent: true, opacity: 0.9 });
    const spotDefs = [
      { id: "connector", pos: new THREE.Vector3(0, 0.9, -1.4) },
      { id: "board", pos: new THREE.Vector3(0, 0.45, 0.7) },
      { id: "housing", pos: new THREE.Vector3(1.3, 0.95, 0.6) },
    ];
    const hotspots: THREE.Object3D[] = [];
    spotDefs.forEach((s) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 18), spotMat.clone());
      m.position.copy(s.pos);
      (m.userData as any).id = s.id;
      ecmGroup.add(m);
      hotspots.push(m);
    });

    // ---- interaction: raycast click
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hotspots, false);
      if (hits.length) {
        const id = (hits[0].object.userData as any).id;
        setActive(HOTSPOTS.find((h) => h.id === id) ?? null);
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    // ---- drag rotate + wheel/pinch zoom
    let rotY = 0, rotX = 0.15, dragging = false, lastX = 0, lastY = 0, auto = true;
    const down = (e: PointerEvent) => { dragging = true; auto = false; lastX = e.clientX; lastY = e.clientY; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      rotY += (e.clientX - lastX) * 0.01;
      rotX += (e.clientY - lastY) * 0.008;
      rotX = Math.max(-1.1, Math.min(1.1, rotX));
      lastX = e.clientX; lastY = e.clientY;
    };
    const up = () => { dragging = false; setTimeout(() => (auto = true), 2800); };
    renderer.domElement.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoomRef.current = Math.max(3.4, Math.min(11, zoomRef.current + e.deltaY * 0.003)); };
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    const zoomRef = { current: camera.position.length() };
    // pinch
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;
    const pdown = (e: PointerEvent) => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.size === 2) { const a = [...pointers.values()]; pinchDist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); } };
    const pupdate = (e: PointerEvent) => { if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.size === 2) { const a = [...pointers.values()]; const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (pinchDist) zoomRef.current = Math.max(3.4, Math.min(11, zoomRef.current * (pinchDist / d))); pinchDist = d; } };
    const pup = (e: PointerEvent) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinchDist = 0; };
    renderer.domElement.addEventListener("pointerdown", pdown);
    renderer.domElement.addEventListener("pointermove", pupdate);
    renderer.domElement.addEventListener("pointerup", pup);

    // ---- view controller (smooth tween toward target)
    const target = { pos: new THREE.Vector3(...VIEWS.default.pos), look: new THREE.Vector3(...VIEWS.default.target) };
    const cur = { pos: camera.position.clone(), look: new THREE.Vector3(...VIEWS.default.target) };
    const applyView = (v: ViewId) => { target.pos.set(...VIEWS[v].pos); target.look.set(...VIEWS[v].target); };
    const applyExplode = (on: boolean) => { (lidGroup.userData as any).open = on; };
    const applyCompare = (on: boolean) => { compEcm.visible = on; if (on) { target.pos.set(4.0, 2.2, 5.4); target.look.set(on ? 2.4 : 0, 0.2, 0); } else { applyView(view); } };

    // ---- render loop
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (auto) rotY += 0.004;
      ecmGroup.rotation.y = rotY;
      ecmGroup.rotation.x = rotX;
      const t = performance.now() * 0.004;
      hotspots.forEach((h, i) => (h as THREE.Mesh).scale.setScalar(1 + 0.18 * Math.sin(t + i)));
      // explode lift
      const open = (lidGroup.userData as any).open ? 1 : 0;
      lidGroup.position.y += ((open * 1.4) - lidGroup.position.y) * 0.12;
      compGroup.position.y += (open * 0.0 - compGroup.position.y) * 0.12;
      // compare clone mirrors rotation
      compEcm.rotation.y = rotY; compEcm.rotation.x = rotX;
      compEcm.position.y = 0;
      // camera tween + zoom
      cur.pos.lerp(target.pos, 0.1);
      cur.look.lerp(target.look, 0.1);
      const baseDir = new THREE.Vector3().subVectors(cur.pos, cur.look).normalize();
      const desired = baseDir.multiplyScalar(zoomRef.current);
      camera.position.copy(cur.look).add(desired);
      camera.lookAt(cur.look);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mountEl.clientWidth || 600;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener("resize", onResize);

    // apply diagnostic fault highlight to pins (6 bus lines mapped across the pin grid)
    const applyFaults = (f?: FaultPin[]) => {
      if (!f || !pins.length) return;
      pins.forEach((p) => {
        const mat = (p.material as THREE.MeshStandardMaterial).clone();
        p.material = mat;
      });
      const lines = 6;
      const perLine = Math.floor(pins.length / lines);
      f.forEach((fault, idx) => {
        if (idx >= lines) return;
        const color = new THREE.Color(FAULT_COLOR[fault.status] || "#22c55e");
        const emissive = fault.status === "broken" || fault.status === "short" || fault.status === "dead";
        for (let k = 0; k < perLine; k++) {
          const p = pins[idx * perLine + k];
          const mat = p.material as THREE.MeshStandardMaterial;
          mat.color.copy(color);
          if (emissive) { mat.emissive.copy(color); mat.emissiveIntensity = 0.6; }
        }
      });
    };
    applyFaults(faults);

    sceneRefs.current = {
      renderer, camera, scene, ecm: ecmGroup, lid: lidGroup, comp: compGroup, pins, hotspots,
      setView: applyView, setExplode: applyExplode, setCompare: applyCompare,
    };

    return () => {
      cancelAnimationFrame(raf);
      envRT.dispose();
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("wheel", wheel as any);
      renderer.domElement.removeEventListener("pointerdown", pdown);
      renderer.domElement.removeEventListener("pointermove", pupdate);
      renderer.domElement.removeEventListener("pointerup", pup);
      window.removeEventListener("resize", onResize);
      if (renderer.domElement.parentNode === mountEl) mountEl.removeChild(renderer.domElement);
      renderer.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mat = mesh.material;
          const arr = (Array.isArray(mat) ? mat : [mat]) as THREE.Material[];
          arr.forEach((m) => { if ((m as any).map) (m as any).map.dispose?.(); m.dispose(); });
        }
      });
    };
  }, [year, make, model, vin, faults]);

  // X-Ray: fade the opaque housing & connector so the internal PCB is visible through them
  useEffect(() => {
    if (aluMatRef.current) aluMatRef.current.opacity = xray ? 0.14 : 1;
    if (plasticMatRef.current) plasticMatRef.current.opacity = xray ? 0.2 : 1;
  }, [xray, year, make, model, vin]);

  const selectView = (v: ViewId) => {
    setView(v);
    sceneRefs.current.setView?.(v);
  };
  const toggleExplode = () => {
    const next = !exploded;
    setExploded(next);
    sceneRefs.current.setExplode?.(next);
  };
  const toggleCompare = () => {
    const next = !compare;
    setCompare(next);
    sceneRefs.current.setCompare?.(next);
  };

  return (
    <section className="relative bg-titanium border-t border-cyan/10">
      <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-center gap-3 mb-4">
          <MousePointerClick className="w-5 h-5 text-cyan" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// VIN-Matched ECM Viewer</span>
        </div>
        <h2 className="font-heading text-4xl sm:text-5xl uppercase text-data leading-[0.95] mb-4">
          Your <span className="text-cyan">Engine Computer</span>, Modelled.
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-6">
          Drag to rotate 360°, scroll or pinch to zoom, tap the orange hotspots, open the housing or toggle X-Ray to see the PCB through the shell, and
          compare your module side-by-side with a fresh OEM replacement. The part number and manufacturer are matched to
          your {vin ? "VIN" : "Year/Make/Model"}.
        </p>

        <div className="border border-cyan/20 bg-blueprint/20 relative">
          {noWebGL ? (
            <div className="w-full flex flex-col items-center justify-center text-center px-6" style={{ height: 440 }}>
              <MousePointerClick className="w-9 h-9 text-cyan/60 mb-3" />
              <div className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-1">// 3D viewer unavailable</div>
              <p className="font-body text-xs text-muted-foreground max-w-sm mb-4">
                Your browser blocked the WebGL renderer, so the interactive ECU model is off. The matched part number and spec sheet below are still available, and you can mail the module in for service.
              </p>
              <Link to="/mail-in" className="inline-flex items-center gap-1.5 bg-cyan text-titanium font-mono text-xs uppercase px-4 py-2 hover:glow-cyan">
                Mail this module in <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div ref={mountRef} className="w-full" style={{ height: 440 }} />
          )}

          {/* angle + mode controls */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[70%]">
            {(["default", "top", "bottom", "side", "connector"] as ViewId[]).map((v) => (
              <button key={v} onClick={() => selectView(v)} className={`font-mono text-[9px] uppercase px-2 py-1 border transition-colors ${view === v ? "border-cyan text-cyan bg-cyan/10" : "border-cyan/30 text-muted-foreground hover:text-cyan"}`}>
                {v === "default" ? "iso" : v}
              </button>
            ))}
          </div>
          <div className="absolute top-3 right-3 flex gap-1.5">
            <button onClick={toggleExplode} className={`flex items-center gap-1 font-mono text-[9px] uppercase px-2 py-1 border ${exploded ? "border-heat text-heat bg-heat/10" : "border-cyan/30 text-muted-foreground hover:text-cyan"}`}>
              <Layers className="w-3 h-3" /> {exploded ? "Close" : "Explode"}
            </button>
            <button onClick={() => setXray((x) => !x)} aria-pressed={xray} className={`flex items-center gap-1 font-mono text-[9px] uppercase px-2 py-1 border ${xray ? "border-cyan text-cyan bg-cyan/10" : "border-cyan/30 text-muted-foreground hover:text-cyan"}`}>
              <Scan className="w-3 h-3" /> {xray ? "X-Ray On" : "X-Ray"}
            </button>
            <button onClick={toggleCompare} className={`flex items-center gap-1 font-mono text-[9px] uppercase px-2 py-1 border ${compare ? "border-cyan text-cyan bg-cyan/10" : "border-cyan/30 text-muted-foreground hover:text-cyan"}`}>
              <GitCompareArrows className="w-3 h-3" /> Compare
            </button>
          </div>
          <div className="absolute bottom-3 left-3 font-mono text-[9px] text-cyan/50 flex items-center gap-3">
            <span>drag · pinch · tap nodes</span>
            {compare && <span className="text-cyan">// LEFT: yours · RIGHT: OEM new</span>}
          </div>

          {/* part-number label */}
          <div className="absolute bottom-3 right-3 bg-titanium/85 border border-cyan/30 px-3 py-2 text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-cyan">{ecm.label}</div>
            <div className="font-mono text-[13px] text-data mt-0.5">{ecm.partNumber}</div>
            <div className="font-mono text-[9px] text-muted-foreground">{ecm.manufacturer} · {ecm.connectorType}</div>
          </div>

          {/* hotspot quick buttons */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 hidden sm:flex gap-1.5">
            {HOTSPOTS.map((h) => (
              <button key={h.id} onClick={() => setActive(h)} className={`font-mono text-[9px] uppercase px-2 py-1 border transition-colors ${active?.id === h.id ? "border-heat text-heat bg-heat/5" : "border-cyan/30 text-muted-foreground hover:text-cyan"}`}>
                {h.label}
              </button>
            ))}
          </div>

          {active && (
            <div className="absolute bottom-0 left-0 right-0 bg-titanium/95 backdrop-blur-md border-t border-cyan/30 p-4">
              <div className="font-mono text-[10px] uppercase text-heat mb-1">// {active.title}</div>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-3">{active.text}</p>
              <Link to="/mail-in" className="inline-flex items-center gap-1.5 font-mono text-xs uppercase text-cyan hover:gap-3 transition-all">
                Mail this module in <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* spec sheet */}
        <div className="grid sm:grid-cols-3 gap-px bg-cyan/10 border border-cyan/10 mt-6">
          <SpecRow label="Manufacturer" value={ecm.manufacturer} />
          <SpecRow label="Part No." value={ecm.partNumber} mono />
          <SpecRow label="Connector" value={ecm.connectorType} />
          <SpecRow label="Application" value={ecm.application} />
          <SpecRow label="Bus" value={ecm.specs.bus} />
          <SpecRow label="Processor" value={ecm.specs.processor} />
        </div>

        {faults && faults.some((f) => f.status !== "normal") && (
          <div className="mt-4 flex items-start gap-2 border border-heat/40 bg-heat/5 p-3">
            <Zap className="w-4 h-4 text-heat shrink-0 mt-0.5" />
            <p className="font-mono text-[11px] text-data/80">
              Diagnostic overlay active — faulty bus lines are highlighted on the connector pins. {faults.filter((f) => f.status !== "normal").map((f) => `${f.label}: ${f.status}`).join(" · ")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function SpecRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-titanium p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-cyan/60">{label}</div>
      <div className={`mt-1 text-sm text-data ${mono ? "font-mono" : "font-body"}`}>{value}</div>
    </div>
  );
}