import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { EphemerisPoint } from '../types';
import './LunarSurface3D.css';

export interface LunarSurfaceMarker {
  id: string;
  name: string;
  lat: number;
  lon: number;
  selected?: boolean;
}

export interface LunarSurface3DProps {
  markers?: LunarSurfaceMarker[];
  selectedSite?: LunarSurfaceMarker;
  onSelectSite?: (site: LunarSurfaceMarker) => void;
  language?: 'en' | 'tr';
  gridVisible?: boolean;
  liftShadows?: boolean;
  fineTexture?: boolean;
  rangeRings?: boolean;
  preset?: 'survey' | 'landscape' | 'physical';
  moment?: EphemerisPoint;
}

const EMPTY_MARKERS: LunarSurfaceMarker[] = [];

/** Interactive global lunar globe. Relief is deliberately illustrative, not DEM-derived. */
const LunarSurface3D: React.FC<LunarSurface3DProps> = ({ markers = EMPTY_MARKERS, selectedSite, onSelectSite,
  language = 'en', gridVisible = true, liftShadows = false, fineTexture = true,
  rangeRings = false, preset = 'survey', moment,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<(() => void) | null>(null);
  const viewRef = useRef({ x: 0, y: 0, z: 4.3 });
  const presetRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [textureError, setTextureError] = useState(false);
  const tr = language === 'tr';

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111416');
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.15, 4.3);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setUnavailable(true);
      return;
    }
    setUnavailable(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 600 ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const root = new THREE.Group();
    root.rotation.set(viewRef.current.x, viewRef.current.y, 0);
    camera.position.z = presetRef.current !== preset ? (preset === 'landscape' ? 3.3 : 4.3) : viewRef.current.z;
    presetRef.current = preset;
    scene.add(root);
    const geometry = new THREE.SphereGeometry(1, 160, 112);
    const moon = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }));
    root.add(moon);

    const grid = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({ color: '#737a7b', transparent: true, opacity: 0.3 });
    const toPoint = (lat: number, lon: number, r = 1.018) => {
      const a = THREE.MathUtils.degToRad(lat), b = THREE.MathUtils.degToRad(lon);
      return new THREE.Vector3(r * Math.cos(a) * Math.cos(b), r * Math.sin(a), r * Math.cos(a) * Math.sin(b));
    };
    [-60, -30, 0, 30, 60].forEach(lat => {
      const pts: THREE.Vector3[] = [];
      for (let lon = -180; lon <= 180; lon += 3) pts.push(toPoint(lat, lon));
      grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    });
    for (let lon = -180; lon < 180; lon += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 3) pts.push(toPoint(lat, lon));
      grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    root.add(grid);
    grid.visible = gridVisible;

    // Angular distance on a sphere, not terrain-derived ground range.
    if (rangeRings && selectedSite) {
      const center = toPoint(selectedSite.lat, selectedSite.lon, 1).normalize();
      const tangent = new THREE.Vector3(0, 1, 0).cross(center);
      if (tangent.lengthSq() < 0.001) tangent.set(1, 0, 0);
      tangent.normalize();
      const bitangent = center.clone().cross(tangent).normalize();
      [15, 30].forEach(degrees => {
        const angle = THREE.MathUtils.degToRad(degrees);
        const points = Array.from({ length: 181 }, (_, i) => {
          const theta = i * Math.PI / 90;
          return center.clone().multiplyScalar(Math.cos(angle))
            .addScaledVector(tangent, Math.sin(angle) * Math.cos(theta))
            .addScaledVector(bitangent, Math.sin(angle) * Math.sin(theta)).multiplyScalar(1.022);
        });
        root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color: '#f3c66a', transparent: true, opacity: 0.55 })));
      });
    }

    const markerObjects: { object: THREE.Mesh; marker: LunarSurfaceMarker }[] = [];
    const addMarker = (marker: LunarSurfaceMarker) => {
      const selected = marker.selected || marker.id === selectedSite?.id;
      const object = new THREE.Mesh(new THREE.SphereGeometry(selected ? 0.025 : 0.017, 12, 10),
        new THREE.MeshBasicMaterial({ color: selected ? '#f3c66a' : '#d0d2cc' }));
      object.position.copy(toPoint(marker.lat, marker.lon, 1.025));
      object.userData.marker = marker;
      root.add(object);
      markerObjects.push({ object, marker });
    };
    markers.forEach(addMarker);
    if (selectedSite && !markers.some(m => m.id === selectedSite.id)) addMarker({ ...selectedSite, selected: true });

    scene.add(new THREE.AmbientLight('#bfc4c7', liftShadows ? 1.5 : preset === 'physical' ? 0.04 : 0.35));
    const sun = new THREE.DirectionalLight('#fff0d5', 2.6);
    sun.position.set(-3, 2, 4);
    scene.add(sun);
    // Keep ephemeris lighting in lunar coordinates while the globe is rotated.
    scene.remove(sun);
    root.add(sun);
    root.add(sun.target);
    const render = () => {
      if (document.hidden) return;
      viewRef.current = { x: root.rotation.x, y: root.rotation.y, z: camera.position.z };
      renderer.render(scene, camera);
    };
    let disposed = false;
    setTextureError(false);
    const texture = new THREE.TextureLoader().load(`${process.env.PUBLIC_URL}/textures/moon-lroc-2k.jpg`, loaded => {
      if (disposed) { loaded.dispose(); return; }
      loaded.colorSpace = THREE.SRGBColorSpace;
      moon.material.map = loaded;
      moon.material.vertexColors = false;
      moon.material.color.set('#ffffff');
      moon.material.needsUpdate = true;
      render();
    }, undefined, () => { if (!disposed) setTextureError(true); });
    const normal = new THREE.TextureLoader().load(`${process.env.PUBLIC_URL}/textures/moon_normal.jpg`, loaded => {
      if (disposed) { loaded.dispose(); return; }
      moon.material.normalMap = loaded; moon.material.normalScale.set(0.7, 0.7); moon.material.needsUpdate = true; render();
    }, undefined, () => { if (!disposed) setTextureError(true); });
    const resize = () => {
      const width = host.clientWidth, height = host.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      render();
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(host);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', render);
    resize();

    let down = false, moved = false, lastX = 0, lastY = 0;
    const onDown = (e: PointerEvent) => { down = true; moved = false; lastX = e.clientX; lastY = e.clientY; renderer.domElement.setPointerCapture?.(e.pointerId); renderer.domElement.focus(); setDragging(true); };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      root.rotation.y += dx * 0.006;
      root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + dy * 0.006, -1.45, 1.45);
      lastX = e.clientX; lastY = e.clientY;
      render();
    };
    const onUp = () => { down = false; setDragging(false); };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); camera.position.z = THREE.MathUtils.clamp(camera.position.z + e.deltaY * 0.002, 2.1, 7); render(); };
    const reset = () => { root.rotation.set(0, 0, 0); camera.position.z = preset === 'landscape' ? 3.3 : 4.3; render(); };
    resetRef.current = reset;
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': root.rotation.y -= 0.1; break;
        case 'ArrowRight': root.rotation.y += 0.1; break;
        case 'ArrowUp': root.rotation.x = Math.max(-1.45, root.rotation.x - 0.1); break;
        case 'ArrowDown': root.rotation.x = Math.min(1.45, root.rotation.x + 0.1); break;
        case '+': case '=': camera.position.z = Math.max(2.1, camera.position.z - 0.2); break;
        case '-': case '_': camera.position.z = Math.min(7, camera.position.z + 0.2); break;
        case 'Home': case 'r': case 'R': reset(); break;
        default: return;
      }
      e.preventDefault(); render();
    };
    const onClick = (e: MouseEvent) => {
      if (moved || !onSelectSite) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(markerObjects.map(m => m.object))[0];
      const surfaceHit = ray.intersectObject(moon)[0];
      if (hit && surfaceHit && surfaceHit.distance < hit.distance) return;
      if (hit?.object.userData.marker) onSelectSite(hit.object.userData.marker as LunarSurfaceMarker);
    };
    // Selection changes orientation only. Never derive scientific results from the globe.
    let flightFrame = 0;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (selectedSite) {
      const point = toPoint(selectedSite.lat, selectedSite.lon, 1).normalize();
      const goal = new THREE.Quaternion().setFromUnitVectors(point, new THREE.Vector3(0, 0, 1));
      if (reduced) { root.quaternion.copy(goal); render(); }
      else {
        const start = root.quaternion.clone();
        const began = performance.now();
        const fly = (now: number) => {
          if (document.hidden || down) return;
          const progress = Math.min(1, (now - began) / 900);
          root.quaternion.slerpQuaternions(start, goal, 1 - Math.pow(1 - progress, 3));
          render();
          if (progress < 1) flightFrame = requestAnimationFrame(fly);
        };
        flightFrame = requestAnimationFrame(fly);
      }
    }
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', tr ? 'Sentetik Ay küresi. Ok tuşları: döndür; artı/eksi: yakınlaştır; Home: sıfırla.' : 'Synthetic lunar globe. Arrow keys: rotate; plus/minus: zoom; Home: reset.');
    canvas.addEventListener('keydown', onKey);
    const onContextLost = (e: Event) => { e.preventDefault(); setUnavailable(true); };
    const onContextRestored = () => { setUnavailable(false); render(); };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false }); canvas.addEventListener('click', onClick);
    render();
    return () => {
      resetRef.current = null;
      cancelAnimationFrame(flightFrame);
      observer?.disconnect(); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', render);
      canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('click', onClick);
      root.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(material => material.dispose());
        }
      });
      disposed = true; texture.dispose(); normal.dispose(); renderer.dispose(); canvas.remove();
    };
  }, [markers, selectedSite, onSelectSite, gridVisible, liftShadows, fineTexture, rangeRings, preset, moment, tr]);

  return <section className="lunar3d" aria-label={tr ? 'Etkileşimli 3B Ay küresi' : 'Interactive 3D lunar globe'}>
    <div className="lunar3d-stage" ref={mountRef} />
    {unavailable && <div className="lunar3d-fallback" role="status">{tr ? '3B görünüm kullanılamıyor. WebGL gerekli. Konumlar için 2B haritayı kullanın.' : '3D view unavailable. WebGL required. Use the 2D map for site locations.'}</div>}
    {textureError && <p className="lunar3d-texture-error" role="status">{tr ? 'Bir veya daha fazla Ay dokusu kullanılamıyor. Görsel ayrıntılar eksik.' : 'One or more Moon textures unavailable. Visual detail incomplete.'}</p>}
    <div className="lunar3d-heading"><span>{tr ? 'KÜRESEL GÖRÜNÜM' : 'GLOBAL VIEW'}</span><strong>{tr ? 'Ay · 3B' : 'Moon · 3D'}</strong></div>
    <button type="button" className="lunar3d-reset" disabled={unavailable} onClick={() => resetRef.current?.()}>{tr ? 'Görünümü sıfırla' : 'Reset view'}</button>
    <div className="lunar3d-legend"><i /> {tr ? 'Seçili' : 'Selected'} <i className="candidate" /> {tr ? 'Aday' : 'Candidate'}</div>
    <div className="lunar3d-note">{tr ? 'Temsili küre · yükseklik ölçümü değil' : 'Illustrative globe · not an elevation measurement'}<br />{tr ? 'Işık temsilidir; bilimsel gölge hesabı değildir' : 'Lighting is illustrative; not a scientific shadow calculation'}</div>
    <div className={`lunar3d-hint ${dragging ? 'is-dragging' : ''}`}>{tr ? 'Sürükle / ok tuşları: döndür · +/−: yakınlaştır' : 'Drag / arrow keys: rotate · +/−: zoom'}</div>
  </section>;
};

export default LunarSurface3D;
