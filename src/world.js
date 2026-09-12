import * as THREE from 'three';
import { BLOCKS, BLOCK_DEFS } from './blocks.js';
import { TILE_INDICES } from './textures.js';
import { SimplexNoise } from './noise.js';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 48;
export const WORLD_CHUNKS_X = 5; // -2 to +2
export const WORLD_CHUNKS_Z = 5; // -2 to +2

export class World {
  constructor(scene, atlasTexture) {
    this.scene = scene;
    this.atlasTexture = atlasTexture;

    // Materials
    this.opaqueMaterial = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
      side: THREE.FrontSide
    });

    this.transparentMaterial = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      alphaTest: 0.15,
      depthWrite: true,
      side: THREE.FrontSide
    });

    // Chunks map: "cx,cz" -> Chunk
    this.chunks = new Map();
    // Raycasting meshes collection
    this.meshList = [];

    this.noise = new SimplexNoise(4242);
    this.seed = 4242;

    // Modified blocks dictionary: "x,y,z" -> blockId (for export/save)
    this.customBlocks = new Map();
  }

  getChunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  getChunk(cx, cz) {
    return this.chunks.get(this.getChunkKey(cx, cz));
  }

  initWorld(seed = 4242) {
    this.seed = seed;
    this.noise = new SimplexNoise(seed);

    // Clear existing
    for (const chunk of this.chunks.values()) {
      chunk.dispose();
    }
    this.chunks.clear();
    this.meshList = [];
    this.customBlocks.clear();

    const halfX = Math.floor(WORLD_CHUNKS_X / 2);
    const halfZ = Math.floor(WORLD_CHUNKS_Z / 2);

    // 1. Generate chunk block data
    for (let cx = -halfX; cx <= halfX; cx++) {
      for (let cz = -halfZ; cz <= halfZ; cz++) {
        const chunk = new Chunk(cx, cz, this);
        this.chunks.set(this.getChunkKey(cx, cz), chunk);
        chunk.generateTerrain();
      }
    }

    // 2. Add trees across chunks
    for (let cx = -halfX; cx <= halfX; cx++) {
      for (let cz = -halfZ; cz <= halfZ; cz++) {
        const chunk = this.chunks.get(this.getChunkKey(cx, cz));
        chunk.generateFeatures();
      }
    }

    // 3. Build meshes
    this.rebuildAllMeshes();
  }

  rebuildAllMeshes() {
    this.meshList = [];
    for (const chunk of this.chunks.values()) {
      chunk.buildMesh();
    }
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCKS.AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BLOCKS.AIR;
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getLocalBlock(lx, y, lz);
  }

  setBlock(x, y, z, blockId, recordCustom = true) {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return false;

    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    chunk.setLocalBlock(lx, y, lz, blockId);
    if (recordCustom) {
      this.customBlocks.set(`${x},${y},${z}`, blockId);
    }

    chunk.dirty = true;

    // Check neighbors across chunk boundaries
    if (lx === 0) {
      const neighbor = this.getChunk(cx - 1, cz);
      if (neighbor) neighbor.dirty = true;
    } else if (lx === CHUNK_SIZE - 1) {
      const neighbor = this.getChunk(cx + 1, cz);
      if (neighbor) neighbor.dirty = true;
    }
    if (lz === 0) {
      const neighbor = this.getChunk(cx, cz - 1);
      if (neighbor) neighbor.dirty = true;
    } else if (lz === CHUNK_SIZE - 1) {
      const neighbor = this.getChunk(cx, cz + 1);
      if (neighbor) neighbor.dirty = true;
    }

    this.updateDirtyChunks();
    return true;
  }

  updateDirtyChunks() {
    for (const chunk of this.chunks.values()) {
      if (chunk.dirty) {
        chunk.buildMesh();
      }
    }
  }

  isSolid(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (id === BLOCKS.AIR || id === BLOCKS.WATER) return false;
    return true;
  }

  isTransparent(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (id === BLOCKS.AIR) return true;
    const def = BLOCK_DEFS[id];
    return def ? !!def.transparent : false;
  }

  // Find surface height at given world (x, z)
  getSurfaceHeight(x, z) {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const b = this.getBlock(x, y, z);
      if (b !== BLOCKS.AIR && b !== BLOCKS.WATER) {
        return y;
      }
    }
    return 10;
  }

  // Export current world state
  exportWorldData() {
    const modifications = [];
    for (const [key, blockId] of this.customBlocks.entries()) {
      const [x, y, z] = key.split(',').map(Number);
      modifications.push({ x, y, z, id: blockId });
    }
    return {
      version: 1,
      seed: this.seed,
      modifications,
      date: new Date().toISOString()
    };
  }

  // Import world state
  importWorldData(data) {
    if (!data) return false;
    this.initWorld(data.seed || 4242);
    if (Array.isArray(data.modifications)) {
      for (const item of data.modifications) {
        this.setBlock(item.x, item.y, item.z, item.id, true);
      }
    }
    return true;
  }
}

