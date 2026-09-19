import * as THREE from 'three';
import { BLOCKS } from './blocks.js';
import { sounds } from './audio.js';
import { CHUNK_SIZE, WORLD_CHUNKS_X, WORLD_CHUNKS_Z } from './world.js';
import { stepOnGround } from './walk.js';

const WATER_LEVEL = 9; // matches Chunk.generateTerrain

// Bright, saturated colours — they have to stay readable through the blue water
const FISH_COLORS = [0xff7a00, 0xffe000, 0xff2f6d, 0x00ffc8, 0xff5ef0, 0xfff3c4];

export const ITEM_DEFS = {
  raw_fish: { name: '生鱼', enName: 'Raw Fish', emoji: '🐟', color: 0xe8806a },
  cooked_fish: { name: '烤鱼', enName: 'Cooked Fish', emoji: '🍢', color: 0xd9a441 },
  berry: { name: '浆果', enName: 'Berry', emoji: '🍓', color: 0xd8324b },
  cooked_meat: { name: '烤肉', enName: 'Cooked Meat', emoji: '🍖', color: 0xb5651d }
};

export class Creatures {
  constructor(scene, world, particles) {
    this.scene = scene;
    this.world = world;
    this.particles = particles;

    this.fish = [];
    this.drops = [];
    this.bushes = []; // berry bushes on the grass
    this.animals = []; // chickens wandering the ground

    // Callbacks wired by main.js
    this.onCatch = null; // (kind) => void
    this.onPickup = null; // (kind) => void
    this.onCook = null; // () => void
    this.onBerry = null; // () => void

    this.bodyGeo = new THREE.BoxGeometry(0.8, 0.46, 0.34);
    this.tailGeo = new THREE.BoxGeometry(0.3, 0.42, 0.08);
    this.eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0x101010 });

    this.dropGeo = new THREE.BoxGeometry(0.42, 0.22, 0.2);

    // Berry bush pieces
    this.bushGeo = new THREE.BoxGeometry(0.62, 0.5, 0.62);
    this.bushMat = new THREE.MeshLambertMaterial({ color: 0x2f6b2a });
    this.berryGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this.berryMat = new THREE.MeshBasicMaterial({ color: 0xff2e4d });

    // Chicken pieces
    this.chickBodyGeo = new THREE.BoxGeometry(0.5, 0.42, 0.38);
    this.chickHeadGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    this.chickBeakGeo = new THREE.BoxGeometry(0.16, 0.1, 0.12);
    this.chickCombGeo = new THREE.BoxGeometry(0.1, 0.12, 0.18);
    this.chickLegGeo = new THREE.BoxGeometry(0.08, 0.26, 0.08);
    this.chickBodyMat = new THREE.MeshLambertMaterial({ color: 0xfaf6ef });
    this.chickBeakMat = new THREE.MeshLambertMaterial({ color: 0xffb300 });
    this.chickCombMat = new THREE.MeshLambertMaterial({ color: 0xe53935 });
  }

  // ---- Berry bushes (ground pickups that grow back) --------------------

  makeBushMesh() {
    const group = new THREE.Group();
    const bush = new THREE.Mesh(this.bushGeo, this.bushMat);
    bush.position.y = 0.25;
    group.add(bush);

    const berries = [];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(this.berryGeo, this.berryMat);
      b.position.set(
        (Math.random() - 0.5) * 0.5,
        0.15 + Math.random() * 0.35,
        (Math.random() - 0.5) * 0.5
      );
      group.add(b);
      berries.push(b);
    }
    group.userData.berries = berries;
    return group;
  }

  addBush(x, y, z) {
    const mesh = this.makeBushMesh();
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.bushes.push({ mesh, ripe: true, regrow: 0 });
  }

  setBushRipe(bush, ripe) {
    bush.ripe = ripe;
    for (const b of bush.mesh.userData.berries) b.visible = ripe;
  }

  pickBush(bush) {
    if (!bush.ripe) return false;
    this.setBushRipe(bush, false);
    bush.regrow = 18; // grows back so Aiden can keep picking
    const p = bush.mesh.position;
    this.particles.spawnPuff(p.x, p.y + 0.4, p.z, 8, {
      colors: [0xff2e4d, 0xff7b8f, 0x2f6b2a],
      size: 0.5, spread: 0.4, speed: 1.4, rise: 1.6, gravity: 6, life: 0.5
    });
    sounds.playCatchSound();
    if (this.onBerry) this.onBerry();
    return true;
  }

  // ---- Chickens (they wander, and follow you if you carry berries) ------

  makeChickenMesh() {
    const group = new THREE.Group();

    const body = new THREE.Mesh(this.chickBodyGeo, this.chickBodyMat);
    body.position.y = 0.42;
    group.add(body);

    const head = new THREE.Mesh(this.chickHeadGeo, this.chickBodyMat);
    head.position.set(0, 0.74, 0.16);
    group.add(head);

    const beak = new THREE.Mesh(this.chickBeakGeo, this.chickBeakMat);
    beak.position.set(0, 0.72, 0.34);
    group.add(beak);

    const comb = new THREE.Mesh(this.chickCombGeo, this.chickCombMat);
    comb.position.set(0, 0.9, 0.14);
    group.add(comb);

    const legL = new THREE.Mesh(this.chickLegGeo, this.chickBeakMat);
    legL.position.set(-0.12, 0.13, 0);
    group.add(legL);
    const legR = new THREE.Mesh(this.chickLegGeo, this.chickBeakMat);
    legR.position.set(0.12, 0.13, 0);
    group.add(legR);

    group.userData.legL = legL;
    group.userData.legR = legR;
    return group;
  }

  addChicken(x, y, z) {
    const mesh = this.makeChickenMesh();
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    const a = Math.random() * Math.PI * 2;
    this.animals.push({
      mesh,
      dir: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)),
      speed: 0.9 + Math.random() * 0.5,
      turnTimer: 1 + Math.random() * 3,
      walk: Math.random() * Math.PI * 2,
      hopTimer: 2 + Math.random() * 4
    });
  }

  // Scatter bushes and chickens across the grass
  spawnGroundLifeInWorld(bushTarget = 40, chickenTarget = 14) {
    this.clearGroundLife();

    const halfX = Math.floor(WORLD_CHUNKS_X / 2);
    const halfZ = Math.floor(WORLD_CHUNKS_Z / 2);
    const minX = -halfX * CHUNK_SIZE;
    const maxX = (halfX + 1) * CHUNK_SIZE - 1;
    const minZ = -halfZ * CHUNK_SIZE;
    const maxZ = (halfZ + 1) * CHUNK_SIZE - 1;

    const spots = [];
    for (let x = minX + 1; x < maxX - 1; x += 2) {
      for (let z = minZ + 1; z < maxZ - 1; z += 2) {
        const y = this.world.getSurfaceHeight(x, z);
        if (this.world.getBlock(x, y, z) !== BLOCKS.GRASS) continue;
        if (this.world.getBlock(x, y + 1, z) !== BLOCKS.AIR) continue; // under a tree
        spots.push({ x, y, z });
      }
    }
    if (spots.length === 0) return { bushes: 0, chickens: 0 };

    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }

    let idx = 0;
    const nBush = Math.min(bushTarget, spots.length);
    for (let i = 0; i < nBush; i++, idx++) {
      const s = spots[idx];
      this.addBush(s.x + 0.5, s.y + 1, s.z + 0.5);
    }
    const nChick = Math.min(chickenTarget, Math.max(0, spots.length - idx));
    for (let i = 0; i < nChick; i++, idx++) {
      const s = spots[idx];
      this.addChicken(s.x + 0.5, s.y + 1, s.z + 0.5);
    }
    return { bushes: nBush, chickens: nChick };
  }

  clearGroundLife() {
    for (const b of this.bushes) this.scene.remove(b.mesh);
    this.bushes.length = 0;
    for (const a of this.animals) this.scene.remove(a.mesh);
    this.animals.length = 0;
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
    this.clearGroundLife();
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

  // The 挖掘 key: first try a fish in the crosshair, then a berry bush
  interactByRay(camera, maxDist = 7) {
    if (this.catchFishByRay(camera, maxDist)) return true;
    return this.pickBushByRay(camera, maxDist);
  }

  pickBushByRay(camera, maxDist = 7) {
    const origin = camera.position;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const ray = new THREE.Ray(origin, dir);
    const tmp = new THREE.Vector3();

    let best = null;
    let bestDist = Infinity;
    for (const bush of this.bushes) {
      if (!bush.ripe) continue;
      const p = bush.mesh.position.clone();
      p.y += 0.3;
      const d = origin.distanceTo(p);
      if (d > maxDist) continue;
      ray.closestPointToPoint(p, tmp);
      if (tmp.distanceTo(p) > 0.8) continue;
      if (d < bestDist) {
        bestDist = d;
        best = bush;
      }
    }
    return best ? this.pickBush(best) : false;
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

  update(delta, player, hasBerries = false) {
    this.updateFish(delta, player);
    this.updateDrops(delta, player);
    this.updateBushes(delta, player);
    this.updateAnimals(delta, player, hasBerries);
  }

  updateBushes(delta, player) {
    for (const bush of this.bushes) {
      if (!bush.ripe) {
        bush.regrow -= delta;
        if (bush.regrow <= 0) this.setBushRipe(bush, true);
        continue;
      }
      // Walking into a ripe bush picks it
      if (player && bush.mesh.position.distanceTo(player.position) < 1.3) {
        this.pickBush(bush);
      }
    }
  }

  updateAnimals(delta, player, hasBerries) {
    for (const a of this.animals) {
      const p = a.mesh.position;

      let dirX = a.dir.x;
      let dirZ = a.dir.z;
      let speed = a.speed;

      // Carrying berries? The chickens come to you.
      const toPlayer = player ? player.position.distanceTo(p) : Infinity;
      if (hasBerries && toPlayer < 10 && toPlayer > 1.2) {
        dirX = (player.position.x - p.x) / toPlayer;
        dirZ = (player.position.z - p.z) / toPlayer;
        speed = a.speed * 1.5;
      } else {
        a.turnTimer -= delta;
        if (a.turnTimer <= 0) {
          a.turnTimer = 1.5 + Math.random() * 3;
          const ang = Math.random() * Math.PI * 2;
          a.dir.set(Math.cos(ang), 0, Math.sin(ang));
          dirX = a.dir.x;
          dirZ = a.dir.z;
        }
      }

      // Try straight ahead first, then sidestep — otherwise a chicken following
      // you gets stuck forever against the first pond or cliff in the way.
      const moved = stepOnGround(this.world, p, dirX, dirZ, speed, delta, 1);
      if (!moved) {
        a.dir.set(-a.dir.x, 0, -a.dir.z).normalize();
        a.turnTimer = 1 + Math.random();
      }

      a.mesh.rotation.y = Math.atan2(dirX, dirZ);
      a.walk += delta * 8;
      const swing = Math.sin(a.walk) * 0.5;
      a.mesh.userData.legL.rotation.x = swing;
      a.mesh.userData.legR.rotation.x = -swing;

      // Occasional little hop
      a.hopTimer -= delta;
      if (a.hopTimer <= 0) {
        a.hopTimer = 3 + Math.random() * 5;
        a.hop = 0.35;
      }
      if (a.hop > 0) {
        a.hop -= delta * 1.4;
        a.mesh.position.y += Math.max(0, a.hop) * delta * 4;
      }
    }
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
