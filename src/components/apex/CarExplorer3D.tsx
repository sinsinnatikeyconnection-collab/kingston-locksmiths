import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  MousePointerClick, ChevronRight, RotateCw, Glasses,
  Car as CarIcon, Cog, Sofa, Wrench, Scan, DoorOpen, Palette, CircleDot,
} from "lucide-react";
import { hasWebGL } from "@/lib/webgl";

// An *approximation* 3D vehicle viewer. We don't have CAD models for every
// Year/Make/Model, so we map the entered YMM to a generic body style and render
// a parametric low-poly stand-in that "looks like" that category + offers
// exterior / interior / engine / undercarriage camera views. Honestly labelled.
// Enhanced: PBR car paint w/ clearcoat, real shadow-mapped ground shadow,
// user paint color picker, animated wheel spin, opening doors + hood, X-Ray.

type BodyStyle = "sedan" | "coupe" | "suv" | "truck" | "hatch";
type ViewId = "exterior" | "interior" | "engine" | "under";

interface Zone { id: string; label: string; cat: string }

const ZONES: Zone[] = [
  { id: "engine", label: "Engine Bay", cat: "Mechanical Repair — engine swaps, head gaskets, turbo plumbing, harness rebuilds." },
  { id: "ecu", label: "ECU / PCM", cat: "Electrical & Diagnostics — ECU cloning, remapping, J2534 pass-thru flashing." },
  { id: "dash", label: "Dash / Cluster", cat: "Electrical & Diagnostics — cluster calibration, SRS reset, CAN-bus tracing." },
  { id: "ignition", label: "Ignition / Immo", cat: "Lost Keys & Security — all-keys-lost, transponder & IMMO bypass." },
  { id: "wheels", label: "Wheels / Brakes", cat: "Performance & Mechanical — coilovers, big brakes, LSD, alignment." },
];

const BODY_STYLES: { id: BodyStyle; label: string }[] = [
  { id: "sedan", label: "Sedan" },
  { id: "coupe", label: "Coupe" },
  { id: "hatch", label: "Hatchback" },
  { id: "suv", label: "SUV / Crossover" },
  { id: "truck", label: "Truck / Pickup" },
];

const PAINT_SWATCHES = [
  { name: "Stealth", hex: "#0d1014" },
  { name: "Cyan", hex: "#00e5ff" },
  { name: "Inferno", hex: "#ff2200" },
  { name: "Graphite", hex: "#2a2e33" },
  { name: "Pearl", hex: "#e8ebee" },
  { name: "Racing", hex: "#0a2cff" },
  { name: "Emerald", hex: "#0f6b3a" },
  { name: "Gold", hex: "#c9a227" },
];

// heuristics to *suggest* a body style from free-form Year/Make/Model text
function detectBodyStyle(text: string): BodyStyle {
  const t = ` ${text.toLowerCase()} `;
  if (/truck|f-150|f150|f-250|f250|silverado|sierra|tundra|frontier|tacoma|ridgeline|colorado|ranger|ram 1|ram 2|ram 3/.test(t)) return "truck";
  if (/coupe|coupe |mustang|camaro|challenger|charger|corvette| 911 |gr86| brz | supra | 86 /.test(t)) return "coupe";
  if (/hatch|hatchback| gti | golf | focus |mazda3| civic hatch/.test(t)) return "hatch";
  if (/suv|4runner|tahoe|suburban|explorer|traverse|telluride|palisade|rogue|cr-v|rav4|highlander| pilot |durango|cherokee|wrangler|tucson|santa|cx-|outback|forester|ascent| x5 | x3 |q5|q7|q3|gle|glc| gx | rx | nx |escalade|navigator|aviator|edge|escape|blazer/.test(t)) return "suv";
  return "sedan";
}

interface BodyConfig {
  length: number; bodyHeight: number; width: number;
  roofHeight: number; cabinLength: number; cabinBaseY: number;
  wheelRadius: number; hoodLen: number; trunkLen: number; bed?: boolean;
}

const BODY_CONFIG: Record<BodyStyle, BodyConfig> = {
  sedan: { length: 4.3, bodyHeight: 0.6, width: 1.85, roofHeight: 1.35, cabinLength: 1.7, cabinBaseY: 1.05, wheelRadius: 0.42, hoodLen: 1.3, trunkLen: 1.0 },
  coupe: { length: 4.2, bodyHeight: 0.58, width: 1.85, roofHeight: 1.25, cabinLength: 1.45, cabinBaseY: 1.05, wheelRadius: 0.43, hoodLen: 1.45, trunkLen: 0.9 },
  hatch: { length: 4.0, bodyHeight: 0.6, width: 1.78, roofHeight: 1.3, cabinLength: 1.9, cabinBaseY: 1.05, wheelRadius: 0.4, hoodLen: 1.0, trunkLen: 0.0 },
  suv: { length: 4.5, bodyHeight: 0.8, width: 1.95, roofHeight: 1.65, cabinLength: 2.3, cabinBaseY: 1.2, wheelRadius: 0.46, hoodLen: 1.1, trunkLen: 0.7 },
  truck: { length: 5.1, bodyHeight: 0.78, width: 2.0, roofHeight: 1.55, cabinLength: 1.7, cabinBaseY: 1.2, wheelRadius: 0.52, hoodLen: 1.4, trunkLen: 0.0, bed: true },
};

