import * as THREE from 'three';
import { BLOCKS } from './blocks.js';
import { sounds } from './audio.js';

// Blocks that catch fire from the player's fire magic
export const FLAMMABLE = new Set([
  BLOCKS.OAK_LOG,
  BLOCKS.OAK_LEAVES,
  BLOCKS.OAK_PLANKS,
  BLOCKS.BOOKSHELF,
  BLOCKS.GRASS
]);

// What a burning block turns into once the fire finishes eating it
const BURN_RESULT = {
  [BLOCKS.OAK_LOG]: BLOCKS.AIR,
  [BLOCKS.OAK_LEAVES]: BLOCKS.AIR,
  [BLOCKS.OAK_PLANKS]: BLOCKS.AIR,
  [BLOCKS.BOOKSHELF]: BLOCKS.AIR,
  [BLOCKS.GRASS]: BLOCKS.DIRT // scorched earth
};

const MAX_BURNING = 140; // perf guard: never let a forest fire run away

export class MagicSystem {
  constructor(scene, world, player, particles, creatures) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.particles = particles;
    this.creatures = creatures;
    this.ui = null; // wired from main.js

    this.fireballs = [];
    // "x,y,z" -> { x, y, z, id, t, spark }
    this.burning = new Map();

    this.castCooldown = 0;