export class Chunk {
  constructor(cx, cz, world) {
    this.cx = cx;
    this.cz = cz;
    this.world = world;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.opaqueMesh = null;
    this.transMesh = null;
    this.dirty = false;
  }

  getIndex(lx, ly, lz) {
    return (ly * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
  }

  getLocalBlock(lx, ly, lz) {
    if (ly < 0 || ly >= CHUNK_HEIGHT || lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) {
      return BLOCKS.AIR;
    }
    return this.blocks[this.getIndex(lx, ly, lz)];
  }

  setLocalBlock(lx, ly, lz, blockId) {
    if (ly < 0 || ly >= CHUNK_HEIGHT || lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) {
      return;
    }
    this.blocks[this.getIndex(lx, ly, lz)] = blockId;
  }

  generateTerrain() {
    const waterLevel = 9;
    const noise = this.world.noise;

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const gz = this.cz * CHUNK_SIZE + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const gx = this.cx * CHUNK_SIZE + lx;

        // Multi-octave terrain height
        const n = noise.fractal2D(gx * 0.025, gz * 0.025, 4, 0.45);
        // Base height 10, range 10-24
        const height = Math.floor(12 + n * 14);

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          if (y === 0) {
            this.setLocalBlock(lx, y, lz, BLOCKS.BEDROCK);
          } else if (y < height - 3) {
            this.setLocalBlock(lx, y, lz, BLOCKS.STONE);
          } else if (y < height) {
            this.setLocalBlock(lx, y, lz, BLOCKS.DIRT);
          } else if (y === height) {
            if (y <= waterLevel + 1) {
              this.setLocalBlock(lx, y, lz, BLOCKS.SAND);
            } else {
              this.setLocalBlock(lx, y, lz, BLOCKS.GRASS);
            }
          } else if (y <= waterLevel) {
            this.setLocalBlock(lx, y, lz, BLOCKS.WATER);
          } else {
            this.setLocalBlock(lx, y, lz, BLOCKS.AIR);
          }
        }
      }
    }
  }

  generateFeatures() {
    const waterLevel = 9;
    // Tree generation with pseudo-random check
    for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
      const gz = this.cz * CHUNK_SIZE + lz;
      for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
        const gx = this.cx * CHUNK_SIZE + lx;

        // Tree seed
        const treeRnd = Math.abs(Math.sin(gx * 127.1 + gz * 311.7) * 43758.5453) % 1;
        if (treeRnd < 0.025) {
          // Find grass surface
          for (let y = CHUNK_HEIGHT - 6; y > waterLevel + 1; y--) {
            if (this.getLocalBlock(lx, y, lz) === BLOCKS.GRASS) {
              this.plantTree(lx, y + 1, lz);
              break;
            }
          }
        }
      }
    }
  }

  plantTree(lx, ly, lz) {
    const trunkHeight = 4 + (Math.abs(lx * 7 + lz * 13) % 2);
    // Trunk
    for (let y = ly; y < ly + trunkHeight; y++) {
      this.setLocalBlock(lx, y, lz, BLOCKS.OAK_LOG);
    }
    // Leaves canopy (2 layers of 5x5, 1 layer of 3x3, 1 cross top)
    const leafStart = ly + trunkHeight - 2;
    for (let dy = 0; dy < 3; dy++) {
      const rad = dy === 2 ? 1 : 2;
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          if (dx === 0 && dz === 0 && dy < 2) continue; // trunk center
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && dy > 0 && Math.random() > 0.6) continue;
          const targetX = lx + dx;
          const targetY = leafStart + dy;
          const targetZ = lz + dz;
          if (this.getLocalBlock(targetX, targetY, targetZ) === BLOCKS.AIR) {
            this.setLocalBlock(targetX, targetY, targetZ, BLOCKS.OAK_LEAVES);
          }
        }
      }
    }
    // Top cross
    const topY = leafStart + 3;
    this.setLocalBlock(lx, topY, lz, BLOCKS.OAK_LEAVES);
    this.setLocalBlock(lx + 1, topY, lz, BLOCKS.OAK_LEAVES);
    this.setLocalBlock(lx - 1, topY, lz, BLOCKS.OAK_LEAVES);
    this.setLocalBlock(lx, topY, lz + 1, BLOCKS.OAK_LEAVES);
    this.setLocalBlock(lx, topY, lz - 1, BLOCKS.OAK_LEAVES);
  }

  buildMesh() {
    this.dispose();

    const opaque = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
    const trans = { positions: [], normals: [], uvs: [], colors: [], indices: [] };

    const world = this.world;
    const originX = this.cx * CHUNK_SIZE;
    const originZ = this.cz * CHUNK_SIZE;

    // Helper to calculate Ambient Occlusion factor
    function getAO(s1, s2, c) {
      if (s1 && s2) return 0.45;
      const count = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (c ? 1 : 0);
      if (count === 3) return 0.48;
      if (count === 2) return 0.64;
      if (count === 1) return 0.82;
      return 1.0;
    }

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const blockId = this.getLocalBlock(lx, ly, lz);
          if (blockId === BLOCKS.AIR) continue;

          const def = BLOCK_DEFS[blockId];
          if (!def) continue;

          const isTrans = !!def.transparent;
          const targetBuffer = isTrans ? trans : opaque;

          const gx = originX + lx;
          const gy = ly;
          const gz = originZ + lz;

          // 6 Faces Check
          // Face 0: +X (Right)
          const nbrPX = world.getBlock(gx + 1, gy, gz);
          if (this.shouldRenderFace(blockId, nbrPX)) {
            const tileName = def.faces.sides || def.faces.all;
            const sTop = world.isSolid(gx + 1, gy + 1, gz);
            const sBot = world.isSolid(gx + 1, gy - 1, gz);
            const sFront = world.isSolid(gx + 1, gy, gz + 1);
            const sBack = world.isSolid(gx + 1, gy, gz - 1);
            const shade = 0.75;

            const ao0 = getAO(sBot, sBack, world.isSolid(gx + 1, gy - 1, gz - 1)) * shade;
            const ao1 = getAO(sTop, sBack, world.isSolid(gx + 1, gy + 1, gz - 1)) * shade;
            const ao2 = getAO(sTop, sFront, world.isSolid(gx + 1, gy + 1, gz + 1)) * shade;
            const ao3 = getAO(sBot, sFront, world.isSolid(gx + 1, gy - 1, gz + 1)) * shade;

            this.addFace(
              targetBuffer,
              [gx + 1, gy, gz,  gx + 1, gy + 1, gz,  gx + 1, gy + 1, gz + 1,  gx + 1, gy, gz + 1],
              [1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0],
              tileName,
              [ao0, ao1, ao2, ao3]
            );
          }

          // Face 1: -X (Left)
          const nbrNX = world.getBlock(gx - 1, gy, gz);
          if (this.shouldRenderFace(blockId, nbrNX)) {
            const tileName = def.faces.sides || def.faces.all;
            const sTop = world.isSolid(gx - 1, gy + 1, gz);
            const sBot = world.isSolid(gx - 1, gy - 1, gz);
            const sFront = world.isSolid(gx - 1, gy, gz + 1);
            const sBack = world.isSolid(gx - 1, gy, gz - 1);
            const shade = 0.75;

            const ao0 = getAO(sBot, sFront, world.isSolid(gx - 1, gy - 1, gz + 1)) * shade;
            const ao1 = getAO(sTop, sFront, world.isSolid(gx - 1, gy + 1, gz + 1)) * shade;
            const ao2 = getAO(sTop, sBack, world.isSolid(gx - 1, gy + 1, gz - 1)) * shade;
            const ao3 = getAO(sBot, sBack, world.isSolid(gx - 1, gy - 1, gz - 1)) * shade;

            this.addFace(
              targetBuffer,
              [gx, gy, gz + 1,  gx, gy + 1, gz + 1,  gx, gy + 1, gz,  gx, gy, gz],
              [-1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0],
              tileName,
              [ao0, ao1, ao2, ao3]
            );
          }

          // Face 2: +Y (Top)
          const nbrPY = world.getBlock(gx, gy + 1, gz);
          if (this.shouldRenderFace(blockId, nbrPY)) {
            const tileName = def.faces.top || def.faces.all;
            const sLeft = world.isSolid(gx - 1, gy + 1, gz);
            const sRight = world.isSolid(gx + 1, gy + 1, gz);
            const sFront = world.isSolid(gx, gy + 1, gz + 1);
            const sBack = world.isSolid(gx, gy + 1, gz - 1);
            const shade = 1.0;

            const ao0 = getAO(sLeft, sFront, world.isSolid(gx - 1, gy + 1, gz + 1)) * shade;
            const ao1 = getAO(sRight, sFront, world.isSolid(gx + 1, gy + 1, gz + 1)) * shade;
            const ao2 = getAO(sRight, sBack, world.isSolid(gx + 1, gy + 1, gz - 1)) * shade;
            const ao3 = getAO(sLeft, sBack, world.isSolid(gx - 1, gy + 1, gz - 1)) * shade;

            this.addFace(
              targetBuffer,
              [gx, gy + 1, gz + 1,  gx + 1, gy + 1, gz + 1,  gx + 1, gy + 1, gz,  gx, gy + 1, gz],
              [0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0],
              tileName,
              [ao0, ao1, ao2, ao3]
            );
          }

          // Face 3: -Y (Bottom)
          const nbrNY = world.getBlock(gx, gy - 1, gz);
          if (this.shouldRenderFace(blockId, nbrNY)) {
            const tileName = def.faces.bottom || def.faces.all;
            const sLeft = world.isSolid(gx - 1, gy - 1, gz);
            const sRight = world.isSolid(gx + 1, gy - 1, gz);
            const sFront = world.isSolid(gx, gy - 1, gz + 1);
            const sBack = world.isSolid(gx, gy - 1, gz - 1);
            const shade = 0.55;

            const ao0 = getAO(sLeft, sBack, world.isSolid(gx - 1, gy - 1, gz - 1)) * shade;
            const ao1 = getAO(sRight, sBack, world.isSolid(gx + 1, gy - 1, gz - 1)) * shade;
            const ao2 = getAO(sRight, sFront, world.isSolid(gx + 1, gy - 1, gz + 1)) * shade;
            const ao3 = getAO(sLeft, sFront, world.isSolid(gx - 1, gy - 1, gz + 1)) * shade;

            this.addFace(
              targetBuffer,
              [gx, gy, gz,  gx + 1, gy, gz,  gx + 1, gy, gz + 1,  gx, gy, gz + 1],
              [0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0],
              tileName,
              [ao0, ao1, ao2, ao3]
            );
          }

          // Face 4: +Z (Front)
          const nbrPZ = world.getBlock(gx, gy, gz + 1);
          if (this.shouldRenderFace(blockId, nbrPZ)) {
            const tileName = def.faces.sides || def.faces.all;
            const sLeft = world.isSolid(gx - 1, gy, gz + 1);
            const sRight = world.isSolid(gx + 1, gy, gz + 1);
            const sTop = world.isSolid(gx, gy + 1, gz + 1);
            const sBot = world.isSolid(gx, gy - 1, gz + 1);
            const shade = 0.85;

            const ao0 = getAO(sLeft, sBot, world.isSolid(gx - 1, gy - 1, gz + 1)) * shade;
            const ao1 = getAO(sRight, sBot, world.isSolid(gx + 1, gy - 1, gz + 1)) * shade;
            const ao2 = getAO(sRight, sTop, world.isSolid(gx + 1, gy + 1, gz + 1)) * shade;
            const ao3 = getAO(sLeft, sTop, world.isSolid(gx - 1, gy + 1, gz + 1)) * shade;

            this.addFace(
              targetBuffer,
              [gx, gy, gz + 1,  gx + 1, gy, gz + 1,  gx + 1, gy + 1, gz + 1,  gx, gy + 1, gz + 1],
              [0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1],
              tileName,
              [ao0, ao1, ao2, ao3]
            );
          }

          // Face 5: -Z (Back)
          const nbrNZ = world.getBlock(gx, gy, gz - 1);
          if (this.shouldRenderFace(blockId, nbrNZ)) {
            const tileName = def.faces.sides || def.faces.all;
            const sLeft = world.isSolid(gx + 1, gy, gz - 1);
            const sRight = world.isSolid(gx - 1, gy, gz - 1);
            const sTop = world.isSolid(gx, gy + 1, gz - 1);
            const sBot = world.isSolid(gx, gy - 1, gz - 1);
            const shade = 0.85;

            const ao0 = getAO(sLeft, sBot, world.isSolid(gx + 1, gy - 1, gz - 1)) * shade;
            const ao1 = getAO(sRight, sBot, world.isSolid(gx - 1, gy - 1, gz - 1)) * shade;
            const ao2 = getAO(sRight, sTop, world.isSolid(gx - 1, gy + 1, gz - 1)) * shade;
            const ao3 = getAO(sLeft, sTop, world.isSolid(gx + 1, gy + 1, gz - 1)) * shade;

            this.addFace(
              targetBuffer,
              [gx + 1, gy, gz,  gx, gy, gz,  gx, gy + 1, gz,  gx + 1, gy + 1, gz],
              [0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1],
              tileName,
              [ao0, ao1, ao2, ao3]
            );
          }
        }
      }
    }

    // Build Opaque Three.js Mesh
    if (opaque.positions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(opaque.positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(opaque.normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(opaque.uvs, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(opaque.colors, 3));
      geo.setIndex(opaque.indices);
      this.opaqueMesh = new THREE.Mesh(geo, this.world.opaqueMaterial);
      this.opaqueMesh.chunk = this;
      this.world.scene.add(this.opaqueMesh);
      this.world.meshList.push(this.opaqueMesh);
    }

    // Build Transparent Three.js Mesh
    if (trans.positions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(trans.positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(trans.normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(trans.uvs, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(trans.colors, 3));
      geo.setIndex(trans.indices);
      this.transMesh = new THREE.Mesh(geo, this.world.transparentMaterial);
      this.transMesh.chunk = this;
      this.world.scene.add(this.transMesh);
      this.world.meshList.push(this.transMesh);
    }

    this.dirty = false;
  }

  shouldRenderFace(currentBlockId, neighborBlockId) {
    if (neighborBlockId === BLOCKS.AIR) return true;
    const curDef = BLOCK_DEFS[currentBlockId];
    const nbrDef = BLOCK_DEFS[neighborBlockId];

    if (!curDef) return false;
    // Transparent neighbor reveals opaque block
    if (!curDef.transparent && nbrDef?.transparent) return true;
    // Two different transparent blocks reveal each other (e.g. water vs leaves or glass)
    if (curDef.transparent && nbrDef?.transparent && currentBlockId !== neighborBlockId) return true;

    return false;
  }

  addFace(buf, pos, norm, tileName, aos) {
    const startIdx = buf.positions.length / 3;

    // Positions & Normals
    for (let i = 0; i < 12; i++) {
      buf.positions.push(pos[i]);
      buf.normals.push(norm[i]);
    }

    // UVs from tile index
    const tileIdx = TILE_INDICES[tileName] || 0;
    const col = tileIdx % 16;
    const row = Math.floor(tileIdx / 16);

    const pad = 0.001; // prevent texture bleeding
    const u0 = col / 16 + pad;
    const u1 = (col + 1) / 16 - pad;
    const v0 = 1 - (row + 1) / 16 + pad;
    const v1 = 1 - row / 16 - pad;

    // Corner UVs: c0, c1, c2, c3
    buf.uvs.push(
      u0, v0,
      u1, v0,
      u1, v1,
      u0, v1
    );

    // Vertex Colors (AO & Shading)
    for (let i = 0; i < 4; i++) {
      const c = aos[i];
      buf.colors.push(c, c, c);
    }

    // Indices: 0, 1, 2,  0, 2, 3
    buf.indices.push(
      startIdx, startIdx + 1, startIdx + 2,
      startIdx, startIdx + 2, startIdx + 3
    );
  }

  dispose() {
    if (this.opaqueMesh) {
      this.world.scene.remove(this.opaqueMesh);
      this.opaqueMesh.geometry.dispose();
      const idx = this.world.meshList.indexOf(this.opaqueMesh);
      if (idx !== -1) this.world.meshList.splice(idx, 1);
      this.opaqueMesh = null;
    }
    if (this.transMesh) {
      this.world.scene.remove(this.transMesh);
      this.transMesh.geometry.dispose();
      const idx = this.world.meshList.indexOf(this.transMesh);
      if (idx !== -1) this.world.meshList.splice(idx, 1);
      this.transMesh = null;
    }
  }
}
