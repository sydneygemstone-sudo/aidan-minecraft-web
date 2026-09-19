import * as THREE from 'three';
import { BLOCK_DEFS } from './blocks.js';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];

    // Reusable small cube geometry
    this.geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);

    // Hard ceiling so a large forest fire can never tank the framerate
    this.maxParticles = 1100;
  }

  spawnBlockBreak(x, y, z, blockId) {
    const def = BLOCK_DEFS[blockId];
    // Pick average color representative of block
    let col = 0x888888;
    if (blockId === 1) col = 0x5e8e32; // grass
    else if (blockId === 2) col = 0x866043; // dirt
    else if (blockId === 3) col = 0x737373; // stone
    else if (blockId === 4) col = 0x555555; // cobblestone
    else if (blockId === 5) col = 0x624b30; // wood
    else if (blockId === 6) col = 0xbc9862; // planks
    else if (blockId === 7) col = 0x387723; // leaves
    else if (blockId === 8) col = 0xbfe5f8; // glass
    else if (blockId === 9) col = 0x9c4939; // bricks
    else if (blockId === 10) col = 0xdcbe7e; // sand
    else if (blockId === 11) col = 0x9e2a2b; // bookshelf
    else if (blockId === 12) col = 0x40c9d6; // diamond
    else if (blockId === 13) col = 0xe8b820; // gold
    else if (blockId === 14) col = 0xd5d5d5; // iron
    else if (blockId === 15) col = 0xffd455; // glowstone
    else if (blockId === 16) col = 0xcc2a1a; // tnt
    else if (blockId === 17) col = 0x221838; // obsidian

    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1.0 });

    const count = 12;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.geo, mat.clone());
      mesh.position.set(
        x + 0.5 + (Math.random() - 0.5) * 0.6,
        y + 0.5 + (Math.random() - 0.5) * 0.6,
        z + 0.5 + (Math.random() - 0.5) * 0.6
      );

      const vx = (Math.random() - 0.5) * 4;
      const vy = Math.random() * 4 + 1.5;
      const vz = (Math.random() - 0.5) * 4;

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(vx, vy, vz),
        life: 0.6,
        maxLife: 0.6
      });
    }
  }

  // ---- Magic effects ---------------------------------------------------

  // Shared spawner for the floaty (non block-break) effects
  spawnPuff(x, y, z, count, opts) {
    if (this.particles.length > this.maxParticles) return;

    const {
      colors = [0xffffff],
      size = 0.6,
      spread = 0.5,
      speed = 1.6,
      rise = 1.4,
      gravity = 0,
      life = 0.7,
      fade = 1.0
    } = opts || {};

    for (let i = 0; i < count; i++) {
      const col = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: fade,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.scale.setScalar(size * (0.7 + Math.random() * 0.6));
      mesh.position.set(
        x + (Math.random() - 0.5) * spread,
        y + (Math.random() - 0.5) * spread,
        z + (Math.random() - 0.5) * spread
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * speed,
          rise * (0.6 + Math.random() * 0.8),
          (Math.random() - 0.5) * speed
        ),
        gravity,
        life: life * (0.7 + Math.random() * 0.6),
        maxLife: life
      });
    }
  }

  // Orange/yellow flames — used for the fireball trail, impacts and burning blocks
  spawnFlameBurst(x, y, z, count = 10, size = 0.8) {
    this.spawnPuff(x, y, z, count, {
      colors: [0xffcf4d, 0xff8a1f, 0xff5a10, 0xffe9a3],
      size,
      spread: 0.45,
      speed: 2.0,
      rise: 2.2,
      gravity: -2.5, // flames float upward
      life: 0.5
    });
  }

  // Fire meets water
  spawnSteam(x, y, z, count = 18) {
    this.spawnPuff(x, y, z, count, {
      colors: [0xffffff, 0xe8f6ff, 0xc9e6f5],
      size: 1.1,
      spread: 0.8,
      speed: 1.6,
      rise: 2.6,
      gravity: -3.0,
      life: 1.15,
      fade: 0.85
    });
  }

  // Thin dark smoke — scorch marks and cooking fish
  spawnSmokePuff(x, y, z, count = 6) {
    this.spawnPuff(x, y, z, count, {
      colors: [0x5a5a5a, 0x7d7168, 0x3d3d3d],
      size: 0.9,
      spread: 0.4,
      speed: 0.8,
      rise: 1.6,
      gravity: -1.6,
      life: 1.0,
      fade: 0.7
    });
  }

  update(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      // Block debris falls; flames, steam and smoke float up (negative gravity)
      p.vel.y -= (p.gravity !== undefined ? p.gravity : 14) * delta;
      p.mesh.position.addScaledVector(p.vel, delta);
      p.mesh.rotation.x += p.vel.z * delta * 2;
      p.mesh.rotation.y += p.vel.x * delta * 2;

      // Fade out
      p.mesh.material.opacity = Math.max(0, Math.min(1, p.life / p.maxLife));
    }
  }
}