    // Shared fireball visuals
    this.coreGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xffd05a });
    this.glowGeo = new THREE.BoxGeometry(0.62, 0.62, 0.62);
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0xff6a1a,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
  }

  // ---- Casting -------------------------------------------------------

  cast() {
    if (this.castCooldown > 0) return false;
    this.castCooldown = 0.28;

    const cam = this.player.camera;
    const dir = cam.getWorldDirection(new THREE.Vector3()).normalize();

    const group = new THREE.Group();
    const core = new THREE.Mesh(this.coreGeo, this.coreMat);
    const glow = new THREE.Mesh(this.glowGeo, this.glowMat);
    group.add(core);
    group.add(glow);

    const start = cam.position.clone().addScaledVector(dir, 0.9);
    group.position.copy(start);
    this.scene.add(group);

    const light = new THREE.PointLight(0xff7a22, 2.2, 10);
    group.add(light);

    this.fireballs.push({
      mesh: group,
      core,
      glow,
      vel: dir.multiplyScalar(26),
      life: 3.0,
      trail: 0
    });

    sounds.playFireCastSound();
    return true;
  }

  // ---- Fire <-> world interaction -------------------------------------

  ignite(x, y, z) {
    const id = this.world.getBlock(x, y, z);
    if (!FLAMMABLE.has(id)) return false;
    const key = `${x},${y},${z}`;
    if (this.burning.has(key)) return false;
    if (this.burning.size >= MAX_BURNING) return false;

    this.burning.set(key, { x, y, z, id, t: 0, spark: 0 });
    return true;
  }

  // A fireball reached this block position — decide what happens
  impact(x, y, z, hitId) {
    if (hitId === BLOCKS.WATER) {
      this.steamBurst(x + 0.5, y + 0.9, z + 0.5);
      sounds.playSteamSound();
      return;
    }

    this.particles.spawnFlameBurst(x + 0.5, y + 0.5, z + 0.5, 16);
    sounds.playFireHitSound();

    let lit = this.ignite(x, y, z);
    // Splash: try to set the immediate neighbourhood alight too
    for (const [dx, dy, dz] of [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
    ]) {
      if (this.ignite(x + dx, y + dy, z + dz)) lit = true;
    }

    // Cook any raw fish lying on the ground near the blast
    if (this.creatures) {
      this.creatures.cookNear(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), 2.6);
    }

    if (!lit) {
      // Non flammable surface: leave a short-lived scorch puff so it still reads as fire
      this.particles.spawnSmokePuff(x + 0.5, y + 1.0, z + 0.5, 6);
    }
  }

  steamBurst(x, y, z) {
    this.particles.spawnSteam(x, y, z, 22);
  }

  touchesWater(x, y, z) {
    return (
      this.world.getBlock(x + 1, y, z) === BLOCKS.WATER ||
      this.world.getBlock(x - 1, y, z) === BLOCKS.WATER ||
      this.world.getBlock(x, y + 1, z) === BLOCKS.WATER ||
      this.world.getBlock(x, y, z + 1) === BLOCKS.WATER ||
      this.world.getBlock(x, y, z - 1) === BLOCKS.WATER
    );
  }

  // ---- Per frame -------------------------------------------------------

  update(delta) {
    if (this.castCooldown > 0) this.castCooldown -= delta;
    this.updateFireballs(delta);
    this.updateBurning(delta);
  }

  updateFireballs(delta) {
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      fb.life -= delta;

      if (fb.life <= 0) {
        this.removeFireball(i);
        continue;
      }

      // Slight arc so it feels thrown, not hitscan
      fb.vel.y -= 3.2 * delta;

      // March in small steps so a fast ball cannot tunnel through a wall
      const step = fb.vel.clone().multiplyScalar(delta);
      const dist = step.length();
      const substeps = Math.max(1, Math.ceil(dist / 0.3));
      const inc = step.divideScalar(substeps);

      let consumed = false;
      for (let s = 0; s < substeps; s++) {
        fb.mesh.position.add(inc);
        const p = fb.mesh.position;

        // Entities first (a fish or a dropped fish is a smaller target)
        if (this.creatures && this.creatures.hitByFireball(p, this)) {
          consumed = true;
          break;
        }

        const bx = Math.floor(p.x);
        const by = Math.floor(p.y);
        const bz = Math.floor(p.z);
        const hit = this.world.getBlock(bx, by, bz);

        if (hit !== BLOCKS.AIR) {
          this.impact(bx, by, bz, hit);
          consumed = true;
          break;
        }

        if (by < 0) {
          consumed = true;
          break;
        }
      }

      if (consumed) {
        this.removeFireball(i);
        continue;
      }

      // Flicker + trailing embers
      const s = 0.85 + Math.random() * 0.35;
      fb.glow.scale.setScalar(s);
      fb.mesh.rotation.x += delta * 6;
      fb.mesh.rotation.y += delta * 4;
      fb.trail += delta;
      if (fb.trail > 0.035) {
        fb.trail = 0;
        this.particles.spawnFlameBurst(
          fb.mesh.position.x,
          fb.mesh.position.y,
          fb.mesh.position.z,
          1,
          0.35
        );
      }
    }
  }

  removeFireball(i) {
    const fb = this.fireballs[i];
    this.scene.remove(fb.mesh);
    this.fireballs.splice(i, 1);
  }

  updateBurning(delta) {
    if (this.burning.size === 0) return;

    const done = [];

    for (const [key, b] of this.burning.entries()) {
      // Player mined it away mid-burn
      if (this.world.getBlock(b.x, b.y, b.z) !== b.id) {
        done.push({ key, b, extinguish: true });
        continue;
      }

      // Water puts fire out and makes steam
      if (this.touchesWater(b.x, b.y, b.z)) {
        this.steamBurst(b.x + 0.5, b.y + 1.0, b.z + 0.5);
        done.push({ key, b, extinguish: true });
        continue;
      }

      b.t += delta;
      b.spark += delta;
      if (b.spark > 0.09) {
        b.spark = 0;
        this.particles.spawnFlameBurst(
          b.x + 0.5 + (Math.random() - 0.5) * 0.7,
          b.y + 0.7 + Math.random() * 0.5,
          b.z + 0.5 + (Math.random() - 0.5) * 0.7,
          2,
          0.55
        );
      }

      if (b.t > 1.5) {
        done.push({ key, b, extinguish: false });
      }
    }

    for (const { key, b, extinguish } of done) {
      this.burning.delete(key);
      if (extinguish) continue;

      // Spread to neighbours before the block disappears
      for (const [dx, dy, dz] of [
        [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
      ]) {
        if (Math.random() < 0.72) this.ignite(b.x + dx, b.y + dy, b.z + dz);
      }

      const result = BURN_RESULT[b.id] ?? BLOCKS.AIR;
      this.world.setBlock(b.x, b.y, b.z, result);
      this.particles.spawnSmokePuff(b.x + 0.5, b.y + 0.6, b.z + 0.5, 5);

      // Fire on the ground cooks raw fish lying next to it
      if (this.creatures) {
        this.creatures.cookNear(new THREE.Vector3(b.x + 0.5, b.y + 0.5, b.z + 0.5), 2.2);
      }
    }
  }

  isBurningAt(x, y, z) {
    return this.burning.has(`${x},${y},${z}`);
  }
}
