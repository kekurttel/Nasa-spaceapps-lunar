import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { EphemerisPoint, SiteRequest } from '../types';
import './MeasuredTerrain.css';

export interface MeasuredTerrainProps {
  site: SiteRequest;
  moment?: EphemerisPoint;
  language: 'tr' | 'en';
}

type Dem = {
  rows: number; cols: number; spacing: number; line0: number; sample0: number;
  scale: number; values: DataView;
};
type View = 'orbit' | 'ground';
type Status = 'loading' | 'ready' | 'coverage' | 'download' | 'webgl';
type Stats = { height: number; min: number; max: number; partial: boolean };
const RADIUS = 1737400;
const RAD = Math.PI / 180;
const HALF = 20000;
const STEP = 200;
const COUNT = HALF * 2 / STEP + 1;
let demRequest: Promise<Dem> | undefined;

/** Local export format, matching lmNasa-main/web/src/terrain.ts. Little-endian throughout. */
export function parseMeasuredDem(buffer: ArrayBuffer): Dem {
  if (buffer.byteLength < 24) throw new Error('Truncated DEM header');
  const v = new DataView(buffer);
  const rows = v.getUint32(0, true), cols = v.getUint32(4, true);
  const spacing = v.getFloat32(8, true), scale = v.getFloat32(20, true);
  const line0 = v.getFloat32(12, true), sample0 = v.getFloat32(16, true);
  if (rows < 2 || cols < 2 || buffer.byteLength !== 24 + rows * cols * 2 ||
      ![spacing, scale, line0, sample0].every(Number.isFinite) || spacing <= 0 || scale <= 0) {
    throw new Error('Invalid DEM dimensions or scale');
  }
  return { rows, cols, spacing, line0, sample0, scale, values: new DataView(buffer, 24) };
}

function loadDem(): Promise<Dem> {
  if (!demRequest) {
    demRequest = fetch(`${process.env.PUBLIC_URL || ''}/terrain-data/pole_dem.bin`)
      .then(response => {
        if (!response.ok) throw new Error(`DEM HTTP ${response.status}`);
        return response.arrayBuffer();
      }).then(parseMeasuredDem).catch(error => {
        demRequest = undefined; // A later mount can retry a failed download.
        throw error;
      });
  }
  return demRequest;
}

/** No extrapolation; missing PDS signed-int16 values never become terrain. */
function sample(dem: Dem, x: number, y: number): number | null {
  const col = dem.sample0 + x / dem.spacing, row = dem.line0 - y / dem.spacing;
  const c = Math.floor(col), r = Math.floor(row);
  if (c < 0 || r < 0 || c + 1 >= dem.cols || r + 1 >= dem.rows) return null;
  const indices = [r * dem.cols + c, r * dem.cols + c + 1,
    (r + 1) * dem.cols + c, (r + 1) * dem.cols + c + 1];
  const h = indices.map(i => dem.values.getInt16(i * 2, true));
  if (h.some(value => value <= -32767)) return null;
  const a = col - c, b = row - r;
  return dem.scale * (h[0] * (1 - a) * (1 - b) + h[1] * a * (1 - b) +
    h[2] * (1 - a) * b + h[3] * a * b);
}

