import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ChevronRight, MousePointerClick } from "lucide-react";
import { Link } from "react-router-dom";

interface Hotspot { id: string; label: string; title: string; text: string }
interface Spot { id: string; x: number; y: number; z: number }

const HOTSPOTS: Hotspot[] = [
  { id: "eeprom", label: "EEPROM / MCU", title: "EEPROM & MCU Desolder / Flash", text: "We desolder the EEPROM/MCU chip, read raw data on an external programmer, edit mileage/immobilizer bytes, and flash it back — no cutting the immobilizer." },
  { id: "flash", label: "Flash Memory", title: "Firmware Flash Cell", text: "Firmware is read via J2534 pass-thru or boot mode, remapped (fuel/ignition maps, deletes, IMMO-off), and re-flashed in place over CAN." },
  { id: "connector", label: "OBD2 / CAN Bus", title: "CAN / OBD2 Interface", text: "Where we inject live diagnostics over CAN/LIN/FlexRay — pulling DTCs, live sensor data, and module adaptation straight off the vehicle bus." },
];

export default function ModuleViewer3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Hotspot | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const mountEl: HTMLDivElement = mount;
    const width = mountEl.clientWidth || 600;
    const height = 380;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 3.4, 6.2);
    camera.lookAt(0, 0.2, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mountEl.appendChild(renderer.domElement);

    // lighting so the standard materials actually shade
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(5, 8, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x66ccff, 0.45);
    fill.position.set(-6, 4, -4);
    scene.add(fill);
    const rim = new THREE.PointLight(0x00e5ff, 0.6, 40);
    rim.position.set(-3, 3, -4);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0a2a1c, roughness: 0.55, metalness: 0.18 });
    const silkMat = new THREE.MeshStandardMaterial({ color: 0xc8c9a0, roughness: 0.7, metalness: 0.0 });
    const chipMat = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.45, metalness: 0.35 });
    const labelMat = new THREE.MeshStandardMaterial({ color: 0x6a6f6a, roughness: 0.6, metalness: 0.1 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xb8b8c0, roughness: 0.25, metalness: 0.95 });
    const capBodyMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5, metalness: 0.2 });
    const capTopMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.2, metalness: 0.95 });
    const traceMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x004858, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.4 });
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xff3e00, emissive: 0xff3e00, emissiveIntensity: 1.1 });

    // PCB substrate
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 2.6), pcbMat);
    group.add(pcb);
    // gold edge fingers
    const edge = new THREE.Mesh(new THREE.BoxGeometry(4.42, 0.04, 0.16), metalMat);
    edge.position.set(0, 0.09, 1.27); group.add(edge);
    const edge2 = edge.clone(); edge2.position.z = -1.27; group.add(edge2);
    // silk-screen top layer
    const silk = new THREE.Mesh(new THREE.BoxGeometry(4.32, 0.02, 2.52), silkMat);
    silk.position.y = 0.08; group.add(silk);

    // decorative copper traces
    const trace = (x: number, z: number, w: number, d: number) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), traceMat);
      t.position.set(x, 0.095, z); group.add(t);
    };
    trace(-1.6, 0.8, 1.4, 0.05);
    trace(-0.9, 0.8, 0.05, 1.0);
    trace(0.8, -0.8, 1.6, 0.05);
    trace(0.0, -0.3, 0.05, 0.9);

    // central MCU (QFP-style)
    const mcu = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 1.1), chipMat);
    mcu.position.set(0, 0.23, 0); group.add(mcu);
    const mcuLabel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.005, 0.5), labelMat);
    mcuLabel.position.set(0, 0.325, 0); group.add(mcuLabel);
    // chip pins
    [-1, 0, 1].forEach((i) => {
      [-1, 0, 1].forEach((j) => {
        const pin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), metalMat);
        pin.position.set(0.58, 0.21, 0.36 * i);
        group.add(pin);
        const pin2 = pin.clone(); pin2.position.x = -0.58; group.add(pin2);
      });
    });

    // EEPROM chip (left) + flash chip (right)
    const eeprom = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), chipMat);
    eeprom.position.set(-1.45, 0.2, -0.6); group.add(eeprom);
    const eepromLabel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.004, 0.32), labelMat);
    eepromLabel.position.set(-1.45, 0.266, -0.6); group.add(eepromLabel);

    const flash = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.6), chipMat);
    flash.position.set(1.4, 0.19, 0.5); group.add(flash);

    // capacitors (electrolytic)
    ([[-1.5, 0.7], [1.6, 0.6], [1.4, -0.9]] as [number, number][]).forEach(([x, z]) => {
      const cBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 20), capBodyMat);
      cBody.position.set(x, 0.24, z); group.add(cBody);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 20), capTopMat);
      top.position.set(x, 0.42, z); group.add(top);
    });

    // OBD2 / bus connector block along the front edge
    const conn = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.34, 0.38), chipMat);
    conn.position.set(0, 0.24, 1.1); group.add(conn);
    for (let i = -2; i <= 2; i++) {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 12), metalMat);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(i * 0.3, 0.24, 1.25); group.add(pin);
    }

    // small status LED
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), ledMat);
    led.position.set(1.9, 0.1, -1.1); group.add(led);

    // clickable hotspots
    const spots: Spot[] = [
      { id: "eeprom", x: -1.45, y: 0.5, z: -0.6 },
      { id: "flash", x: 1.4, y: 0.42, z: 0.5 },
      { id: "connector", x: 0, y: 0.6, z: 1.15 },
    ];
    const spotMat = new THREE.MeshBasicMaterial({ color: 0xff3e00, transparent: true, opacity: 0.9 });
    const hitMeshes: THREE.Mesh[] = spots.map((s) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 18), spotMat);
      m.position.set(s.x, s.y, s.z); (m.userData as { id: string }).id = s.id; group.add(m); return m;
    });

    // interaction
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      if (hits.length) setActive(HOTSPOTS.find((h) => h.id === (hits[0].object.userData as { id: string }).id) ?? null);
    };
    renderer.domElement.addEventListener("click", onClick);

    let rotY = 0, dragging = false, lastX = 0, auto = true;
    const down = (e: PointerEvent) => { dragging = true; auto = false; lastX = e.clientX; };
    const move = (e: PointerEvent) => { if (!dragging) return; rotY += (e.clientX - lastX) * 0.01; lastX = e.clientX; };
    const up = () => { dragging = false; setTimeout(() => (auto = true), 2600); };
    renderer.domElement.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (auto) rotY += 0.005;
      group.rotation.y = rotY;
      const t = performance.now() * 0.004;
      hitMeshes.forEach((h, i) => h.scale.setScalar(1 + 0.18 * Math.sin(t + i)));
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mountEl.clientWidth || 600;
      camera.aspect = w / height; camera.updateProjectionMatrix(); renderer.setSize(w, height);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("resize", onResize);
      if (renderer.domElement.parentNode === mountEl) mountEl.removeChild(renderer.domElement);
      renderer.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) { const mat = mesh.material; Array.isArray(mat) ? mat.forEach((m) => m.dispose()) : mat.dispose(); }
      });
    };
  }, []);

  return (
    <section className="relative bg-titanium border-t border-cyan/10">
      <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-center gap-3 mb-4">
          <MousePointerClick className="w-5 h-5 text-cyan" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// Interactive 3D Module Viewer</span>
        </div>
        <h2 className="font-heading text-4xl sm:text-5xl uppercase text-data leading-[0.95] mb-4">
          Exploded <span className="text-cyan">ECU</span> View
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-8">
          This is the surgery we do on your control module. Drag the PCB to rotate it and click the orange nodes to see
          exactly where we pull EEPROM/MCU firmware, re-flash calibration maps, and tap the CAN bus.
        </p>
        <div className="border border-cyan/20 bg-blueprint/20 relative">
          <div ref={mountRef} className="w-full" style={{ height: 380 }} />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {HOTSPOTS.map((h) => (
              <button key={h.id} onClick={() => setActive(h)} className={`font-mono text-[10px] uppercase px-2 py-1 border transition-colors ${active?.id === h.id ? "border-heat text-heat bg-heat/5" : "border-cyan/30 text-muted-foreground hover:text-cyan"}`}>
                {h.label}
              </button>
            ))}
          </div>
          <div className="absolute bottom-3 right-3 font-mono text-[10px] text-cyan/50 flex items-center gap-1">drag to rotate • tap orange nodes</div>
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
      </div>
    </section>
  );
}