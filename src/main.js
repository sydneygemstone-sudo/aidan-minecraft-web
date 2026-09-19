import * as THREE from 'three';
import { generateBlockTextures } from './textures.js';
import { World } from './world.js';
import { Player } from './player.js';
import { ParticleSystem } from './particles.js';
import { StorageManager } from './storage.js';
import { UIManager } from './ui.js';
import { sounds } from './audio.js';
import { MagicSystem } from './magic.js';
import { Creatures, ITEM_DEFS } from './creatures.js';

// Setup Three.js Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Minecraft Sky Blue
scene.fog = new THREE.FogExp2(0x87ceeb, 0.012);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff8e7, 1.25);
sunLight.position.set(50, 100, 30);
scene.add(sunLight);

// Voxel Clouds in the sky
const cloudGroup = new THREE.Group();
const cloudGeo = new THREE.BoxGeometry(12, 3, 12);
const cloudMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.82
});
for (let i = 0; i < 24; i++) {
  const cloud = new THREE.Mesh(cloudGeo, cloudMat);
  cloud.position.set(
    (Math.random() - 0.5) * 300,
    42 + Math.random() * 4,
    (Math.random() - 0.5) * 300
  );
  cloud.scale.set(1 + Math.random() * 2, 1, 1 + Math.random() * 2);
  cloudGroup.add(cloud);
}
scene.add(cloudGroup);

// Initialize Textures & Systems
const { icons, atlasTexture } = generateBlockTextures();

const world = new World(scene, atlasTexture);
world.initWorld(4242);

const particles = new ParticleSystem(scene);
const player = new Player(camera, renderer.domElement, world, particles);

// Place player at safe spawn position
const spawnX = 0;
const spawnZ = 0;
const spawnY = world.getSurfaceHeight(spawnX, spawnZ) + 2;
player.position.set(spawnX, spawnY, spawnZ);

// --- Aiden's Magic Block World: fire magic + underwater life ---
const creatures = new Creatures(scene, world, particles);
const magic = new MagicSystem(scene, world, player, particles, creatures);
player.creatures = creatures;

const storage = new StorageManager(world, player);
const ui = new UIManager(world, player, storage, icons);
ui.magic = magic;
ui.creatures = creatures;
magic.ui = ui;

creatures.onCatch = (kind) => {
  ui.addItem(kind, 1);
  ui.showNotification(`🐟 抓到一条鱼！获得 ${ITEM_DEFS[kind].name} ×1 — 按 G 把它放在地上`);
};
creatures.onPickup = (kind) => {
  ui.addItem(kind, 1);
  ui.showNotification(`拾取 ${ITEM_DEFS[kind].emoji} ${ITEM_DEFS[kind].name} ×1`);
};
creatures.onCook = () => {
  ui.showNotification('🔥 → 🐟 → 🍢 烤熟啦！走过去捡起来，然后按 V 吃掉');
};

function repopulateFish() {
  const n = creatures.spawnFishInWorld(34);
  return n;
}
repopulateFish();

// Auto-load saved world if present
const autoLoad = storage.loadFromLocalStorage();
if (autoLoad.success) {
  // The world was rebuilt from the save — put the fish back in the new water
  repopulateFish();
  ui.showNotification(`已自动恢复存档 (${autoLoad.count} 个方块)`);
}

// Mouse Click Event for Break / Place
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

renderer.domElement.addEventListener('mousedown', (e) => {
  if (!player.isLocked && !player.keyboardMode && !player.isTouchDevice) {
    renderer.domElement.requestPointerLock();
    sounds.ensureContext();
    return;
  }

  if (e.button === 0) {
    // Left Click: Break
    player.breakBlock();
  } else if (e.button === 2) {
    // Right Click: Place
    const selectedBlock = ui.getSelectedBlockId();
    player.placeBlock(selectedBlock);
  }
});

// Window Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Play Mode Buttons
document.getElementById('btn-play')?.addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
  player.setPlaying(true);
  sounds.ensureContext();
});

document.getElementById('btn-play-keyboard')?.addEventListener('click', () => {
  player.keyboardMode = true;
  player.setPlaying(true);
  sounds.ensureContext();
  ui.showNotification('已进入纯键盘模式：方向键旋转视角，Z 挖掘，X 放置，F 飞行');
});

document.getElementById('btn-play-touch')?.addEventListener('click', () => {
  player.isTouchDevice = true;
  player.setPlaying(true);
  document.getElementById('touch-controls')?.classList.remove('hidden');
  sounds.ensureContext();
  ui.showNotification('已开启 iPad 触屏虚拟按键');
});

