// @purpose: Dựng vòm bầu trời HorizonSkyDome với mây chân trời 3D Gradient Quintic mềm mại và màu khí quyển thực tế
import * as THREE from 'three';

export const LIGHTING_PRESETS = {
  liebherr_studio: {
    id: 'liebherr_studio', name: 'Engineering Studio (Thời Gian Thực Việt Nam)',
    skyColor: 0x0d65b8, horizonColor: 0xcfe7f7, sunColor: 0xfff8e6, sunIntensity: 2.8, sunPosition: [28, 44, 24],
    fillColor: 0x8ec5f8, fillIntensity: 0.88, fogNear: 72, fogFar: 215, fogDensity: 0.0001,
    exposure: 1.18, envIntensity: 1.2, backgroundBlur: 0.25, solidBackground: 0xcfe7f7
  },
  overcast: {
    id: 'overcast', name: 'Daylight Test Pad (Sân Bê Tông Ban Ngày)',
    skyColor: 0x2b6cb0, horizonColor: 0xd6e8f5, sunColor: 0xfffbeb, sunIntensity: 2.55, sunPosition: [24, 46, 28],
    fillColor: 0x93c5fd, fillIntensity: 0.82, fogNear: 70, fogFar: 210, fogDensity: 0.0001,
    exposure: 1.16, envIntensity: 1.12, backgroundBlur: 0.15, solidBackground: 0xd6e8f5
  },
  print_plan: {
    id: 'print_plan', name: 'Lift Plan CAD Sheet (Bản Vẽ ASME Nền Sáng)',
    skyColor: 0xe5ebf2, horizonColor: 0xeef2f6, sunColor: 0xffffff, sunIntensity: 1.75, sunPosition: [20, 52, 22],
    fillColor: 0xcbd5e1, fillIntensity: 0.85, fogNear: 110, fogFar: 260, fogDensity: 0.00005,
    exposure: 1.08, envIntensity: 0.95, backgroundBlur: 0.0, solidBackground: 0xeef2f6
  },
  sunset: {
    id: 'sunset', name: 'Warm Industrial Bay (Ánh Sáng Xưởng Ấm / Hoàng Hôn)',
    skyColor: 0x163b7a, horizonColor: 0xf08c36, sunColor: 0xff9436, sunIntensity: 2.85, sunPosition: [36, 16, 26],
    fillColor: 0x4aa3df, fillIntensity: 0.62, fogNear: 66, fogFar: 202, fogDensity: 0.0001,
    exposure: 1.2, envIntensity: 1.18, backgroundBlur: 0.2, solidBackground: 0xf08c36
  },
  night: {
    id: 'night', name: 'High-Contrast Inspection (Xưởng Đêm Chiếu Sáng)',
    skyColor: 0x040812, horizonColor: 0x0b1526, sunColor: 0xdbe8fa, sunIntensity: 2.1, sunPosition: [-20, 38, 22],
    fillColor: 0x38bdf8, fillIntensity: 0.52, fogNear: 60, fogFar: 185, fogDensity: 0.0001,
    exposure: 1.22, envIntensity: 0.95, backgroundBlur: 0.2, solidBackground: 0x0b1526
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
    fog: 0x0b1526, mid: 0x08101f, sky: 0x040812, glow: 0.08, haze: 0.28, near: 60, far: 185,
    cloudLight: 0x243b5e, cloudShade: 0x0d182b, cloudOpacity: 0.24,
    sun: [0xdbe8fa, 2.05, [-20, 38, 22]], fill: [0x38bdf8, 0.52], amb: [0x182236, 0.36], exposure: 1.22
  },
  sunset: {
    fog: 0xf08c36, mid: 0xc26e52, sky: 0x163b7a, glow: 0.78, haze: 0.36, near: 66, far: 202,
    cloudLight: 0xffcfa0, cloudShade: 0x5c6991, cloudOpacity: 0.78,
    sun: [0xff9436, 2.85, [36, 16, 26]], fill: [0x4aa3df, 0.62], amb: [0xfdecd2, 0.60], exposure: 1.20
  },
  overcast: {
    fog: 0xd6e8f5, mid: 0x7cb2df, sky: 0x2b6cb0, glow: 0.28, haze: 0.38, near: 70, far: 210,
    cloudLight: 0xf8fbff, cloudShade: 0x9abde0, cloudOpacity: 0.68,
    sun: [0xfffbeb, 2.55, [24, 46, 28]], fill: [0x93c5fd, 0.82], amb: [0xffffff, 0.66], exposure: 1.16
  },
  dawn: {
    fog: 0xe8a586, mid: 0x6b8ec2, sky: 0x1f4378, glow: 0.62, haze: 0.36, near: 66, far: 200,
    cloudLight: 0xffe2cc, cloudShade: 0x7084ab, cloudOpacity: 0.72,
    sun: [0xffcfa0, 2.25, [-30, 17, 24]], fill: [0x60a5fa, 0.66], amb: [0xf5e4dc, 0.54], exposure: 1.16
  },
  dusk: {
    fog: 0x283655, mid: 0x1a2642, sky: 0x0b1224, glow: 0.26, haze: 0.30, near: 60, far: 185,
    cloudLight: 0x6e5b7a, cloudShade: 0x1d2740, cloudOpacity: 0.40,
    sun: [0xc47d5e, 1.15], fill: [0x334155, 0.45], amb: [0x1f293d, 0.42], exposure: 1.16
  },
  day: {
    fog: 0xcfe7f7, mid: 0x4ea0e6, sky: 0x0c63b8, glow: 0.44, haze: 0.30, near: 72, far: 215,
    cloudLight: 0xffffff, cloudShade: 0x9ec5e8, cloudOpacity: 0.72,
    sun: [0xfff8e6, 2.80], fill: [0x8ec5f8, 0.88, [-24, 22, -18]], amb: [0xfffcf5, 0.72], exposure: 1.18
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
  uniform vec3 uCloudLightColor;
  uniform vec3 uCloudShadeColor;
  uniform float uSunGlow;
  uniform float uHorizonHaze;
  uniform float uCloudOpacity;
  uniform float uTime;
  varying vec3 vSkyDir;

  // Sin-free integer/fract hash is 4-5x faster on software WebGL (SwiftShader) & tablet GPUs
  vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return -1.0 + 2.0 * fract((p.xxy + p.yxx) * p.zyx);
  }

  // C2-continuous 3D Quintic Gradient Noise (zero grid creases or boxy facets)
  float gnoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(
      mix(
        mix(dot(hash33(i + vec3(0,0,0)), f - vec3(0,0,0)), dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
        mix(dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x),
        u.y
      ),
      mix(
        mix(dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
        mix(dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x),
        u.y
      ),
      u.z
    );
  }

  const mat3 OCT_ROT = mat3(
     0.00,  0.80,  0.60,
    -0.80,  0.36, -0.48,
    -0.60, -0.48,  0.64
  );

  float fbm2(vec3 p) {
    float v = 0.56 * gnoise3(p);
    p = OCT_ROT * p * 2.04 + vec3(11.3, 5.9, 17.7);
    return v + 0.28 * gnoise3(p);
  }

  float fbm4(vec3 p) {
    float v = 0.0;
    float amp = 0.52;
    for (int i = 0; i < 4; i++) {
      v += amp * gnoise3(p);
      p = OCT_ROT * p * 2.02 + vec3(13.7, 7.3, 19.1);
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vSkyDir);
    float y = dir.y;
    // y <= 0 stays pure uHorizonColor so sky matches Three.js fog_fragment bit-for-bit
    float elev = clamp(y, 0.0, 1.0);
    vec3 sunD = normalize(uSunDir);

    // Wide C2-smooth atmospheric gradient from horizon -> warm/cool mid sky -> deep zenith
    float hazeCurve = smoothstep(0.0, max(0.34, uHorizonHaze * 1.15), elev);
    float upperCurve = smoothstep(0.06, 0.68, elev);
    vec3 lowerGrad = mix(uHorizonColor, mix(uHorizonColor, uMidSkyColor, 0.72), pow(hazeCurve, 1.25));
    vec3 upperGrad = mix(uMidSkyColor, uSkyColor, smoothstep(0.14, 0.85, elev));
    vec3 col = mix(lowerGrad, upperGrad, pow(upperCurve, 1.35));

    float sunCos = max(dot(dir, sunD), 0.0);
    float mieBand = pow(sunCos, 4.0) * 0.22 * (1.0 - smoothstep(0.05, 0.48, elev));
    float sunDisc = pow(sunCos, 12.0) * 0.16 + pow(sunCos, 140.0) * 0.38;
    col += uSunColor * ((mieBand + sunDisc) * uSunGlow * smoothstep(0.015, 0.16, elev));

    if (elev > 0.02 && elev < 0.42 && uCloudOpacity > 0.01) {
      vec3 drift = vec3(uTime * 0.0035, 0.0, uTime * 0.0018);
      vec3 pCum = vec3(dir.x * 2.6, elev * 10.5, dir.z * 2.6) + drift;
      float warp = gnoise3(pCum * 0.65 + vec3(4.2, 1.5, -3.1));

      float nCum = fbm4(pCum + vec3(warp * 0.45, warp * 0.2, -warp * 0.45));
      float cumRaw = smoothstep(-0.06, 0.46, nCum);
      float cumShape = pow(cumRaw, 1.45);
      float cumEnvelope = smoothstep(0.025, 0.08, elev) * (1.0 - smoothstep(0.08, 0.20, elev));
      float cumAlpha = cumShape * cumEnvelope;

      vec3 pCir = vec3(dir.x * 1.85, elev * 14.0, dir.z * 1.85) + drift * 0.6 + vec3(warp * 0.7, 0.0, warp * 0.5);
      float nCir = fbm2(pCir);
      float cirShape = pow(smoothstep(0.02, 0.48, nCir), 1.65);
      float cirEnvelope = smoothstep(0.05, 0.13, elev) * (1.0 - smoothstep(0.18, 0.38, elev));
      float cirAlpha = cirShape * cirEnvelope * 0.36;

      float totalCloud = clamp(cumAlpha + cirAlpha * (1.0 - cumAlpha * 0.65), 0.0, 1.0);
      float lightGrad = smoothstep(-0.18, 0.38, nCum) * 0.55 + smoothstep(0.02, 0.14, elev) * 0.45;
      vec3 cloudCol = mix(uCloudShadeColor, uCloudLightColor, clamp(lightGrad, 0.0, 1.0));
      float silverLining = pow(sunCos, 5.0) * uSunGlow * (1.0 - cumShape * 0.35);
      cloudCol += uSunColor * silverLining * 0.28;

      float mistBlend = smoothstep(0.02, 0.11, elev);
      cloudCol = mix(uHorizonColor, cloudCol, 0.25 + 0.75 * mistBlend);
      col = mix(col, cloudCol, totalCloud * uCloudOpacity * mistBlend);
    }

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    // Subtle triangular filmic dither prevents 8-bit banding in dark night skies
    float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * (1.25 / 255.0);
    gl_FragColor.rgb = clamp(gl_FragColor.rgb + vec3(dither), 0.0, 1.0);
  }
`;

export function createHorizonSkyDome(scene) {
  const geo = new THREE.SphereGeometry(900, 64, 32);
  const mat = new THREE.ShaderMaterial({
    name: 'AtmosphericHorizonSkyDome',
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
    uniforms: {
      uHorizonColor: { value: new THREE.Color(0xcfe7f7) },
      uMidSkyColor: { value: new THREE.Color(0x4ea0e6) },
      uSkyColor: { value: new THREE.Color(0x0c63b8) },
      uSunDir: { value: new THREE.Vector3(28, 44, 24).normalize() },
      uSunColor: { value: new THREE.Color(0xfff8e6) },
      uCloudLightColor: { value: new THREE.Color(0xffffff) },
      uCloudShadeColor: { value: new THREE.Color(0x9ec5e8) },
      uSunGlow: { value: 0.44 },
      uHorizonHaze: { value: 0.30 },
      uCloudOpacity: { value: 0.72 },
      uTime: { value: 0.0 }
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

export function updateHorizonSkyDome(dome, scene, sunLight, {
  skyColor, midSkyColor, horizonColor, cloudLightColor, cloudShadeColor,
  sunGlow = 0.44, horizonHaze = 0.30, cloudOpacity = 0.72, visible = true
}) {
  dome.visible = visible;
  const u = dome.material.uniforms;
  if (scene.fog && scene.fog.isFog) u.uHorizonColor.value.copy(scene.fog.color);
  else if (horizonColor != null) u.uHorizonColor.value.set(horizonColor);
  if (skyColor != null) u.uSkyColor.value.set(skyColor);
  if (midSkyColor != null) u.uMidSkyColor.value.set(midSkyColor);
  if (cloudLightColor != null) u.uCloudLightColor.value.set(cloudLightColor);
  if (cloudShadeColor != null) u.uCloudShadeColor.value.set(cloudShadeColor);
  if (sunLight) {
    u.uSunDir.value.copy(sunLight.position).normalize();
    u.uSunColor.value.copy(sunLight.color);
  }
  u.uSunGlow.value = sunGlow;
  u.uHorizonHaze.value = horizonHaze;
  u.uCloudOpacity.value = cloudOpacity;
}
