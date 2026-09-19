import * as THREE from 'three';

// One full day, in seconds. First half is daytime, second half is night.
export const DAY_LENGTH = 240;

// Keyframes around the clock. t: 0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight.
const KEYS = [
  { t: 0.00, sky: 0xffa65c, fog: 0xffb277, amb: 0.55, sun: 0.70, sunCol: 0xffc08a, star: 0.25 },
  { t: 0.10, sky: 0x8fd0f0, fog: 0x9fd8f2, amb: 0.82, sun: 1.15, sunCol: 0xfff3dd, star: 0.00 },
  { t: 0.25, sky: 0x87ceeb, fog: 0x87ceeb, amb: 0.88, sun: 1.30, sunCol: 0xfff8e7, star: 0.00 },
  { t: 0.40, sky: 0x8fd0f0, fog: 0x9fd8f2, amb: 0.82, sun: 1.15, sunCol: 0xfff3dd, star: 0.00 },
  { t: 0.50, sky: 0xff8a4d, fog: 0xffa36a, amb: 0.52, sun: 0.62, sunCol: 0xffb070, star: 0.30 },
  { t: 0.58, sky: 0x2b3566, fog: 0x36406f, amb: 0.36, sun: 0.26, sunCol: 0x9fb4ff, star: 0.85 },
  { t: 0.75, sky: 0x070c22, fog: 0x0d1430, amb: 0.30, sun: 0.20, sunCol: 0x93a9ff, star: 1.00 },
  { t: 0.92, sky: 0x2b3566, fog: 0x36406f, amb: 0.36, sun: 0.26, sunCol: 0x9fb4ff, star: 0.85 },
  { t: 1.00, sky: 0xffa65c, fog: 0xffb277, amb: 0.55, sun: 0.70, sunCol: 0xffc08a, star: 0.25 }
];

function lerp(a, b, k) {
  return a + (b - a) * k;
}