document.getElementById('btn-touch-toggle')?.addEventListener('click', () => {
  const tc = document.getElementById('touch-controls');
  if (tc) {
    tc.classList.toggle('hidden');
    const isVisible = !tc.classList.contains('hidden');
    ui.showNotification(isVisible ? '触屏虚拟按键已开启' : '触屏虚拟按键已隐藏');
    sounds.playClickSound();
  }
});

// UI Top Bar Actions
document.getElementById('btn-save')?.addEventListener('click', () => {
  const res = storage.saveToLocalStorage();
  if (res.success) {
    ui.showNotification(`存档保存成功！(共 ${res.count} 个自定义方块)`);
    sounds.playClickSound();
  }
});

document.getElementById('btn-export')?.addEventListener('click', () => {
  const count = storage.exportToFile();
  ui.showNotification(`存档导出成功！(导出 ${count} 个方块)`);
  sounds.playClickSound();
});

document.getElementById('btn-presets')?.addEventListener('click', () => {
  ui.openPresets();
  sounds.playClickSound();
});

document.getElementById('btn-inventory')?.addEventListener('click', () => {
  if (player.isLocked) document.exitPointerLock();
  ui.openInventory();
  sounds.playClickSound();
});

document.getElementById('btn-help')?.addEventListener('click', () => {
  const help = document.getElementById('help-modal');
  if (help) help.classList.toggle('hidden');
  sounds.playClickSound();
});

document.getElementById('btn-reset-world')?.addEventListener('click', () => {
  if (confirm('确定要清空所有建筑并重新生成世界吗？')) {
    world.initWorld(Math.floor(Math.random() * 99999));
    magic.burning.clear();
    creatures.reset();
    const fishCount = repopulateFish();
    const sy = world.getSurfaceHeight(0, 0) + 2;
    player.position.set(0, sy, 0);
    ui.showNotification(`新世界生成完成！水里放了 ${fishCount} 条鱼 🐟`);
    sounds.playClickSound();
  }
});

// Preset building buttons
document.querySelectorAll('.btn-preset-item').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const preset = e.currentTarget.getAttribute('data-preset');
    if (preset) {
      storage.loadPreset(preset);
      ui.closePresets();
      ui.showNotification(`已生成预设建筑: ${btn.innerText.trim()}`);
      sounds.playClickSound();
      player.setPlaying(true);
    }
  });
});

// Modal close buttons
document.querySelectorAll('.modal-close').forEach((btn) => {
  btn.addEventListener('click', () => {
    ui.closeInventory();
    ui.closePresets();
    document.getElementById('help-modal')?.classList.add('hidden');
    sounds.playClickSound();
  });
});

// Debug / QA handle so the systems can be poked from the console
window.__game = { scene, world, player, particles, magic, creatures, ui, storage };

let hurtCooldown = 0;

function updateFireDamage(delta) {
  if (hurtCooldown > 0) hurtCooldown -= delta;

  const px = Math.floor(player.position.x);
  const pz = Math.floor(player.position.z);
  const py = Math.floor(player.position.y);

  const inFire =
    magic.isBurningAt(px, py, pz) ||
    magic.isBurningAt(px, py + 1, pz) ||
    magic.isBurningAt(px, py - 1, pz);

  if (!inFire) return;

  player.health -= 5 * delta;
  if (hurtCooldown <= 0) {
    hurtCooldown = 0.9;
    particles.spawnFlameBurst(player.position.x, player.position.y + 0.8, player.position.z, 6, 0.5);
    ui.showNotification('🔥 好烫！快离开火焰（吃烤鱼可以回血）', 'error');
  }

  if (player.health <= 0) {
    player.health = player.maxHealth;
    const sy = world.getSurfaceHeight(0, 0) + 3;
    player.position.set(0, sy, 0);
    player.velocity.set(0, 0, 0);
    ui.showNotification('你被自己的火焰烧到了！已送回出生点，生命值已回满');
  }
}

let lastFrameTime = performance.now();
let frameCount = 0;
let lastFpsTime = performance.now();
let currentFps = 60;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  frameCount++;
  if (now - lastFpsTime >= 500) {
    currentFps = (frameCount * 1000) / (now - lastFpsTime);
    frameCount = 0;
    lastFpsTime = now;
  }

  // Update Game systems
  player.update(delta);
  magic.update(delta);
  creatures.update(delta, player);
  particles.update(delta);

  // Standing inside your own fire hurts — that is what the cooked fish is for
  updateFireDamage(delta);

  // Cloud drift
  cloudGroup.position.x += 1.5 * delta;
  if (cloudGroup.position.x > 150) {
    cloudGroup.position.x = -150;
  }

  // Update UI stats
  ui.updateStats(currentFps);

  // Render Scene
  renderer.render(scene, camera);
}

animate();