const copy = {
  en: {
    title: 'Measured lunar terrain', orbit: 'Orbit', ground: 'Ground', reset: 'Reset view',
    loading: 'Loading local NASA / LRO LOLA elevation data…',
    coverage: 'No measured terrain at this coordinate. Local coverage is the south-polar DEM only; no synthetic terrain is substituted.',
    download: 'Local terrain data unavailable or invalid. No synthetic terrain is substituted.',
    webgl: '3D rendering unavailable. This view requires WebGL.',
    controls: 'Drag: look / rotate · Wheel: orbit zoom · Arrows: look · WASD: ground movement · R: reset',
    source: 'NASA / LRO LOLA · 200 m source grid · 200 m mesh · vertical scale 1:1',
    datum: 'Elevation relative to lunar radius 1,737.4 km. Spherical curvature included.',
    extent: '40 × 40 km projected window', partial: 'Window clipped to measured coverage; gaps are not filled.',
    height: 'Site elevation', range: 'Window elevation', sun: 'Sun elevation / azimuth',
    noSun: 'No ephemeris: neutral inspection lighting, not simulated sunlight.',
    lighting: 'Sun direction from selected ephemeris. Local mesh shadows only; no distant-horizon visibility model. Faint inspection fill.',
    groundNote: 'Eye height 2 m. 200 m terrain cannot resolve rocks, rover hazards or exact landing slopes.',
    attribution: 'Data / license', north: 'North is screen-top in initial orbit view.',
    viewport: 'Interactive measured lunar terrain. Use arrow keys to look, WASD to move in ground view, R to reset.',
  },
  tr: {
    title: 'Ölçülmüş Ay arazisi', orbit: 'Yörünge', ground: 'Yüzey', reset: 'Görünümü sıfırla',
    loading: 'Yerel NASA / LRO LOLA yükseklik verisi yükleniyor…',
    coverage: 'Bu koordinatta ölçülmüş arazi yok. Yerel veri yalnızca güney kutbu DEM alanını kapsar; yapay arazi gösterilmez.',
    download: 'Yerel arazi verisi kullanılamıyor veya geçersiz. Yapay arazi gösterilmez.',
    webgl: '3B görüntüleme kullanılamıyor. Bu görünüm WebGL gerektirir.',
    controls: 'Sürükle: bak / döndür · Tekerlek: yörüngede yakınlaş · Oklar: bak · WASD: yüzeyde hareket · R: sıfırla',
    source: 'NASA / LRO LOLA · 200 m kaynak ızgara · 200 m ağ · düşey ölçek 1:1',
    datum: 'Yükseklik referansı: 1.737,4 km Ay yarıçapı. Küresel eğrilik dahil.',
    extent: '40 × 40 km izdüşüm penceresi', partial: 'Pencere ölçüm sınırında kesildi; veri boşlukları doldurulmaz.',
    height: 'Konum yüksekliği', range: 'Pencere yüksekliği', sun: 'Güneş yüksekliği / azimutu',
    noSun: 'Efemeris yok: nötr inceleme ışığı; Güneş benzetimi değil.',
    lighting: 'Güneş yönü seçili efemeristen. Yalnızca yerel ağ gölgeleri; uzak ufuk görünürlük modeli yok. Hafif inceleme ışığı.',
    groundNote: 'Göz yüksekliği 2 m. 200 m arazi; kayaları, gezgin tehlikelerini veya kesin iniş eğimlerini çözemez.',
    attribution: 'Veri / lisans', north: 'İlk yörünge görünümünde kuzey ekranın üstündedir.',
    viewport: 'Etkileşimli ölçülmüş Ay arazisi. Oklarla bakın, yüzeyde WASD ile hareket edin, R ile sıfırlayın.',
  },
};

