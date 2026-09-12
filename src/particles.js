import * as THREE from 'three';
import { BLOCK_DEFS } from './blocks.js';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];

    // Reusable small cube geometry
    this.geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
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
      p.vel.y -= 14 * delta; // Gravity
      p.mesh.position.addScaledVector(p.vel, delta);
      p.mesh.rotation.x += p.vel.z * delta * 2;
      p.mesh.rotation.y += p.vel.x * delta * 2;

      // Fade out
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    }
  }
}
