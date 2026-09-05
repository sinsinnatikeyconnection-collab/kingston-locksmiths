import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { MousePointerClick, ChevronRight, RotateCw, Glasses } from "lucide-react";

interface Zone { id: string; label: string; cat: string }

const ZONES: Zone[] = [
  { id: "engine", label: "Engine Bay", cat: "Mechanical Repair — engine swaps, head gaskets, turbo plumbing, harness rebuilds." },
  { id: "ecu", label: "ECU / PCM", cat: "Electrical & Diagnostics — ECU cloning, remapping, J2534 pass-thru flashing." },
  { id: "dash", label: "Dash / Cluster", cat: "Electrical & Diagnostics — cluster calibration, SRS reset, CAN-bus tracing." },
  { id: "ignition", label: "Ignition / Immo", cat: "Lost Keys & Security — all-keys-lost, transponder & IMMO bypass." },
  { id: "wheels", label: "Wheels / Brakes", cat: "Performance & Mechanical — coilovers, big brakes, LSD, alignment." },
];

export default function CarExplorer3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [drag, setDrag] = useState<boolean>(false);
  const [xrSupported, setXrSupported] = useState<boolean | null>(null);
  const [inVR, setInVR] = useState<boolean>(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const mountEl: HTMLDivElement = mount;
    const w = mountEl.clientWidth, h = mountEl.clientHeight || 440;
    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(7, 3.6, 9);
    camera.lookAt(0, 0.7, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;
    mountEl.appendChild(renderer.domElement);

    // lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(6, 9, 6); scene.add(key);
    const fill = new THREE.DirectionalLight(0x4488cc, 0.5);
    fill.position.set(-7, 4, -5); scene.add(fill);
    const cyanRim = new THREE.PointLight(0x00e5ff, 0.9, 50);
    cyanRim.position.set(-4, 2, 4); scene.add(cyanRim);

    const group = new THREE.Group();
    scene.add(group);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0d1014, roughness: 0.32, metalness: 0.88 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x004a55, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.5 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95, metalness: 0.0 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.25, metalness: 0.95 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xc0c4cc, roughness: 0.2, metalness: 1.0 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.6 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 1.4 });

    // lower chassis / body
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.55, 1.85), bodyMat);
    body.position.set(0, 0.78, 0); group.add(body);
    // accent underbody glow line
    const glow = new THREE.Mesh(new THREE.BoxGeometry(4.32, 0.04, 1.87), accentMat);
    glow.position.set(0, 0.52, 0); group.add(glow);

    // hood + trunk slabs (subtle shaping)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 1.7), bodyMat);
    hood.position.set(1.45, 1.12, 0); group.add(hood);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 1.7), bodyMat);
    trunk.position.set(-1.65, 1.18, 0); group.add(trunk);

    // cabin / greenhouse from an extruded trapezoid (windshield slope + roof + rear slope)
    const cabinShape = new THREE.Shape();
    cabinShape.moveTo(-1.15, 0);
    cabinShape.lineTo(-0.75, 0.5);
    cabinShape.lineTo(0.85, 0.5);
    cabinShape.lineTo(1.05, 0);
    cabinShape.lineTo(-1.15, 0);
    const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, { depth: 1.55, bevelEnabled: false });
    cabinGeo.translate(0, 0, -0.775);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 1.07, 0); group.add(cabin);
    // roof cap (solid) to read as a car roof, leaving windows implied by transparent glass overhang
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), bodyMat);
    roof.position.set(0.05, 1.56, 0); group.add(roof);

    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.26, 28);
    const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.27, 18);
    ([[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]] as [number, number][]).forEach(([x, z]) => {
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(x, 0.42, z); group.add(tire);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, 0.42, z); group.add(rim);
    });

    // lights
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.4), headMat);
    headL.position.set(2.18, 0.92, 0.6); group.add(headL);
    const headR = headL.clone(); headR.position.z = -0.6; group.add(headR);
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), tailMat);
    tailL.position.set(-2.18, 0.92, 0.55); group.add(tailL);
    const tailR = tailL.clone(); tailR.position.z = -0.55; group.add(tailR);

    // grille strip + chrome trim
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 1.5), chromeMat);
    grille.position.set(2.2, 1.02, 0); group.add(grille);

    // ground shadow plate for depth (subtle)
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; group.add(shadow);

    // clickable hotspots
    const hitMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35 });
    const positions: Record<string, [number, number, number]> = {
      engine: [2.0, 0.9, 0], ecu: [0.5, 1.25, 0.62], dash: [-0.55, 1.2, 0.6],
      ignition: [-0.9, 1.05, 0.4], wheels: [1.5, 0.42, 0.95],
    };
    const hits: THREE.Mesh[] = [];
    Object.entries(positions).forEach(([id, p]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 18), hitMat);
      m.position.set(...p); (m.userData as { id: string }).id = id; group.add(m); hits.push(m);
    });

    // interaction — one named pointerdown handler for selection + drag-start;
    // every listener below is named and explicitly removed in cleanup.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let lastX = 0, dragging = false, auto = true;
    const onDown = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const inter = raycaster.intersectObjects(hits);
      if (inter.length) setSel((inter[0].object.userData as { id: string }).id);
      dragging = true; lastX = e.clientX; setDrag(true); auto = false;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    const onMove = (e: PointerEvent) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; group.rotation.y += dx * 0.01; };
    window.addEventListener("pointermove", onMove);
    const onUp = () => { dragging = false; setDrag(false); };
    window.addEventListener("pointerup", onUp);

    const onResize = () => {
      const nw = mountEl.clientWidth, nh = mountEl.clientHeight || 440;
      camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    let frame = 0;
    renderer.setAnimationLoop(() => {
      if (auto) group.rotation.y += 0.004;
      const t = performance.now() * 0.004;
      hits.forEach((h, i) => { h.scale.setScalar(1 + 0.12 * Math.sin(t + i)); });
      renderer.render(scene, camera);
      frame++;
    });
    void frame;

    return () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) { const mat = mesh.material; Array.isArray(mat) ? mat.forEach((m) => m.dispose()) : mat.dispose(); }
      });
    };
  }, []);

  useEffect(() => {
    const xr = (navigator as unknown as { xr?: XRSystem }).xr;
    if (!xr) { setXrSupported(false); return; }
    xr.isSessionSupported("immersive-vr" as XRSessionMode).then(setXrSupported).catch(() => setXrSupported(false));
  }, []);

  const enterVR = async () => {
    const xr = (navigator as unknown as { xr?: XRSystem }).xr;
    if (!xr || !rendererRef.current) return;
    try {
      const session = await xr.requestSession("immersive-vr" as XRSessionMode, { optionalFeatures: ["local-floor"] } as XRSessionInit);
      session.addEventListener("end", () => setInVR(false));
      await rendererRef.current.xr.setSession(session);
      setInVR(true);
    } catch {
      setXrSupported(false);
    }
  };

  const selected = sel ? ZONES.find((z) => z.id === sel) : undefined;
  void drag;

  return (
    <section id="car3d" className="relative bg-titanium border-t border-cyan/10">
      <div className="circuit-grid absolute inset-0 opacity-20 pointer-events-none" />
      <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-center gap-3 mb-4">
          <MousePointerClick className="w-5 h-5 text-cyan" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// 3D Vehicle Explorer</span>
        </div>
        <h2 className="font-heading text-4xl sm:text-5xl uppercase text-data leading-[0.95] mb-4">
          Don&rsquo;t Know the Name? <span className="text-cyan">Click the Zone.</span>
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-8">
          Spin the model, then tap the part that&rsquo;s giving you trouble. We&rsquo;ll tell you the exact service to
          book — no technical vocabulary required.
        </p>
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div ref={mountRef} className="relative bg-blueprint/40 border border-cyan/20 h-[360px] sm:h-[440px] overflow-hidden">
            <span className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 font-mono text-[10px] text-cyan/70"><RotateCw className="w-3.5 h-3.5" /> drag to spin</span>
            {xrSupported && (
              <button onClick={enterVR} className="absolute top-3 right-3 z-10 flex items-center gap-1.5 border border-cyan/40 bg-titanium/80 backdrop-blur px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan hover:glow-cyan">
                <Glasses className="w-3.5 h-3.5" /> {inVR ? "Exit VR" : "Enter VR"}
              </button>
            )}
          </div>
          <div className="bg-titanium border border-cyan/20 p-6 min-h-[300px]">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4">// Selected Zone</div>
            {!sel ? (
              <div className="text-center font-mono text-sm text-muted-foreground/50 py-16">tap a hotspot on the model →</div>
            ) : (
              <div className="space-y-4">
                <div className="font-heading text-2xl uppercase text-data">{selected?.label}</div>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{selected?.cat}</p>
                <Link to="/#intake" className="inline-flex items-center gap-1.5 bg-cyan text-titanium font-mono text-xs uppercase px-5 py-3 hover:glow-cyan">
                  Book this service <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}