interface ViewFlags {
  target: [number, number, number];
  focus: [number, number, number];
  roof: boolean; hood: boolean; engine: boolean; interior: boolean;
  under: boolean; hotspots: boolean; bodyOpacity: number;
}

const VIEW_CONFIG: Record<ViewId, ViewFlags> = {
  exterior:  { target: [7, 3.6, 9],   focus: [0, 0.7, 0], roof: true,  hood: true,  engine: false, interior: false, under: false, hotspots: true,  bodyOpacity: 1 },
  interior:  { target: [0.2, 2.6, 4.6],focus: [0, 1.1, 0], roof: false, hood: true,  engine: false, interior: true,  under: false, hotspots: false, bodyOpacity: 1 },
  engine:    { target: [4.8, 1.7, 3.8],focus: [1.5, 0.95,0],roof: true,  hood: false, engine: true,  interior: false, under: false, hotspots: false, bodyOpacity: 1 },
  under:     { target: [0, -3.0, 6.5], focus: [0, 0.35,0], roof: true,  hood: true,  engine: false, interior: false, under: true,  hotspots: false, bodyOpacity: 0.45 },
};

const VIEW_TABS: { id: ViewId; label: string; Icon: typeof CarIcon }[] = [
  { id: "exterior", label: "Exterior", Icon: CarIcon },
  { id: "interior", label: "Cabin", Icon: Sofa },
  { id: "engine", label: "Engine", Icon: Cog },
  { id: "under", label: "Undercarriage", Icon: Wrench },
];

