// @purpose: Dựng vòm bầu trời HorizonSkyDome, preset ánh sáng và cấu hình khí quyển theo giờ Việt Nam
import * as THREE from 'three';

export const LIGHTING_PRESETS = {
  liebherr_studio: {
    id: 'liebherr_studio', name: 'Engineering Studio (Thời Gian Thực Việt Nam)',
    skyColor: 0x6299cb, horizonColor: 0xe4e2d8, sunColor: 0xfff6dc, sunIntensity: 2.75, sunPosition: [28, 44, 24],
    fillColor: 0x9ec8f5, fillIntensity: 0.85, fogNear: 68, fogFar: 205, fogDensity: 0.0001,
    exposure: 1.18, envIntensity: 1.18, backgroundBlur: 0.25, solidBackground: 0xe4e2d8
  },
  overcast: {
    id: 'overcast', name: 'Daylight Test Pad (Sân Bê Tông Ban Ngày)',
    skyColor: 0x8395aa, horizonColor: 0xdde3ea, sunColor: 0xfffbeb, sunIntensity: 2.5, sunPosition: [24, 46, 28],
    fillColor: 0x93c5fd, fillIntensity: 0.8, fogNear: 68, fogFar: 205, fogDensity: 0.0001,
    exposure: 1.16, envIntensity: 1.1, backgroundBlur: 0.15, solidBackground: 0xdde3ea
  },
  print_plan: {
    id: 'print_plan', name: 'Lift Plan CAD Sheet (Bản Vẽ ASME Nền Sáng)',
    skyColor: 0xe5ebf2, horizonColor: 0xeef2f6, sunColor: 0xffffff, sunIntensity: 1.75, sunPosition: [20, 52, 22],
    fillColor: 0xcbd5e1, fillIntensity: 0.85, fogNear: 110, fogFar: 260, fogDensity: 0.00005,
    exposure: 1.08, envIntensity: 0.95, backgroundBlur: 0.0, solidBackground: 0xeef2f6
  },
  sunset: {
    id: 'sunset', name: 'Warm Industrial Bay (Ánh Sáng Xưởng Ấm / Hoàng Hôn)',
    skyColor: 0x3b486e, horizonColor: 0xd49258, sunColor: 0xff9e44, sunIntensity: 2.8, sunPosition: [34, 20, 26],
    fillColor: 0x38bdf8, fillIntensity: 0.6, fogNear: 65, fogFar: 198, fogDensity: 0.0001,
    exposure: 1.2, envIntensity: 1.15, backgroundBlur: 0.2, solidBackground: 0x2d1f18
  },
  night: {
    id: 'night', name: 'High-Contrast Inspection (Xưởng Đêm Chiếu Sáng)',
    skyColor: 0x050811, horizonColor: 0x0c121e, sunColor: 0xdbe8fa, sunIntensity: 2.1, sunPosition: [-20, 38, 22],
    fillColor: 0x38bdf8, fillIntensity: 0.52, fogNear: 60, fogFar: 185, fogDensity: 0.0001,
    exposure: 1.22, envIntensity: 0.95, backgroundBlur: 0.2, solidBackground: 0x0c121e
  }
};

export function getVietnamTimeInfo(date = new Date()) {
  let hour = 12, minute = 0, second = 0;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(date);
    hour = parseInt(parts.find(p => p.type === 'hour')?.value || '12', 10);
    minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);
  } catch (_) {
    const vn = new Date(date.getTime() + (7 * 60 - date.getTimezoneOffset()) * 60000);
    hour = vn.getUTCHours(); minute = vn.getUTCMinutes(); second = vn.getUTCSeconds();
  }
  const t = hour + minute / 60 + second / 3600;
  let band = 'night';
  if (t >= 5.25 && t < 6.5) band = 'dawn';
  else if (t >= 6.5 && t < 16.5) band = 'day';
  else if (t >= 16.5 && t < 18.0) band = 'golden';
  else if (t >= 18.0 && t < 19.25) band = 'dusk';
  return { hour, minute, second, t, band };
}

export const getVietnamHorizonBand = (date = new Date()) => getVietnamTimeInfo(date).band;