export class DayNightCycle {
  constructor(scene, ambientLight, sunLight, cloudMaterial) {
    this.scene = scene;
    this.ambientLight = ambientLight;
    this.sunLight = sunLight;
    this.cloudMaterial = cloudMaterial;

    // Start mid-morning so the first thing Aiden sees is a bright world
    this.time = 0.18;
    this.paused = false;

    // Everything in the sky rides along with the player so it stays distant
    this.skyGroup = new THREE.Group();
    this.scene.add(this.skyGroup);

    // ---- Sun: a big warm block ----
    this.sun = new THREE.Mesh(
      new THREE.BoxGeometry(16, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false })
    );
    this.sunGlow = new THREE.Mesh(
      new THREE.BoxGeometry(24, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd45e, transparent: true, opacity: 0.3, fog: false, depthWrite: false })
    );
    this.sun.add(this.sunGlow);
    this.skyGroup.add(this.sun);

    // ---- Moon: only ever visible at night ----
    this.moon = new THREE.Mesh(
      new THREE.BoxGeometry(18, 18, 18),
      new THREE.MeshBasicMaterial({ color: 0xf6f9ff, fog: false })
    );
    this.moonGlow = new THREE.Mesh(
      new THREE.BoxGeometry(27, 27, 27),
      new THREE.MeshBasicMaterial({ color: 0xbcd4ff, transparent: true, opacity: 0.3, fog: false, depthWrite: false })
    );
    this.moon.add(this.moonGlow);
    this.skyGroup.add(this.moon);

    // ---- Stars ----
    const starCount = 420;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      // Upper hemisphere only — no stars under the ground
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * 0.85;
      const r = 300;
      const y = Math.sin(Math.acos(v)) * 0.0 + v * r;
      const rad = Math.sqrt(Math.max(0, r * r - y * y));
      positions[i * 3] = Math.cos(u) * rad;
      positions[i * 3 + 1] = y + 20;
      positions[i * 3 + 2] = Math.sin(u) * rad;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.4,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.skyGroup.add(this.stars);

    this.skyColor = new THREE.Color(0x87ceeb);
    this.fogColor = new THREE.Color(0x87ceeb);
    this.sunColor = new THREE.Color(0xfff8e7);
    this.cloudColor = new THREE.Color(0xffffff);

    this.apply();
  }

  // 0 = sunrise .. 0.5 = sunset .. 1 = sunrise again
  isNight() {
    return this.time > 0.5;
  }

  // Deep night — when it is dark enough for monsters to spawn
  isDeepNight() {
    return this.time > 0.545 && this.time < 0.955;
  }

  phaseName() {
    const t = this.time;
    if (t < 0.06) return '🌅 日出';
    if (t < 0.42) return '☀️ 白天';
    if (t < 0.55) return '🌇 日落';
    if (t < 0.94) return '🌙 夜晚';
    return '🌄 黎明';
  }

  // Remaining seconds until day flips to night (or night to day)
  secondsToFlip() {
    const target = this.time < 0.5 ? 0.5 : 1.0;
    return Math.max(0, (target - this.time) * DAY_LENGTH);
  }

  // Jump straight to the next day/night boundary — Aiden should never have to wait
  skipToNext() {
    this.time = this.time < 0.5 ? 0.52 : 0.02;
    this.apply();
    return this.isNight();
  }

  setTime(t) {
    this.time = ((t % 1) + 1) % 1;
    this.apply();
  }

  sample() {
    const t = this.time;
    let a = KEYS[0];
    let b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (t >= KEYS[i].t && t <= KEYS[i + 1].t) {
        a = KEYS[i];
        b = KEYS[i + 1];
        break;
      }
    }
    const span = b.t - a.t || 1;
    const k = Math.max(0, Math.min(1, (t - a.t) / span));

    this.skyColor.setHex(a.sky).lerp(new THREE.Color(b.sky), k);
    this.fogColor.setHex(a.fog).lerp(new THREE.Color(b.fog), k);
    this.sunColor.setHex(a.sunCol).lerp(new THREE.Color(b.sunCol), k);

    return {
      amb: lerp(a.amb, b.amb, k),
      sun: lerp(a.sun, b.sun, k),
      star: lerp(a.star, b.star, k)
    };
  }

  apply() {
    const s = this.sample();

    this.scene.background = this.skyColor.clone();
    if (this.scene.fog) this.scene.fog.color.copy(this.fogColor);

    this.ambientLight.intensity = s.amb;
    this.sunLight.intensity = s.sun;
    this.sunLight.color.copy(this.sunColor);

    this.starMat.opacity = s.star;
    this.stars.visible = s.star > 0.01;

    // Clouds pick up the sky tint, otherwise they sit in the night sky as
    // bright grey slabs. At night they also fade back so the stars read.
    if (this.cloudMaterial) {
      const dayness = 1 - s.star; // 1 in full daylight, 0 at midnight
      this.cloudColor.copy(this.skyColor).lerp(new THREE.Color(0xffffff), 0.12 + dayness * 0.8);
      this.cloudMaterial.color.copy(this.cloudColor);
      this.cloudMaterial.opacity = 0.3 + dayness * 0.52;
    }

    // Sun and moon sit opposite each other on the same circle.
    // Angle 0 = sunrise on the east horizon, PI/2 = noon overhead.
    const ang = this.time * Math.PI * 2;
    const R = 260;
    this.sun.position.set(Math.cos(ang) * R, Math.sin(ang) * R, -60);
    this.moon.position.set(-Math.cos(ang) * R, -Math.sin(ang) * R, -60);

    // The moon is only in the sky at night, the sun only during the day
    this.sun.visible = this.sun.position.y > -18;
    this.moon.visible = this.moon.position.y > -18;

    // Keep the directional light coming from whichever body is up
    const src = this.sun.visible ? this.sun.position : this.moon.position;
    this.sunLight.position.set(src.x * 0.4, Math.max(20, src.y * 0.4), src.z * 0.4 + 30);
  }

  update(delta, playerPosition) {
    if (!this.paused) {
      this.time = (this.time + delta / DAY_LENGTH) % 1;
    }
    this.apply();
    if (playerPosition) {
      this.skyGroup.position.set(playerPosition.x, 0, playerPosition.z);
    }
  }
}