export default function CarExplorer3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const camTargetRef = useRef(new THREE.Vector3(...VIEW_CONFIG.exterior.target));
  const camFocusRef = useRef(new THREE.Vector3(...VIEW_CONFIG.exterior.focus));
  const flagsRef = useRef<ViewFlags>(VIEW_CONFIG.exterior);
  const bodyMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);

  // animation control refs (set by the scene-build effect, read by the loop)
  const wheelsRef = useRef<THREE.Group[]>([]);
  const doorsRef = useRef<THREE.Group[]>([]);
  const hoodRef = useRef<THREE.Group | null>(null);
  const spinStateRef = useRef({ on: false, speed: 0.18 });
  const doorStateRef = useRef({ targetL: 0, targetR: 0, curL: 0, curR: 0 });
  const hoodStateRef = useRef({ target: 0, cur: 0 });

  const [year, setYear] = useState<string>("");
  const [make, setMake] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [bodyStyle, setBodyStyle] = useState<BodyStyle>("sedan");
  const [view, setView] = useState<ViewId>("exterior");
  const [sel, setSel] = useState<string | null>(null);
  const [xrSupported, setXrSupported] = useState<boolean | null>(null);
  const [inVR, setInVR] = useState<boolean>(false);
  const [noWebGL, setNoWebGL] = useState<boolean>(false);
  const [xray, setXray] = useState<boolean>(false);
  const [paint, setPaint] = useState<string>(PAINT_SWATCHES[0].hex);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [doorsOpen, setDoorsOpen] = useState<boolean>(false);
  const [hoodOpen, setHoodOpen] = useState<boolean>(false);

  // auto-suggest body style from YMM text, but keep user override authority
  useEffect(() => {
    const merged = `${year} ${make} ${model}`.trim();
    if (!merged) return;
    const detected = detectBodyStyle(merged);
    setBodyStyle(detected);
  }, [year, make, model]);

  // paint color -> body material (live, no scene rebuild needed)
  useEffect(() => {
    if (bodyMatRef.current) bodyMatRef.current.color.set(paint);
  }, [paint]);

  // spin toggle -> animation flag
  useEffect(() => { spinStateRef.current.on = spinning; }, [spinning]);

  // door / hood toggles -> animation targets
  useEffect(() => {
    doorStateRef.current.targetL = doorsOpen ? -1.15 : 0;
    doorStateRef.current.targetR = doorsOpen ? 1.15 : 0;
  }, [doorsOpen]);
  useEffect(() => { hoodStateRef.current.target = hoodOpen ? -1.0 : 0; }, [hoodOpen]);

  // (re)build the scene whenever the body style changes
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const mountEl: HTMLDivElement = mount;
    if (!hasWebGL()) { setNoWebGL(true); return; }
    const w = mountEl.clientWidth, h = mountEl.clientHeight || 440;
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 120);
    camera.position.set(...VIEW_CONFIG.exterior.target);
    camera.lookAt(...VIEW_CONFIG.exterior.focus);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setNoWebGL(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    rendererRef.current = renderer;
    try {
      mountEl.appendChild(renderer.domElement);
    } catch {
      setNoWebGL(true);
      renderer.dispose();
      return;
    }

    // ---- image-based lighting: RoomEnvironment gives the clearcoat paint & glass
    // real PBR reflections (the big realism jump from flat shading) ----
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    // ---- studio lighting (direct highlights + fill) ----
    scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x05060a, 0.7));
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(6, 11, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sCam = key.shadow.camera as THREE.OrthographicCamera;
    sCam.left = -6; sCam.right = 6; sCam.top = 6; sCam.bottom = -6; sCam.near = 1; sCam.far = 30;
    key.shadow.bias = -0.0004;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x66aaff, 0.55);
    fill.position.set(-7, 5, -5); scene.add(fill);
    const back = new THREE.DirectionalLight(0x00e5ff, 0.5);
    back.position.set(0, 3, -9); scene.add(back);
    const cyanRim = new THREE.PointLight(0x00e5ff, 1.0, 60);
    cyanRim.position.set(-4, 2, 4); scene.add(cyanRim);
    const heatKick = new THREE.PointLight(0xff3e00, 0.45, 40);
    heatKick.position.set(5, 1, -4); scene.add(heatKick);

    // ---- ground plane that receives a real shadow ----
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(10, 64),
      new THREE.MeshStandardMaterial({ color: 0x070809, roughness: 0.95, metalness: 0.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.001;
    ground.receiveShadow = true;
    scene.add(ground);

    const group = new THREE.Group();
    groupRef.current = group;
    scene.add(group);

    const cfg = BODY_CONFIG[bodyStyle];
    const halfL = cfg.length / 2;

    const bodyMat = new THREE.MeshPhysicalMaterial({ color: paint, roughness: 0.25, metalness: 0.9, clearcoat: 1.0, clearcoatRoughness: 0.18, transparent: true, opacity: 1, envMapIntensity: 1.3 });
    bodyMatRef.current = bodyMat;
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x004a55, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.5 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0a1822, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.5, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95, metalness: 0.0 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.22, metalness: 0.95, envMapIntensity: 1.2 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xc0c4cc, roughness: 0.15, metalness: 1.0, envMapIntensity: 1.4 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffee, emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.0 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.0, roughness: 0.3, metalness: 0.0 });
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.7, metalness: 0.1 });
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.5, metalness: 0.7 });
    const engineHeadMat = new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: 0.35, metalness: 0.85 });
    const underMat = new THREE.MeshStandardMaterial({ color: 0x0a0c0e, roughness: 0.85, metalness: 0.3 });
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.3, metalness: 0.95 });

    // small helper: ensure a mesh casts shadows
    const shadow = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; return m; };

    // rounded-box geometry — bevels every edge so body panels read as smooth
    // sculpted surfaces, not toy blocks
    const roundedBox = (w: number, h: number, d: number, r = 0.12) => {
      const s = new THREE.Shape();
      const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
      s.moveTo(x0 + r, y0);
      s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
      s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
      s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r);
      s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
      const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(d - 2 * r, 0.02), bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 3, curveSegments: 10 });
      g.translate(0, 0, -(d - 2 * r) / 2);
      return g;
    };

    // ---- EXTERIOR group ----
    const exterior = new THREE.Group(); group.add(exterior);
    (exterior.userData as { name: string }).name = "exterior";

    const body = shadow(new THREE.Mesh(roundedBox(cfg.length, cfg.bodyHeight, cfg.width, Math.min(0.16, cfg.bodyHeight / 3)), bodyMat));
    body.position.set(0, cfg.cabinBaseY - cfg.bodyHeight / 2 + 0.0, 0); exterior.add(body);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(cfg.length + 0.02, 0.04, cfg.width + 0.02), accentMat);
    glow.position.set(0, cfg.cabinBaseY - cfg.bodyHeight - 0.02, 0); exterior.add(glow);

    // ---- hood (separate pivot group so it can lift open) ----
    const hoodG = new THREE.Group();
    hoodG.position.set(halfL - cfg.hoodLen, cfg.cabinBaseY + 0.18, 0); // hinge at the cowl (rear) edge
    const hoodPanel = shadow(new THREE.Mesh(new THREE.BoxGeometry(cfg.hoodLen, 0.16, cfg.width - 0.12), bodyMat));
    hoodPanel.position.set(cfg.hoodLen / 2, 0, 0); hoodG.add(hoodPanel);
    exterior.add(hoodG);
    hoodRef.current = hoodG;
    (hoodPanel.userData as { name: string }).name = "hood-panel";

    let trunk: THREE.Mesh | null = null;
    if (!cfg.bed && cfg.trunkLen > 0) {
      trunk = new THREE.Mesh(new THREE.BoxGeometry(cfg.trunkLen, 0.16, cfg.width - 0.12), bodyMat);
      trunk.position.set(-(halfL - cfg.trunkLen / 2 - 0.05), cfg.cabinBaseY + 0.16, 0); exterior.add(trunk);
    }
    // truck: open bed walls
    if (cfg.bed) {
      const bedWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, cfg.width), bodyMat);
      bedWall.position.set(-0.85, cfg.cabinBaseY + 0.25, 0); exterior.add(bedWall);
      const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, cfg.width), bodyMat);
      bedFloor.position.set(-1.9, cfg.cabinBaseY - 0.05, 0); exterior.add(bedFloor);
    }

    // cabin trapezoid glass
    const cabinShape = new THREE.Shape();
    const cLen = cfg.cabinLength;
    const cH = cfg.roofHeight;
    cabinShape.moveTo(-cLen / 2, 0);
    cabinShape.lineTo(-cLen / 2 + 0.35, cH);
    cabinShape.lineTo(cLen / 2 - 0.25, cH);
    cabinShape.lineTo(cLen / 2, 0);
    cabinShape.lineTo(-cLen / 2, 0);
    const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, { depth: cfg.width - 0.2, bevelEnabled: false });
    cabinGeo.translate(0, 0, -(cfg.width - 0.2) / 2);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(cfg.bed ? 0.3 : 0, cfg.cabinBaseY, 0); exterior.add(cabin);

    // solid roof cap
    const roof = new THREE.Mesh(roundedBox(cLen - 0.3, 0.12, cfg.width - 0.25, 0.05), bodyMat);
    roof.position.set(cfg.bed ? 0.3 : 0, cfg.cabinBaseY + cH, 0); exterior.add(roof);
    (roof.userData as { name: string }).name = "roof";

    // ---- wheels (each as a group so we can spin them) ----
    wheelsRef.current = [];
    const rimGeo = new THREE.CylinderGeometry(cfg.wheelRadius * 0.5, cfg.wheelRadius * 0.5, 0.27, 18);
    const axleFront = halfL - 0.65;
    const axleRear = -(halfL - 0.65);
    const wheelPositions: [number, number][] = [
      [axleFront, cfg.width / 2 - 0.05], [axleFront, -(cfg.width / 2 - 0.05)],
      [axleRear, cfg.width / 2 - 0.05], [axleRear, -(cfg.width / 2 - 0.05)],
    ];
    wheelPositions.forEach(([x, z]) => {
      const wheelG = new THREE.Group();
      wheelG.position.set(x, cfg.wheelRadius, z);
      const tireGeo = new THREE.CylinderGeometry(cfg.wheelRadius, cfg.wheelRadius, 0.26, 28);
      const tire = shadow(new THREE.Mesh(tireGeo, tireMat));
      tire.rotation.x = Math.PI / 2; wheelG.add(tire);
      const rim = shadow(new THREE.Mesh(rimGeo, rimMat));
      rim.rotation.x = Math.PI / 2; wheelG.add(rim);
      // realistic chrome rim lip, hub cap and 5 spokes (axle along Z, face in XY)
      const rimLip = shadow(new THREE.Mesh(new THREE.TorusGeometry(cfg.wheelRadius * 0.52, 0.035, 10, 28), rimMat));
      wheelG.add(rimLip);
      const hub = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.28, 14), chromeMat));
      hub.rotation.x = Math.PI / 2; wheelG.add(hub);
      for (let s = 0; s < 5; s++) {
        const spoke = shadow(new THREE.Mesh(new THREE.BoxGeometry(cfg.wheelRadius * 0.5, 0.045, 0.035), rimMat));
        spoke.rotation.z = (s / 5) * Math.PI * 2;
        wheelG.add(spoke);
      }
      exterior.add(wheelG);
      wheelsRef.current.push(wheelG);
    });

    // ---- fender arches (body-coloured half-tori over each wheel well) ----
    wheelPositions.forEach(([x, z]) => {
      const arch = shadow(new THREE.Mesh(new THREE.TorusGeometry(cfg.wheelRadius * 1.08, 0.06, 10, 20, Math.PI), bodyMat));
      arch.position.set(x, cfg.wheelRadius, z);
      arch.rotation.set(Math.PI / 2, 0, 0);
      exterior.add(arch);
    });

    // ---- doors (pivot groups along the side roof/pillar edge) ----
    doorsRef.current = [];
    const doorHingeY = cfg.cabinBaseY + 0.45;
    const doorW = 0.95;
    const cabinCx = cfg.bed ? 0.3 : 0;
    const makeDoor = (hingeX: number, sideSign: number) => {
      const dg = new THREE.Group();
      dg.position.set(hingeX, doorHingeY, sideSign * (cfg.width / 2));
      const skin = shadow(new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.95, 0.08), bodyMat));
      skin.position.set(-doorW / 2, -0.45, sideSign * 0.04);
      const win = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.7, 0.4, 0.02), glassMat);
      win.position.set(-doorW / 2, 0.05, sideSign * 0.06);
      dg.add(skin); dg.add(win);
      exterior.add(dg);
      return dg;
    };
    const doorL = makeDoor(cabinCx + cLen / 2 - 0.05, +1); // driver side (+Z)
    const doorR = makeDoor(cabinCx + cLen / 2 - 0.05, -1); // passenger side (-Z)
    doorsRef.current = [doorL, doorR];

    // lights + grille (front = +X)
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.42), headMat);
    headL.position.set(halfL + 0.02, cfg.cabinBaseY + 0.05, cfg.width / 2 - 0.55); exterior.add(headL);
    const headR = headL.clone(); headR.position.z = -(cfg.width / 2 - 0.55); exterior.add(headR);
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.5), tailMat);
    tailL.position.set(-(halfL + 0.02), cfg.cabinBaseY + 0.08, cfg.width / 2 - 0.55); exterior.add(tailL);
    const tailR = tailL.clone(); tailR.position.z = -(cfg.width / 2 - 0.55); exterior.add(tailR);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, cfg.width - 0.3), chromeMat);
    grille.position.set(halfL + 0.03, cfg.cabinBaseY - cfg.bodyHeight / 2 + 0.18, 0); exterior.add(grille);

    // ---- INTERIOR group ----
    const interiorG = new THREE.Group(); group.add(interiorG); (interiorG.userData as { name: string }).name = "interior";
    const seatGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const seatBackGeo = new THREE.BoxGeometry(0.5, 0.7, 0.12);
    [[-0.2, cfg.width / 2 - 0.45], [-0.2, -(cfg.width / 2 - 0.45)], [0.25, cfg.width / 2 - 0.45], [0.25, -(cfg.width / 2 - 0.45)]].forEach(([sx, sz]) => {
      const base = new THREE.Mesh(seatGeo, interiorMat);
      base.position.set(cabinCx + sx, cfg.cabinBaseY + 0.35, sz); interiorG.add(base);
      const back = new THREE.Mesh(seatBackGeo, interiorMat);
      back.position.set(cabinCx + sx - 0.18, cfg.cabinBaseY + 0.65, sz); interiorG.add(back);
    });
    // dash
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, cfg.width - 0.3), interiorMat);
    dash.position.set(cabinCx + 0.9, cfg.cabinBaseY + 0.5, 0); interiorG.add(dash);
    // steering wheel
    const wheelSg = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 10, 24), interiorMat);
    wheelSg.position.set(cabinCx + 0.85, cfg.cabinBaseY + 0.6, cfg.width / 2 - 0.45); wheelSg.rotation.y = Math.PI / 2; wheelSg.rotation.x = -0.3; interiorG.add(wheelSg);

    // ---- ENGINE group ----
    const engineG = new THREE.Group(); group.add(engineG); (engineG.userData as { name: string }).name = "engine";
    const block = new THREE.Mesh(new THREE.BoxGeometry(cfg.hoodLen - 0.3, 0.55, cfg.width - 0.5), engineMat);
    block.position.set(halfL - cfg.hoodLen / 2 - 0.05, cfg.cabinBaseY + 0.55, 0); engineG.add(block);
    const valveCover = new THREE.Mesh(new THREE.BoxGeometry(cfg.hoodLen - 0.5, 0.14, cfg.width - 0.7), engineHeadMat);
    valveCover.position.set(halfL - cfg.hoodLen / 2 - 0.05, cfg.cabinBaseY + 0.9, 0); engineG.add(valveCover);
    for (let i = -1; i <= 1; i++) {
      const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 14), chromeMat);
      coil.position.set(halfL - cfg.hoodLen / 2 - 0.05 + i * 0.5, cfg.cabinBaseY + 1.0, 0); engineG.add(coil);
    }
    const rad = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, cfg.width - 0.6), chromeMat);
    rad.position.set(halfL + 0.02, cfg.cabinBaseY + 0.45, 0); engineG.add(rad);

    // ---- UNDER group ----
    const underG = new THREE.Group(); group.add(underG); (underG.userData as { name: string }).name = "under";
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, cfg.length - 1.4, 16), exhaustMat);
    pipe.rotation.z = Math.PI / 2; pipe.position.set(0, cfg.wheelRadius - 0.18, 0); underG.add(pipe);
    const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.6, 18), exhaustMat);
    muffler.rotation.z = Math.PI / 2; muffler.position.set(-1.1, cfg.wheelRadius - 0.2, 0); underG.add(muffler);
    [[axleFront], [axleRear]].forEach(([x]) => {
      const cm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, cfg.width), underMat);
      cm.position.set(x, cfg.wheelRadius - 0.1, 0); underG.add(cm);
    });
    ([ [axleFront, cfg.width / 2 - 0.1], [axleFront, -(cfg.width / 2 - 0.1)], [axleRear, cfg.width / 2 - 0.1], [axleRear, -(cfg.width / 2 - 0.1)] ] as [number, number][]).forEach(([x, z]) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.07), underMat);
      arm.position.set(x, cfg.wheelRadius - 0.12, z * 0.6); underG.add(arm);
    });

    // hotspots (exterior only)
    const hitMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35 });
    const positions: Record<string, [number, number, number]> = {
      engine: [halfL - 0.3, cfg.cabinBaseY + 1.1, 0.62],
      ecu: [0.1, cfg.cabinBaseY + 0.5, 0.62],
      dash: [0.35, cfg.cabinBaseY + 0.55, 0.6],
      ignition: [-0.2, cfg.cabinBaseY + 0.5, 0.5],
      wheels: [axleFront, cfg.wheelRadius, cfg.width / 2],
    };
    const hits: THREE.Mesh[] = [];
    Object.entries(positions).forEach(([id, p]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 18), hitMat);
      m.position.set(...p); (m.userData as { id: string }).id = id; group.add(m); hits.push(m);
    });

    // interaction
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false, lastX = 0, auto = true;
    const onDown = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const inter = raycaster.intersectObjects(hits);
      if (inter.length) setSel((inter[0].object.userData as { id: string }).id);
      dragging = true; lastX = e.clientX; auto = false;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    const onMove = (e: PointerEvent) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; group.rotation.y += dx * 0.01; };
    window.addEventListener("pointermove", onMove);
    const onUp = () => { dragging = false; };
    window.addEventListener("pointerup", onUp);

    const onResize = () => {
      const nw = mountEl.clientWidth, nh = mountEl.clientHeight || 440;
      camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    flagsRef.current = VIEW_CONFIG.exterior;
    const applyFlags = (f: ViewFlags) => {
      roof.visible = f.roof;
      hoodG.visible = f.hood;
      interiorG.visible = f.interior;
      engineG.visible = f.engine;
      underG.visible = f.under;
      hits.forEach((ht) => { ht.visible = f.hotspots; });
      bodyMat.opacity = f.bodyOpacity;
    };
    applyFlags(flagsRef.current);

    const focusVec = new THREE.Vector3(...flagsRef.current.focus);
    const t0 = performance.now();
    renderer.setAnimationLoop(() => {
      const tt = (performance.now() - t0) * 0.004;
      if (auto) group.rotation.y += 0.0035;
      // wheel spin
      if (spinStateRef.current.on) {
        const v = spinStateRef.current.speed;
        wheelsRef.current.forEach((g) => { g.rotation.z += v; });
      }
      // door swing (lerp toward target)
      const ds = doorStateRef.current;
      ds.curL += (ds.targetL - ds.curL) * 0.1;
      ds.curR += (ds.targetR - ds.curR) * 0.1;
      if (doorsRef.current[0]) doorsRef.current[0].rotation.y = ds.curL;
      if (doorsRef.current[1]) doorsRef.current[1].rotation.y = ds.curR;
      // hood lift (lerp) - rotation about Z lifts the front (+X local) edge up
      const hs = hoodStateRef.current;
      hs.cur += (hs.target - hs.cur) * 0.1;
      if (hoodRef.current) hoodRef.current.rotation.z = hs.cur;
      camera.position.lerp(camTargetRef.current, 0.06);
      focusVec.lerp(camFocusRef.current, 0.06);
      camera.lookAt(focusVec);
      hits.forEach((ht, i) => { ht.scale.setScalar(1 + 0.12 * Math.sin(tt + i)); });
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      envRT.dispose();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) { const mat = mesh.material; Array.isArray(mat) ? mat.forEach((m) => m.dispose()) : (mat as THREE.Material).dispose(); }
      });
    };
  }, [bodyStyle, paint]); // rebuild when body style changes; paint also re-seeds color cleanly

  // apply a view change: update camera targets + show/hide subgroups
  useEffect(() => {
    void view;
    const f = VIEW_CONFIG[view];
    flagsRef.current = f;
    camTargetRef.current.set(...f.target);
    camFocusRef.current.set(...f.focus);
    if (bodyMatRef.current) bodyMatRef.current.opacity = xray ? 0.14 : f.bodyOpacity;
    const group = groupRef.current;
    if (!group) return;
    group.traverse((o) => {
      const name = (o.userData as { name?: string }).name;
      if (name === "roof") o.visible = f.roof;
      else if (name === "interior") o.visible = f.interior || xray;
      else if (name === "engine") o.visible = f.engine || xray;
      else if (name === "under") o.visible = f.under;
      else if ((o.userData as { id?: string }).id) o.visible = f.hotspots;
    });
  }, [view, xray, bodyStyle]);

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
  const caption = [year, make, model].filter(Boolean).join(" ").trim() || "Generic Vehicle";
  const styleLabel = BODY_STYLES.find((b) => b.id === bodyStyle)?.label ?? "Sedan";

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
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-3">
          Enter your Year/Make/Model to get an approximate body-style preview, spin it, switch views (cabin, engine,
          undercarriage), then tap the part that&rsquo;s giving you trouble. We&rsquo;ll tell you the exact service to book —
          no technical vocabulary required.
        </p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-cyan/50 mb-8">
          // parametric body matched to your year/make/model — real metal & glass reflections, shadow-mapped ground shadow; recolor the paint, spin the wheels, open the doors & hood, toggle X-Ray to reveal the engine, cabin & harness inside
        </p>

        {/* YMM controls */}
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            inputMode="numeric"
            placeholder="Year (e.g. 2018)"
            className="bg-titanium border border-cyan/30 px-4 py-3 font-mono text-xs uppercase tracking-wider text-data placeholder:text-cyan/30 focus:border-cyan"
            aria-label="Year"
          />
          <input
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="Make (e.g. Honda)"
            className="bg-titanium border border-cyan/30 px-4 py-3 font-mono text-xs uppercase tracking-wider text-data placeholder:text-cyan/30 focus:border-cyan"
            aria-label="Make"
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Model (e.g. Civic)"
            className="bg-titanium border border-cyan/30 px-4 py-3 font-mono text-xs uppercase tracking-wider text-data placeholder:text-cyan/30 focus:border-cyan"
            aria-label="Model"
          />
        </div>

        {/* body style controls */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-cyan/60">Body:</span>
          {BODY_STYLES.map((b) => (
            <button
              key={b.id}
              onClick={() => setBodyStyle(b.id)}
              className={`font-mono text-[10px] uppercase px-2.5 py-1.5 border ${bodyStyle === b.id ? "border-cyan text-cyan bg-cyan/10" : "border-cyan/20 text-muted-foreground hover:text-cyan"}`}
            >
              {b.label}
            </button>
          ))}
        </div>
        {/* animation controls */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            onClick={() => setXray((x) => !x)}
            aria-pressed={xray}
            className={`flex items-center gap-1.5 font-mono text-[10px] uppercase px-2.5 py-1.5 border ${xray ? "border-heat text-heat bg-heat/10" : "border-cyan/20 text-muted-foreground hover:text-cyan"}`}
          >
            <Scan className="w-3.5 h-3.5" /> {xray ? "X-Ray On" : "X-Ray"}
          </button>
          <button
            onClick={() => setSpinning((s) => !s)}
            aria-pressed={spinning}
            className={`flex items-center gap-1.5 font-mono text-[10px] uppercase px-2.5 py-1.5 border ${spinning ? "border-cyan text-cyan bg-cyan/10" : "border-cyan/20 text-muted-foreground hover:text-cyan"}`}
          >
            <CircleDot className="w-3.5 h-3.5" /> {spinning ? "Wheels Spinning" : "Spin Wheels"}
          </button>
          <button
            onClick={() => setDoorsOpen((d) => !d)}
            aria-pressed={doorsOpen}
            className={`flex items-center gap-1.5 font-mono text-[10px] uppercase px-2.5 py-1.5 border ${doorsOpen ? "border-cyan text-cyan bg-cyan/10" : "border-cyan/20 text-muted-foreground hover:text-cyan"}`}
          >
            <DoorOpen className="w-3.5 h-3.5" /> {doorsOpen ? "Close Doors" : "Open Doors"}
          </button>
          <button
            onClick={() => setHoodOpen((h) => !h)}
            aria-pressed={hoodOpen}
            className={`flex items-center gap-1.5 font-mono text-[10px] uppercase px-2.5 py-1.5 border ${hoodOpen ? "border-cyan text-cyan bg-cyan/10" : "border-cyan/20 text-muted-foreground hover:text-cyan"}`}
          >
            <Wrench className="w-3.5 h-3.5" /> {hoodOpen ? "Close Hood" : "Open Hood"}
          </button>
        </div>

        {/* paint color picker */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan/60">
            <Palette className="w-3.5 h-3.5" /> Paint:
          </span>
          {PAINT_SWATCHES.map((s) => (
            <button
              key={s.hex}
              onClick={() => setPaint(s.hex)}
              title={s.name}
              aria-label={`Paint ${s.name}`}
              className={`w-7 h-7 border-2 ${paint === s.hex ? "border-cyan scale-110" : "border-cyan/20"} transition-transform`}
              style={{ background: s.hex }}
            />
          ))}
          <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan/60 cursor-pointer">
            custom
            <input
              type="color"
              value={paint}
              onChange={(e) => setPaint(e.target.value)}
              className="w-7 h-7 bg-transparent border-0 cursor-pointer p-0"
              aria-label="Custom paint color"
            />
          </label>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div className="relative">
            {noWebGL ? (
              <div className="relative bg-blueprint/40 border border-cyan/20 h-[360px] sm:h-[440px] flex flex-col items-center justify-center text-center px-6">
                <CarIcon className="w-9 h-9 text-cyan/60 mb-3" />
                <div className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-1">// 3D preview unavailable</div>
                <p className="font-body text-xs text-muted-foreground max-w-xs mb-4">
                  Your browser blocked the 3D renderer (WebGL). You can still read the Year/Make/Model and tap a zone below to find your service.
                </p>
                <Link to="/#intake" className="inline-flex items-center gap-1.5 bg-cyan text-titanium font-mono text-xs uppercase px-4 py-2 hover:glow-cyan">
                  Book this service <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div ref={mountRef} className="relative bg-blueprint/40 border border-cyan/20 h-[360px] sm:h-[440px] overflow-hidden" />
            )}
            {/* view tabs */}
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
              {VIEW_TABS.map((v) => {
                const Icon = v.Icon;
                return (
                  <button
                    key={v.id}
                    onClick={() => { setView(v.id); if (v.id !== "exterior") setSel(null); }}
                    className={`flex items-center gap-1.5 font-mono text-[10px] uppercase px-2.5 py-1.5 border ${view === v.id ? "bg-cyan text-titanium border-cyan" : "bg-titanium/80 border-cyan/30 text-cyan hover:glow-cyan"}`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {v.label}
                  </button>
                );
              })}
            </div>
            <span className="absolute top-3 left-3 flex items-center gap-1.5 font-mono text-[10px] text-cyan/70 pointer-events-none"><RotateCw className="w-3.5 h-3.5" /> drag to spin</span>
            {xrSupported && (
              <button onClick={enterVR} className="absolute top-3 right-3 flex items-center gap-1.5 border border-cyan/40 bg-titanium/80 backdrop-blur px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan hover:glow-cyan">
                <Glasses className="w-3.5 h-3.5" /> {inVR ? "Exit VR" : "Enter VR"}
              </button>
            )}
          </div>

          <div className="bg-titanium border border-cyan/20 p-6 min-h-[300px]">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">// Previewing</div>
            <div className="font-heading text-lg uppercase text-cyan mb-1 leading-tight">{caption}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-cyan/60 mb-5">approx. style: {styleLabel}</div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4 border-t border-cyan/10 pt-4">
              {view === "exterior" ? "// Selected Zone" : "// In This View"}
            </div>
            {view === "exterior" && !sel ? (
              <div className="text-center font-mono text-sm text-muted-foreground/50 py-12">tap a hotspot on the model →</div>
            ) : view === "exterior" && sel ? (
              <div className="space-y-4">
                <div className="font-heading text-2xl uppercase text-data">{selected?.label}</div>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{selected?.cat}</p>
                <Link to="/#intake" className="inline-flex items-center gap-1.5 bg-cyan text-titanium font-mono text-xs uppercase px-5 py-3 hover:glow-cyan">
                  Book this service <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                {view === "interior" && "Cabin view: dash, cluster, seats and steering column. Tap Exterior to select a service zone like the cluster or ignition."}
                {view === "engine" && "Engine bay view: block, valve cover, coils and radiator. Tap Exterior to select the Engine Bay zone and book a swap, gasket or harness job."}
                {view === "under" && "Undercarriage view: exhaust, crossmembers and suspension arms — the chassis we rebuild. Tap Exterior to select Wheels/Brakes."}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}