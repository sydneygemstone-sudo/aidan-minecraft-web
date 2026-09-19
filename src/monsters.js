import * as THREE from 'three';
import { BLOCKS } from './blocks.js';
import { sounds } from './audio.js';
import { stepOnGround, isWalkable } from './walk.js';

const MAX_MONSTERS = 10;
const SPAWN_MIN_DIST = 13;
const SPAWN_MAX_DIST = 26;
const DESPAWN_DIST = 70;

export class Monsters {
  constructor(scene, world, particles, creatures) {
    this.scene = scene;
    this.world = world;
    this.particles = particles;
    this.creatures = creatures;

    this.list = [];
    this.spawnTimer = 0;
    this.killCount = 0;

    this.onKill = null; // () => void
    this.onHurtPlayer = null; // (damage) => void
    this.onSpawnFirst = null; // () => void, first monster of the night

    this.bodyGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
    this.headGeo = new THREE.BoxGeometry(0.62, 0.5, 0.62);
    this.eyeGeo = new THREE.BoxGeometry(0.14, 0.14, 0.08);
    this.legGeo = new THREE.BoxGeometry(0.22, 0.42, 0.22);

    // Glowing eyes — MeshBasic so they stay bright in the dark
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3b2f });
    this.announcedTonight = false;
  }

  makeMesh() {
    const group = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0x6b3fa0 });

    const body = new THREE.Mesh(this.bodyGeo, skin);
    body.position.y = 0.75;
    group.add(body);

    const head = new THREE.Mesh(this.headGeo, skin);
    head.position.y = 1.42;
    group.add(head);

    const eyeL = new THREE.Mesh(this.eyeGeo, this.eyeMat);
    eyeL.position.set(-0.15, 1.45, 0.32);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(this.eyeGeo, this.eyeMat);
    eyeR.position.set(0.15, 1.45, 0.32);
    group.add(eyeR);

    const legL = new THREE.Mesh(this.legGeo, skin);
    legL.position.set(-0.22, 0.21, 0);
    group.add(legL);
    const legR = new THREE.Mesh(this.legGeo, skin);
    legR.position.set(0.22, 0.21, 0);
    group.add(legR);

    group.userData.skin = skin;
    group.userData.legL = legL;
    group.userData.legR = legR;
    return group;
  }

  canStandOn(id) {
    return isWalkable(id);
  }

  trySpawn(playerPos) {
    if (this.list.length >= MAX_MONSTERS) return false;

    for (let attempt = 0; attempt < 12; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = SPAWN_MIN_DIST + Math.random() * (SPAWN_MAX_DIST - SPAWN_MIN_DIST);
      const x = Math.floor(playerPos.x + Math.cos(ang) * dist);
      const z = Math.floor(playerPos.z + Math.sin(ang) * dist);

      const surfaceY = this.world.getSurfaceHeight(x, z);
      const ground = this.world.getBlock(x, surfaceY, z);
      if (!this.canStandOn(ground)) continue;
      // Not inside water and not buried
      if (this.world.getBlock(x, surfaceY + 1, z) !== BLOCKS.AIR) continue;

      this.add(x + 0.5, surfaceY + 1, z + 0.5);
      return true;
    }
    return false;
  }

  add(x, y, z) {
    const mesh = this.makeMesh();
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    this.list.push({
      mesh,
      health: 2,
      hurtFlash: 0,
      attackCooldown: 0,
      walk: Math.random() * Math.PI * 2,
      wander: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
      wanderTimer: 1 + Math.random() * 2,
      burning: 0
    });

    if (!this.announcedTonight) {
      this.announcedTonight = true;
      if (this.onSpawnFirst) this.onSpawnFirst();
    }
    return mesh;
  }

  remove(i) {
    this.scene.remove(this.list[i].mesh);
    this.list.splice(i, 1);
  }

  clear() {
    for (const m of this.list) this.scene.remove(m.mesh);
    this.list.length = 0;
  }

  // Fireball hit — returns true if the fireball was consumed
  hitByFireball(pos) {
    for (let i = 0; i < this.list.length; i++) {
      const m = this.list[i];
      const c = m.mesh.position;
      // Roughly body-sized box around the monster
      if (Math.abs(c.x - pos.x) < 0.65 && Math.abs(c.z - pos.z) < 0.65 &&
          pos.y > c.y - 0.2 && pos.y < c.y + 2.0) {
        this.damage(i, 1, pos);
        return true;
      }
    }
    return false;
  }

  damage(i, amount, fromPos) {
    const m = this.list[i];
    m.health -= amount;
    m.hurtFlash = 0.25;

    const p = m.mesh.position;
    this.particles.spawnFlameBurst(p.x, p.y + 0.9, p.z, 10);

    if (m.health <= 0) {
      this.kill(i);
      return;
    }

    // Knock it back a little so a hit feels like it landed
    if (fromPos) {
      const dx = p.x - fromPos.x;
      const dz = p.z - fromPos.z;
      const len = Math.hypot(dx, dz) || 1;
      p.x += (dx / len) * 0.7;
      p.z += (dz / len) * 0.7;
    }
    sounds.playFireHitSound();
  }

  kill(i) {
    const p = this.list[i].mesh.position.clone();
    this.particles.spawnFlameBurst(p.x, p.y + 0.8, p.z, 20);
    this.particles.spawnSmokePuff(p.x, p.y + 1.0, p.z, 12);
    this.remove(i);
    this.killCount++;
    sounds.playMonsterDieSound();

    // Roasted by your fire magic — it leaves cooked meat behind
    if (this.creatures) this.creatures.addDrop(p.x, p.y + 0.6, p.z, 'cooked_meat');
    if (this.onKill) this.onKill(this.killCount);
  }

  // Burn away at sunrise, one by one, with smoke
  burnUpAtDawn(delta) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      m.burning += delta;
      const p = m.mesh.position;
      if (Math.random() < delta * 6) {
        this.particles.spawnFlameBurst(p.x, p.y + 0.9, p.z, 2, 0.5);
        this.particles.spawnSmokePuff(p.x, p.y + 1.1, p.z, 1);
      }
      if (m.burning > 1.2 + i * 0.15) {
        this.particles.spawnSmokePuff(p.x, p.y + 0.9, p.z, 8);
        this.remove(i);
      }
    }
  }

  update(delta, player, isDeepNight) {
    // Daytime: no new spawns, and whatever is left burns up in the sunlight
    if (!isDeepNight) {
      this.announcedTonight = false;
      if (this.list.length > 0) this.burnUpAtDawn(delta);
      return;
    }

    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.6;
      this.trySpawn(player.position);
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      const p = m.mesh.position;

      if (m.hurtFlash > 0) {
        m.hurtFlash -= delta;
        m.mesh.userData.skin.color.setHex(m.hurtFlash > 0 ? 0xff6b6b : 0x6b3fa0);
      }
      if (m.attackCooldown > 0) m.attackCooldown -= delta;

      const dx = player.position.x - p.x;
      const dz = player.position.z - p.z;
      const flatDist = Math.hypot(dx, dz);

      if (flatDist > DESPAWN_DIST) {
        this.remove(i);
        continue;
      }

      // Monsters notice the player from further away than they can spawn, so
      // every monster that appears at night actually comes looking for you.
      let dirX;
      let dirZ;
      const speed = flatDist < 14 ? 2.4 : 1.7;
      if (flatDist < 32 && flatDist > 0.6) {
        dirX = dx / flatDist;
        dirZ = dz / flatDist;
      } else {
        m.wanderTimer -= delta;
        if (m.wanderTimer <= 0) {
          m.wanderTimer = 1.5 + Math.random() * 2.5;
          m.wander.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        }
        dirX = m.wander.x;
        dirZ = m.wander.z;
      }

      // Walk on the surface, sidestepping water and cliffs instead of
      // grinding into them forever while chasing the player
      if (!stepOnGround(this.world, p, dirX, dirZ, speed, delta, 2)) {
        m.wanderTimer = 0;
      }

      // Face the direction of travel + little walking bob
      m.mesh.rotation.y = Math.atan2(dirX, dirZ);
      m.walk += delta * 9;
      const swing = Math.sin(m.walk) * 0.35;
      m.mesh.userData.legL.rotation.x = swing;
      m.mesh.userData.legR.rotation.x = -swing;

      // Touching the player hurts
      const dy = Math.abs(player.position.y - p.y);
      if (flatDist < 1.2 && dy < 2.2 && m.attackCooldown <= 0) {
        m.attackCooldown = 1.3;
        sounds.playMonsterHitSound();
        if (this.onHurtPlayer) this.onHurtPlayer(3);
      }
    }
  }
}