const ATMOSPHERE_BANDS = {
  night: {
    fog: 0x0c121e, mid: 0x090f1a, sky: 0x050811, glow: 0.06, haze: 0.30, near: 60, far: 185,
    sun: [0xdbe8fa, 2.05, [-20, 38, 22]], fill: [0x38bdf8, 0.52], amb: [0x182236, 0.36], exposure: 1.22
  },
  sunset: {
    fog: 0xd49258, mid: 0x8f6b70, sky: 0x3b486e, glow: 0.65, haze: 0.38, near: 65, far: 198,
    sun: [0xff9e44, 2.8, [34, 20, 26]], fill: [0x38bdf8, 0.60], amb: [0xfdecd2, 0.58], exposure: 1.20
  },
  overcast: {
    fog: 0xdde3ea, mid: 0xbec9d6, sky: 0x8395aa, glow: 0.18, haze: 0.42, near: 68, far: 205,
    sun: [0xfffbeb, 2.5, [24, 46, 28]], fill: [0x93c5fd, 0.8], amb: [0xffffff, 0.65], exposure: 1.16
  },
  dawn: {
    fog: 0xc8a296, mid: 0x8c87a6, sky: 0x465278, glow: 0.55, haze: 0.38, near: 65, far: 198,
    sun: [0xffd4a8, 2.2, [-28, 18, 24]], fill: [0x60a5fa, 0.65], amb: [0xf5e4dc, 0.52], exposure: 1.15
  },
  dusk: {
    fog: 0x1e2438, mid: 0x171f33, sky: 0x0d1322, glow: 0.20, haze: 0.32, near: 60, far: 185,
    sun: [0xa07c6f, 1.1], fill: [0x334155, 0.45], amb: [0x1f293d, 0.42], exposure: 1.16
  },
  day: {
    fog: 0xe4e2d8, mid: 0xbcd0e2, sky: 0x6c9ece, glow: 0.38, haze: 0.34, near: 68, far: 205,
    sun: [0xfff6dc, 2.75], fill: [0x9ec8f5, 0.85, [-24, 22, -18]], amb: [0xfffcf2, 0.70], exposure: 1.18
  }
};

export function resolveAtmosphereConfig(preset, { band, t }) {
  const key = (preset.id === 'night' || preset.id === 'sunset' || preset.id === 'overcast')
    ? preset.id
    : (band === 'golden' ? 'sunset' : (ATMOSPHERE_BANDS[band] ? band : 'day'));
  const cfg = ATMOSPHERE_BANDS[key];
  if (key !== 'day') return cfg;
  const sunPos = t < 11.5 ? [28, 44, 24] : (t <= 14.0 ? [14, 52, 16] : [30, 38, -24]);
  return { ...cfg, sun: [cfg.sun[0], cfg.sun[1], sunPos] };
}

const SKY_VERTEX_SHADER = `
  varying vec3 vSkyDir;
  void main() {
    vSkyDir = position;
    vec4 mvPosition = modelViewMatrix * vec4(position + cameraPosition, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SKY_FRAGMENT_SHADER = `
  uniform vec3 uHorizonColor;
  uniform vec3 uMidSkyColor;
  uniform vec3 uSkyColor;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunGlow;
  uniform float uHorizonHaze;
  varying vec3 vSkyDir;
  void main() {
    vec3 dir = normalize(vSkyDir);
    float y = dir.y;
    float up = clamp(y, 0.0, 1.0);
    float horizonToMid = 1.0 - smoothstep(0.0, max(0.08, uHorizonHaze), up);
    float midToZenith = smoothstep(0.06, 0.72, up);
    vec3 skyGrad = mix(uMidSkyColor, uSkyColor, midToZenith);
    vec3 col = mix(skyGrad, uHorizonColor, pow(horizonToMid, 1.35));
    float sunCos = max(dot(dir, normalize(uSunDir)), 0.0);
    float sunAtmosphere = pow(sunCos, 6.0) * 0.20 + pow(sunCos, 48.0) * 0.28;
    col += uSunColor * (sunAtmosphere * uSunGlow * smoothstep(0.0, 0.18, y));
    if (y < 0.0) {
      col = mix(uHorizonColor, uHorizonColor * 0.92, clamp(-y * 2.5, 0.0, 1.0));
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createHorizonSkyDome(scene) {
  const geo = new THREE.SphereGeometry(900, 48, 24);
  const mat = new THREE.ShaderMaterial({
    name: 'AtmosphericHorizonSkyDome',
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
    uniforms: {
      uHorizonColor: { value: new THREE.Color(0xe4e2d8) },
      uMidSkyColor: { value: new THREE.Color(0xbcd0e2) },
      uSkyColor: { value: new THREE.Color(0x6c9ece) },
      uSunDir: { value: new THREE.Vector3(28, 44, 24).normalize() },
      uSunColor: { value: new THREE.Color(0xfff6dc) },
      uSunGlow: { value: 0.38 },
      uHorizonHaze: { value: 0.34 }
    },
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'HorizonSkyDome';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  scene.add(mesh);
  return mesh;
}

export function updateHorizonSkyDome(dome, scene, sunLight, { skyColor, midSkyColor, horizonColor, sunGlow = 0.35, horizonHaze = 0.34, visible = true }) {
  dome.visible = visible;
  const u = dome.material.uniforms;
  if (scene.fog && scene.fog.isFog) u.uHorizonColor.value = scene.fog.color;
  else if (horizonColor != null) u.uHorizonColor.value.set(horizonColor);
  if (skyColor != null) u.uSkyColor.value.set(skyColor);
  if (midSkyColor != null) u.uMidSkyColor.value.set(midSkyColor);
  if (sunLight) {
    u.uSunDir.value.copy(sunLight.position).normalize();
    u.uSunColor.value.copy(sunLight.color);
  }
  u.uSunGlow.value = sunGlow;
  u.uHorizonHaze.value = horizonHaze;
}