/** Real LOLA elevations only. Three coordinates: x east, y up, z south; scene units metres. */
export default function MeasuredTerrain({ site, moment, language }: MeasuredTerrainProps) {
  const host = useRef<HTMLDivElement>(null);
  const momentRef = useRef(moment);
  const viewRef = useRef<View>('orbit');
  const resetRef = useRef<() => void>(() => undefined);
  const [view, setView] = useState<View>('orbit');
  const [status, setStatus] = useState<Status>('loading');
  const [stats, setStats] = useState<Stats | null>(null);
  momentRef.current = moment;
  viewRef.current = view;
  const text = copy[language];

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    setStatus('loading');
    setStats(null);
    const lat = site.lat, lon = site.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat >= 0 || lon < -180 || lon > 180) {
      setStatus('coverage');
      return;
    }
    loadDem().then(dem => {
      if (disposed || !host.current) return;
      const rho = 2 * RADIUS * Math.tan((90 + lat) * RAD / 2);
      const cx = rho * Math.sin(lon * RAD), cy = rho * Math.cos(lon * RAD);
      const h0 = sample(dem, cx, cy);
      if (h0 === null) { setStatus('coverage'); return; }
      const la = lat * RAD, lo = lon * RAD;
      const up = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la));
      const east = new THREE.Vector3(-Math.sin(lo), Math.cos(lo), 0);
      const north = new THREE.Vector3(-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la));
      const origin = up.clone().multiplyScalar(RADIUS + h0);
      const positions = new Float32Array(COUNT * COUNT * 3);
      const valid = new Uint8Array(COUNT * COUNT);
      const indices: number[] = [];
      let min = Infinity, max = -Infinity;
      for (let row = 0; row < COUNT; row++) {
        for (let col = 0; col < COUNT; col++) {
          const k = row * COUNT + col;
          const x = cx + col * STEP - HALF, y = cy + HALF - row * STEP;
          const h = sample(dem, x, y);
          if (h === null) continue;
          valid[k] = 1;
          min = Math.min(min, h); max = Math.max(max, h);
          const r = Math.hypot(x, y);
          const latitude = -Math.PI / 2 + 2 * Math.atan(r / (2 * RADIUS));
          const longitude = Math.atan2(x, y);
          const p = new THREE.Vector3(Math.cos(latitude) * Math.cos(longitude),
            Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude))
            .multiplyScalar(RADIUS + h).sub(origin);
          positions[k * 3] = p.dot(east);
          positions[k * 3 + 1] = p.dot(up);
          positions[k * 3 + 2] = -p.dot(north);
        }
      }
      for (let row = 0; row < COUNT - 1; row++) {
        for (let col = 0; col < COUNT - 1; col++) {
          const a = row * COUNT + col, b = a + 1, c = a + COUNT, d = c + 1;
          if (valid[a] && valid[c] && valid[b]) indices.push(a, c, b);
          if (valid[b] && valid[c] && valid[d]) indices.push(b, c, d);
        }
      }
      if (!indices.length) { setStatus('coverage'); return; }
      const container = host.current;
      let renderer: THREE.WebGLRenderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
      catch { setStatus('webgl'); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x05080c);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, 1, 0.25, 200000);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({ color: 0xaaa9a4, roughness: 1, metalness: 0 });
      const terrain = new THREE.Mesh(geometry, material);
      terrain.receiveShadow = true; terrain.castShadow = true;
      scene.add(terrain);
      const fill = new THREE.AmbientLight(0xc6d3e0, 0.12);
      const sun = new THREE.DirectionalLight(0xfff4df, 2.6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -32000, right: 32000, top: 32000, bottom: -32000, near: 1, far: 160000 });
      sun.shadow.bias = -0.00005;
      sun.shadow.normalBias = 3;
      sun.shadow.camera.updateProjectionMatrix();
      scene.add(fill, sun, sun.target);
      // Site marker, above the measured centre; not a fabricated terrain feature.
      const markerGeometry = new THREE.SphereGeometry(65, 12, 8);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x79e5d2 });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(0, 100, 0);
      scene.add(marker);
      let yaw = 0, pitch = 0.65, distance = 43000;
      const ground = new THREE.Vector3(0, 2, 0);
      const keys = new Set<string>();
      const reset = () => { yaw = 0; pitch = viewRef.current === 'ground' ? 0.04 : 0.65; distance = 43000; ground.set(0, 2, 0); keys.clear(); };
      resetRef.current = reset;
      let previousView = viewRef.current;
      reset();
      let pointer: { id: number; x: number; y: number } | undefined;
      const down = (event: PointerEvent) => {
        if (event.button !== 0) return;
        container.focus();
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        container.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!pointer || pointer.id !== event.pointerId) return;
        yaw -= (event.clientX - pointer.x) * 0.005;
        pitch += (event.clientY - pointer.y) * 0.005 * (viewRef.current === 'orbit' ? 1 : -1);
        pointer.x = event.clientX; pointer.y = event.clientY;
      };
      const release = () => { pointer = undefined; };
      const wheel = (event: WheelEvent) => {
        if (viewRef.current !== 'orbit') return;
        event.preventDefault();
        distance = THREE.MathUtils.clamp(distance * Math.exp(event.deltaY * 0.001), 2500, 100000);
      };
      const keydown = (event: KeyboardEvent) => {
        const key = event.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'r'].includes(key)) {
          event.preventDefault(); keys.add(key);
          if (key === 'r') reset();
        }
      };
      const keyup = (event: KeyboardEvent) => { keys.delete(event.key.toLowerCase()); };
      const blur = () => { keys.clear(); pointer = undefined; };
      container.addEventListener('pointerdown', down);
      container.addEventListener('pointermove', move);
      container.addEventListener('pointerup', release);
      container.addEventListener('pointercancel', release);
      container.addEventListener('lostpointercapture', release);
      container.addEventListener('wheel', wheel, { passive: false });
      container.addEventListener('keydown', keydown);
      container.addEventListener('keyup', keyup);
      container.addEventListener('blur', blur);
      const resize = () => {
        const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
        renderer.setSize(width, height);
        camera.aspect = width / height; camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container); resize();
      const clock = new THREE.Clock();
      const ray = new THREE.Raycaster();
      const direction = new THREE.Vector3();
      const rayOrigin = new THREE.Vector3();
      let frame = 0;
      const render = () => {
        const dt = Math.min(clock.getDelta(), 0.05);
        if (previousView !== viewRef.current) { previousView = viewRef.current; reset(); }
        yaw += ((keys.has('arrowleft') ? 1 : 0) - (keys.has('arrowright') ? 1 : 0)) * dt;
        pitch += ((keys.has('arrowup') ? 1 : 0) - (keys.has('arrowdown') ? 1 : 0)) * dt;
        pitch = THREE.MathUtils.clamp(pitch, viewRef.current === 'orbit' ? 0.08 : -1.3, 1.4);
        marker.visible = viewRef.current === 'orbit';
        if (viewRef.current === 'orbit') {
          camera.position.set(distance * Math.sin(yaw) * Math.cos(pitch), distance * Math.sin(pitch), distance * Math.cos(yaw) * Math.cos(pitch));
          camera.lookAt(0, 0, 0);
        } else {
          const forward = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
          const right = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
          if (forward || right) {
            const speed = 160 * dt / Math.max(1, Math.hypot(forward, right));
            const x = ground.x + (-Math.sin(yaw) * forward + Math.cos(yaw) * right) * speed;
            const z = ground.z + (-Math.cos(yaw) * forward - Math.sin(yaw) * right) * speed;
            rayOrigin.set(x, 30000, z);
            ray.set(rayOrigin, direction.set(0, -1, 0));
            const hit = ray.intersectObject(terrain, false)[0];
            if (hit) ground.set(x, hit.point.y + 2, z); // Never walk onto missing cells.
          }
          camera.position.copy(ground);
          direction.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
          camera.lookAt(ground.clone().add(direction));
        }
        const current = momentRef.current;
        const hasSun = current && Number.isFinite(current.sun_elevation) && Number.isFinite(current.sun_azimuth);
        const elevation = hasSun ? current.sun_elevation * RAD : 45 * RAD;
        const azimuth = hasSun ? current.sun_azimuth * RAD : 315 * RAD;
        sun.position.set(Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), -Math.cos(elevation) * Math.cos(azimuth)).multiplyScalar(60000);
        sun.intensity = hasSun ? 2.6 : 1.8;
        fill.intensity = hasSun ? 0.12 : 0.4;
        renderer.render(scene, camera);
        frame = window.requestAnimationFrame(render);
      };
      setStats({ height: h0, min, max, partial: valid.some(value => !value) });
      setStatus('ready');
      render();
      cleanup = () => {
        window.cancelAnimationFrame(frame); observer.disconnect();
        container.removeEventListener('pointerdown', down);
        container.removeEventListener('pointermove', move);
        container.removeEventListener('pointerup', release);
        container.removeEventListener('pointercancel', release);
        container.removeEventListener('lostpointercapture', release);
        container.removeEventListener('wheel', wheel);
        container.removeEventListener('keydown', keydown);
        container.removeEventListener('keyup', keyup);
        container.removeEventListener('blur', blur);
        geometry.dispose(); material.dispose(); markerGeometry.dispose(); markerMaterial.dispose();
        sun.shadow.dispose(); renderer.dispose(); renderer.domElement.remove();
        resetRef.current = () => undefined;
      };
    }).catch(() => { if (!disposed) setStatus('download'); });
    return () => { disposed = true; cleanup?.(); };
  }, [site.lat, site.lon]);

  const hasSun = moment && Number.isFinite(moment.sun_elevation) && Number.isFinite(moment.sun_azimuth);
  const format = (value: number) => Math.round(value).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US');
  return (
    <section className="measured-terrain" aria-label={text.title}>
      <header className="measured-terrain__header">
        <div><h3>{text.title}</h3><p>{site.name || `${site.lat.toFixed(3)}°, ${site.lon.toFixed(3)}°`}</p></div>
        <div className="measured-terrain__buttons" role="group" aria-label={text.title}>
          <button type="button" aria-pressed={view === 'orbit'} onClick={() => setView('orbit')}>{text.orbit}</button>
          <button type="button" aria-pressed={view === 'ground'} onClick={() => setView('ground')}>{text.ground}</button>
          <button type="button" onClick={() => resetRef.current()}>{text.reset}</button>
        </div>
      </header>
      <div className="measured-terrain__stage">
        <div ref={host} className="measured-terrain__viewport" tabIndex={0} role="group" aria-label={text.viewport} />
        {status !== 'ready' && <p className="measured-terrain__message" role="status">{text[status]}</p>}
        {status === 'ready' && <span className="measured-terrain__badge">{text.extent}</span>}
      </div>
      <div className="measured-terrain__details" aria-live="polite">
        <p className="measured-terrain__source">{text.source}</p>
        {stats && <p>{text.height}: {format(stats.height)} m · {text.range}: {format(stats.min)} / {format(stats.max)} m</p>}
        <p>{text.datum}</p>
        {stats?.partial && <p className="measured-terrain__warning">{text.partial}</p>}
        <p>{hasSun ? `${text.sun}: ${moment.sun_elevation.toFixed(2)}° / ${moment.sun_azimuth.toFixed(2)}° · ${moment.datetime}` : text.noSun}</p>
        {hasSun && <p>{text.lighting}</p>}
        <p>{view === 'ground' ? text.groundNote : text.north}</p>
        <p>{text.controls}</p>
        <a href={`${process.env.PUBLIC_URL || ''}/terrain-data/ATTRIBUTION.md`} target="_blank" rel="noreferrer">{text.attribution}</a>
      </div>
    </section>
  );
}
