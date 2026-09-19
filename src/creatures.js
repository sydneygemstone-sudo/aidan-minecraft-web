import * as THREE from 'three';
import { BLOCKS } from './blocks.js';
import { sounds } from './audio.js';
import { CHUNK_SIZE, WORLD_CHUNKS_X, WORLD_CHUNKS_Z } from './world.js';

const WATER_LEVEL = 9; // matches Chunk.generateTerrain

// Bright, saturated colours — they have to stay readable through the blue water
const FISH_COLORS = [0xff7a00, 0xffe000, 0xff2f6d, 0x00ffc8, 0xff5ef0, 0xfff3c4];

export const ITEM_DEFS = {
  raw_fish: { name: '生鱼', enName: 'Raw Fish', emoji: '🐟', color: 0xe8806a },
  cooked_fish: { name: '烤鱼', enName: 'Cooked Fish', emoji: '🍢', color: 0xd9a441 }
};

export class Creatures {
  constructor(scene, world, particles) {
    this.scene = scene;
    this.world = world;
    this.particles = particles;

    this.fish = [];
    this.drops = [];

    // Callbacks wired by main.js
    this.onCatch = null; // (kind) => void
    this.onPickup = null; // (kind) => void
    this.onCook = null; // () => void

    this.bodyGeo = new THREE.BoxGeometry(0.8, 0.46, 0.34);
    this.tailGeo = new THREE.BoxGeometry(0.3, 0.42, 0.08);
    this.eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0x101010 });

    this.dropGeo = new THREE.BoxGeometry(0.42, 0.22, 0.2);
  }

  // ---- Fish --------------------------------------------------------

  isWater(x, y, z) {
    return this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === BLOCKS.WATER;
  }

  makeFishMesh(color) {
    const group = new THREE.Group();
    // Basic (unlit) material: a Lambert fish goes almost black once it is
    // under a water block, which is exactly the "水里什么都没有" complaint.
    const mat = new THREE.MeshBasicMaterial({ color });

    const body = new THREE.Mesh(this.bodyGeo, mat);
    group.add(body);

    const tail = new THREE.Mesh(this.tailGeo, mat);
    tail.position.set(-0.52, 0, 0);
    group.add(tail);

    const eyeL = new THREE.Mesh(this.eyeGeo, this.eyeMat);
    eyeL.position.set(0.33, 0.11, 0.18);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(this.eyeGeo, this.eyeMat);
    eyeR.position.set(0.33, 0.11, -0.18);
    group.add(eyeR);

    group.userData.tail = tail;
    return group;
  }

  addFish(x, y, z) {
    const color = FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)];
    const mesh = this.makeFishMesh(color);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    const angle = Math.random() * Math.PI * 2;
    this.fish.push({
      mesh,
      dir: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
      speed: 0.7 + Math.random() * 0.8,
      turnTimer: 1 + Math.random() * 3,
      bob: Math.random() * Math.PI * 2,
      baseY: y
    });
  }

  // Scatter fish through every body of water in the generated world
  spawnFishInWorld(target = 34) {
    this.clearFish();

    const halfX = Math.floor(WORLD_CHUNKS_X / 2);
    const halfZ = Math.floor(WORLD_CHUNKS_Z / 2);
    const minX = -halfX * CHUNK_SIZE;
    const maxX = (halfX + 1) * CHUNK_SIZE - 1;
    const minZ = -halfZ * CHUNK_SIZE;
    const maxZ = (halfZ + 1) * CHUNK_SIZE - 1;

    const spots = [];
    for (let x = minX + 1; x < maxX - 1; x += 2) {
      for (let z = minZ + 1; z < maxZ - 1; z += 2) {
        if (this.world.getBlock(x, WATER_LEVEL, z) !== BLOCKS.WATER) continue;
        // Need a little depth so the fish is not clipping the sea floor
        let floorY = WATER_LEVEL;
        while (floorY > 0 && this.world.getBlock(x, floorY - 1, z) === BLOCKS.WATER) floorY--;
        if (WATER_LEVEL - floorY < 1) continue;
        spots.push({ x, z, floorY });
      }
    }

    if (spots.length === 0) return 0;

    // Shuffle so the fish are spread out rather than clustered in one corner
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }

    const count = Math.min(target, spots.length);
    for (let i = 0; i < count; i++) {
      const s = spots[i];
      // Swim near the surface: fewer water blocks between the fish and the player
      const depth = Math.min(1.4, Math.max(0.2, WATER_LEVEL - 0.4 - s.floorY));
      const y = WATER_LEVEL + 0.45 - Math.random() * depth;
      this.addFish(s.x + 0.5, y, s.z + 0.5);
    }
    return count;
  }

  clearFish() {
    for (const f of this.fish) this.scene.remove(f.mesh);
    this.fish.length = 0;
  }

  clearDrops() {
    for (const d of this.drops) this.scene.remove(d.mesh);
    this.drops.length = 0;
  }

  reset() {
    this.clearFish();
    this.clearDrops();
  }

  catchFish(index) {
    const f = this.fish[index];
    if (!f) return;
    const p = f.mesh.position;
    this.particles.spawnSteam(p.x, p.y + 0.3, p.z, 8);
    this.scene.remove(f.mesh);
    this.fish.splice(index, 1);
    sounds.playCatchSound();
    if (this.onCatch) this.onCatch('raw_fish');
  }

  // Left click / 挖掘键 while aiming at a fish also catches it
  catchFishByRay(camera, maxDist = 7) {
    const origin = camera.position;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const ray = new THREE.Ray(origin, dir);
    const tmp = new THREE.Vector3();

    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < this.fish.length; i++) {
      const p = this.fish[i].mesh.position;
      const d = origin.distanceTo(p);
      if (d > maxDist) continue;
      ray.closestPointToPoint(p, tmp);
      if (tmp.distanceTo(p) > 0.75) continue;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    if (bestIdx !== -1) {
      this.catchFish(bestIdx);
      return true;
    }
    return false;
  }

  // ---- Dropped items ------------------------------------------------

  addDrop(x, y, z, kind) {
    const def = ITEM_DEFS[kind];
    const mesh = new THREE.Mesh(
      this.dropGeo,
      new THREE.MeshLambertMaterial({ color: def.color })
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    this.drops.push({
      mesh,
      kind,
      vy: 0,
      bob: Math.random() * Math.PI * 2,
      pickupDelay: 0.9,
      life: 240 // items eventually vanish so the scene stays clean
    });
    return mesh;
  }

  cookDrop(drop) {
    if (drop.kind !== 'raw_fish') return false;
    drop.kind = 'cooked_fish';
    drop.mesh.material.color.setHex(ITEM_DEFS.cooked_fish.color);
    drop.pickupDelay = Math.min(drop.pickupDelay, 0.25);
    const p = drop.mesh.position;
    this.particles.spawnSmokePuff(p.x, p.y + 0.4, p.z, 10);
    this.particles.spawnFlameBurst(p.x, p.y + 0.2, p.z, 8, 0.6);
    sounds.playCookSound();
    if (this.onCook) this.onCook();
    return true;
  }

  // Any raw fish lying within `radius` of a fire gets roasted
  cookNear(pos, radius) {
    let cooked = 0;
    for (const d of this.drops) {
      if (d.kind !== 'raw_fish') continue;
      if (d.mesh.position.distanceTo(pos) <= radius) {
        if (this.cookDrop(d)) cooked++;
      }
    }
    return cooked;
  }

  // Called by MagicSystem while marching the fireball forward
  hitByFireball(pos) {
    for (const d of this.drops) {
      if (d.kind === 'raw_fish' && d.mesh.position.distanceTo(pos) < 0.8) {
        this.cookDrop(d);
        return true;
      }
    }
    for (let i = 0; i < this.fish.length; i++) {
      if (this.fish[i].mesh.position.distanceTo(pos) < 0.8) {
        const p = this.fish[i].mesh.position.clone();
        this.scene.remove(this.fish[i].mesh);
        this.fish.splice(i, 1);
        this.particles.spawnFlameBurst(p.x, p.y, p.z, 14);
        this.particles.spawnSmokePuff(p.x, p.y + 0.4, p.z, 8);
        // Roasted straight out of the air
        this.addDrop(p.x, p.y, p.z, 'cooked_fish');
        sounds.playCookSound();
        return true;
      }
    }
    return false;
  }

  // ---- Per frame -----------------------------------------------------

  update(delta, player) {
    this.updateFish(delta, player);
    this.updateDrops(delta, player);
  }

  updateFish(delta, player) {
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];
      const p = f.mesh.position;

      f.turnTimer -= delta;
      if (f.turnTimer <= 0) {
        f.turnTimer = 1.5 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2;
        f.dir.set(Math.cos(a), 0, Math.sin(a));
      }

      const nx = p.x + f.dir.x * f.speed * delta;
      const nz = p.z + f.dir.z * f.speed * delta;

      // Stay inside the water: bounce off the shoreline
      if (this.isWater(nx, p.y, nz)) {
        p.x = nx;
        p.z = nz;
      } else {
        f.dir.x = -f.dir.x + (Math.random() - 0.5) * 0.4;
        f.dir.z = -f.dir.z + (Math.random() - 0.5) * 0.4;
        f.dir.normalize();
      }

      // Gentle vertical bobbing, clamped to water
      f.bob += delta * 2.2;
      const wantY = f.baseY + Math.sin(f.bob) * 0.22;
      if (this.isWater(p.x, wantY, p.z)) {
        p.y = wantY;
      }

      f.mesh.rotation.y = Math.atan2(-f.dir.z, f.dir.x);
      const tail = f.mesh.userData.tail;
      if (tail) tail.rotation.y = Math.sin(f.bob * 4) * 0.7;

      // Swim into the fish to catch it
      if (player && p.distanceTo(player.position) < 1.35) {
        this.catchFish(i);
      }
    }
  }

  updateDrops(delta, player) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const p = d.mesh.position;

      d.life -= delta;
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        this.drops.splice(i, 1);
        continue;
      }

      if (d.pickupDelay > 0) d.pickupDelay -= delta;

      // Fall until it rests on something solid
      const below = Math.floor(p.y - 0.15);
      if (!this.world.isSolid(Math.floor(p.x), below, Math.floor(p.z))) {
        d.vy -= 18 * delta;
        p.y += d.vy * delta;
        if (p.y < 0.5) {
          p.y = 0.5;
          d.vy = 0;
        }
      } else {
        d.vy = 0;
        p.y = below + 1.25;
      }

      d.bob += delta * 3;
      d.mesh.rotation.y += delta * 1.8;
      d.mesh.position.y += Math.sin(d.bob) * delta * 0.25;

      if (d.kind === 'cooked_fish' && Math.random() < delta * 2.5) {
        this.particles.spawnSmokePuff(p.x, p.y + 0.3, p.z, 1);
      }

      if (player && d.pickupDelay <= 0 && p.distanceTo(player.position) < 1.5) {
        this.scene.remove(d.mesh);
        this.drops.splice(i, 1);
        sounds.playClickSound();
        if (this.onPickup) this.onPickup(d.kind);
      }
    }
  }
}
