import { BLOCKS } from './blocks.js';

export class StorageManager {
  constructor(world, player) {
    this.world = world;
    this.player = player;
  }

  saveToLocalStorage() {
    try {
      const data = {
        version: 1,
        seed: this.world.seed,
        player: {
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z,
          yaw: this.player.yaw,
          pitch: this.player.pitch,
          isFlying: this.player.isFlying
        },
        modifications: Array.from(this.world.customBlocks.entries()).map(([k, id]) => {
          const [x, y, z] = k.split(',').map(Number);
          return { x, y, z, id };
        }),
        timestamp: Date.now()
      };
      localStorage.setItem('minecraft_web_save', JSON.stringify(data));
      return { success: true, count: data.modifications.length };
    } catch (err) {
      console.error('Save failed:', err);
      return { success: false, error: err.message };
    }
  }

  loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem('minecraft_web_save');
      if (!raw) return { success: false, message: '未找到本地存档' };
      const data = JSON.parse(raw);
      this.applyData(data);
      return { success: true, count: data.modifications?.length || 0 };
    } catch (err) {
      console.error('Load failed:', err);
      return { success: false, error: err.message };
    }
  }

  exportToFile() {
    const data = {
      version: 1,
      game: 'Minecraft Web (Three.js)',
      seed: this.world.seed,
      player: {
        x: Number(this.player.position.x.toFixed(2)),
        y: Number(this.player.position.y.toFixed(2)),
        z: Number(this.player.position.z.toFixed(2)),
        yaw: Number(this.player.yaw.toFixed(3)),
        pitch: Number(this.player.pitch.toFixed(3)),
        isFlying: this.player.isFlying
      },
      modifications: Array.from(this.world.customBlocks.entries()).map(([k, id]) => {
        const [x, y, z] = k.split(',').map(Number);
        return { x, y, z, id };
      }),
      exportDate: new Date().toLocaleString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minecraft_world_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return data.modifications.length;
  }

  importFromFile(file, onComplete) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || !data.version) {
          throw new Error('无效的 Minecraft 存档文件格式');
        }
        this.applyData(data);
        if (onComplete) onComplete({ success: true, count: data.modifications?.length || 0 });
      } catch (err) {
        if (onComplete) onComplete({ success: false, error: err.message });
      }
    };
    reader.readAsText(file);
  }

  applyData(data) {
    if (data.seed !== undefined) {
      this.world.initWorld(data.seed);
    }
    if (Array.isArray(data.modifications)) {
      for (const item of data.modifications) {
        this.world.setBlock(item.x, item.y, item.z, item.id, true);
      }
    }
    if (data.player) {
      this.player.position.set(data.player.x, data.player.y, data.player.z);
      this.player.yaw = data.player.yaw || 0;
      this.player.pitch = data.player.pitch || 0;
      if (data.player.isFlying !== undefined) {
        this.player.isFlying = data.player.isFlying;
      }
    }
  }

  // Generate Architectural Presets near player
  loadPreset(presetName) {
    const px = Math.round(this.player.position.x);
    const pz = Math.round(this.player.position.z);
    const py = Math.max(12, this.world.getSurfaceHeight(px, pz) + 1);

    if (presetName === 'castle') {
      this.buildCastle(px, py, pz);
    } else if (presetName === 'villa') {
      this.buildModernVilla(px, py, pz);
    } else if (presetName === 'treehouse') {
      this.buildGiantTreehouse(px, py, pz);
    } else if (presetName === 'pyramid') {
      this.buildPyramid(px, py, pz);
    }

    // Move player slightly back to view the magnificent structure!
    this.player.position.set(px, py + 12, pz + 20);
    this.player.yaw = 0;
    this.player.pitch = -0.3;
    this.player.isFlying = true;
  }

  // 1. Medieval Castle (中世纪城堡)
  buildCastle(cx, baseY, cz) {
    const size = 16;
    const half = Math.floor(size / 2);
    const wallH = 6;
    const towerH = 10;

    // Foundation & Walls
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        const wx = cx + x;
        const wz = cz + z;

        // Courtyard floor
        this.world.setBlock(wx, baseY, wz, BLOCKS.COBBLESTONE);

        const isBorder = (Math.abs(x) === half || Math.abs(z) === half);
        const isCorner = (Math.abs(x) >= half - 2 && Math.abs(z) >= half - 2);

        if (isCorner) {
          // 4 Corner Towers (3x3)
          for (let y = 1; y <= towerH; y++) {
            const isTowerEdge = (Math.abs(x) === half || Math.abs(x) === half - 2 || Math.abs(z) === half || Math.abs(z) === half - 2);
            if (isTowerEdge) {
              this.world.setBlock(wx, baseY + y, wz, BLOCKS.STONE);
            } else {
              this.world.setBlock(wx, baseY + y, wz, y === towerH ? BLOCKS.OAK_PLANKS : BLOCKS.AIR);
            }
          }
          // Tower battlements & lanterns
          if ((x + z) % 2 === 0) {
            this.world.setBlock(wx, baseY + towerH + 1, wz, BLOCKS.COBBLESTONE);
          }
          if (Math.abs(x) === half - 1 && Math.abs(z) === half - 1) {
            this.world.setBlock(wx, baseY + towerH + 1, wz, BLOCKS.GLOWSTONE);
          }
        } else if (isBorder) {
          // Castle Walls
          const isGate = (z === half && Math.abs(x) <= 1);
          for (let y = 1; y <= wallH; y++) {
            if (isGate && y <= 3) {
              this.world.setBlock(wx, baseY + y, wz, BLOCKS.AIR); // Gate opening
            } else {
              this.world.setBlock(wx, baseY + y, wz, BLOCKS.COBBLESTONE);
            }
          }
          // Wall crenellations
          if ((x + z) % 2 === 0 && !isGate) {
            this.world.setBlock(wx, baseY + wallH + 1, wz, BLOCKS.COBBLESTONE);
          }
        }
      }
    }

    // Castle Keep (Center Tower)
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        const wx = cx + x;
        const wz = cz + z;
        for (let y = 1; y <= 14; y++) {
          if (Math.abs(x) === 2 || Math.abs(z) === 2) {
            this.world.setBlock(wx, baseY + y, wz, BLOCKS.BRICKS);
          } else {
            this.world.setBlock(wx, baseY + y, wz, y % 4 === 0 ? BLOCKS.OAK_PLANKS : BLOCKS.AIR);
          }
        }
      }
    }
    // Keep Glowstone beacon
    this.world.setBlock(cx, baseY + 15, cz, BLOCKS.GLOWSTONE);
  }

  // 2. Modern Villa (现代海景别墅)
  buildModernVilla(cx, baseY, cz) {
    const w = 14;
    const d = 12;
    const h = 7;

    for (let x = -w / 2; x <= w / 2; x++) {
      for (let z = -d / 2; z <= d / 2; z++) {
        const wx = Math.floor(cx + x);
        const wz = Math.floor(cz + z);

        // Ground Floor
        this.world.setBlock(wx, baseY, wz, BLOCKS.OAK_PLANKS);

        // First floor walls & windows
        for (let y = 1; y <= 3; y++) {
          if (Math.abs(x) === Math.floor(w / 2) || z === -Math.floor(d / 2)) {
            this.world.setBlock(wx, baseY + y, wz, BLOCKS.IRON_BLOCK);
          } else if (z === Math.floor(d / 2)) {
            // Front large glass windows
            if (x === 0 && y <= 2) {
              this.world.setBlock(wx, baseY + y, wz, BLOCKS.AIR); // Door
            } else {
              this.world.setBlock(wx, baseY + y, wz, BLOCKS.GLASS);
            }
          }
        }

        // Second floor slab
        this.world.setBlock(wx, baseY + 4, wz, BLOCKS.IRON_BLOCK);

        // Second floor & balcony
        for (let y = 5; y <= h; y++) {
          if (z < 0 && (Math.abs(x) === Math.floor(w / 2) || z === -Math.floor(d / 2))) {
            this.world.setBlock(wx, baseY + y, wz, BLOCKS.IRON_BLOCK);
          } else if (z === 0) {
            this.world.setBlock(wx, baseY + y, wz, BLOCKS.GLASS);
          } else if (z > 0 && y === 5 && (Math.abs(x) === Math.floor(w / 2) || z === Math.floor(d / 2))) {
            // Balcony glass railing
            this.world.setBlock(wx, baseY + y, wz, BLOCKS.GLASS);
          }
        }

        // Roof
        if (z <= 0) {
          this.world.setBlock(wx, baseY + h + 1, wz, BLOCKS.OAK_PLANKS);
        }
      }
    }

    // Interior Bookshelf & Glowstone
    this.world.setBlock(cx - 4, baseY + 1, cz - 4, BLOCKS.BOOKSHELF);
    this.world.setBlock(cx - 4, baseY + 2, cz - 4, BLOCKS.BOOKSHELF);
    this.world.setBlock(cx - 3, baseY + 1, cz - 4, BLOCKS.BOOKSHELF);
    this.world.setBlock(cx - 3, baseY + 2, cz - 4, BLOCKS.BOOKSHELF);
    this.world.setBlock(cx, baseY + 4, cz - 2, BLOCKS.GLOWSTONE);
    this.world.setBlock(cx, baseY + h + 1, cz - 2, BLOCKS.GLOWSTONE);

    // Swimming pool in front
    for (let px = -3; px <= 3; px++) {
      for (let pz = d / 2 + 2; pz <= d / 2 + 5; pz++) {
        const wx = Math.floor(cx + px);
        const wz = Math.floor(cz + pz);
        this.world.setBlock(wx, baseY - 1, wz, BLOCKS.DIAMOND_BLOCK);
        this.world.setBlock(wx, baseY, wz, BLOCKS.WATER);
      }
    }
  }

  // 3. Giant Treehouse (巨型空中树屋)
  buildGiantTreehouse(cx, baseY, cz) {
    const trunkHeight = 16;
    const trunkRad = 2;

    // Huge trunk
    for (let y = 0; y <= trunkHeight; y++) {
      for (let x = -trunkRad; x <= trunkRad; x++) {
        for (let z = -trunkRad; z <= trunkRad; z++) {
          const dist = Math.sqrt(x * x + z * z);
          if (dist <= trunkRad + 0.3) {
            // Hollow inside for staircase
            if (dist < 1.0 && y > 1 && y < trunkHeight) {
              this.world.setBlock(cx + x, baseY + y, cz + z, BLOCKS.AIR);
            } else {
              this.world.setBlock(cx + x, baseY + y, cz + z, BLOCKS.OAK_LOG);
            }
          }
        }
      }
    }

    // Suspended treehouse platform
    const platformY = baseY + trunkHeight - 3;
    const platRad = 7;
    for (let x = -platRad; x <= platRad; x++) {
      for (let z = -platRad; z <= platRad; z++) {
        if (Math.sqrt(x * x + z * z) <= platRad) {
          this.world.setBlock(cx + x, platformY, cz + z, BLOCKS.OAK_PLANKS);
        }
      }
    }

    // Treehouse Cabin
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        if (Math.abs(x) === 4 || Math.abs(z) === 4) {
          for (let y = 1; y <= 3; y++) {
            const isWindow = (y === 2 && (Math.abs(x) === 2 || Math.abs(z) === 2));
            this.world.setBlock(cx + x, platformY + y, cz + z, isWindow ? BLOCKS.GLASS : BLOCKS.OAK_PLANKS);
          }
        }
      }
    }

    // Massive leaf canopy
    const canopyCenterY = baseY + trunkHeight + 2;
    for (let dy = -3; dy <= 4; dy++) {
      const radius = 9 - Math.abs(dy) * 1.5;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx * dx + dz * dz <= radius * radius) {
            const wx = cx + Math.floor(dx);
            const wy = canopyCenterY + dy;
            const wz = cz + Math.floor(dz);
            if (this.world.getBlock(wx, wy, wz) === BLOCKS.AIR) {
              this.world.setBlock(wx, wy, wz, BLOCKS.OAK_LEAVES);
            }
          }
        }
      }
    }

    // Lanterns
    this.world.setBlock(cx, platformY + 4, cz, BLOCKS.GLOWSTONE);
    this.world.setBlock(cx + 5, platformY + 1, cz, BLOCKS.GLOWSTONE);
    this.world.setBlock(cx - 5, platformY + 1, cz, BLOCKS.GLOWSTONE);
  }

  // 4. Golden Pyramid (黄金金字塔)
  buildPyramid(cx, baseY, cz) {
    const baseSize = 15; // odd number
    const half = Math.floor(baseSize / 2);

    for (let step = 0; step <= half; step++) {
      const r = half - step;
      const y = baseY + step;
      const isTop = step === half;

      for (let x = -r; x <= r; x++) {
        for (let z = -r; z <= r; z++) {
          const isEdge = Math.abs(x) === r || Math.abs(z) === r;
          const wx = cx + x;
          const wz = cz + z;

          if (isTop) {
            // Summit diamond beacon
            this.world.setBlock(wx, y, wz, BLOCKS.DIAMOND_BLOCK);
            this.world.setBlock(wx, y + 1, wz, BLOCKS.GLOWSTONE);
          } else if (step === half - 1) {
            // Golden upper tier
            this.world.setBlock(wx, y, wz, BLOCKS.GOLD_BLOCK);
          } else if (isEdge) {
            this.world.setBlock(wx, y, wz, BLOCKS.SAND);
          } else if (step === 0) {
            // Base floor
            this.world.setBlock(wx, y, wz, BLOCKS.SAND);
          } else {
            // Hollow interior chamber at step 1-3
            if (step >= 1 && step <= 3 && Math.abs(x) <= 2 && Math.abs(z) <= 2) {
              if (step === 1 && x === 0 && z === 0) {
                this.world.setBlock(wx, y, wz, BLOCKS.GOLD_BLOCK); // Treasure block
              } else if (step === 2 && x === 0 && z === 0) {
                this.world.setBlock(wx, y, wz, BLOCKS.BOOKSHELF);
              } else {
                this.world.setBlock(wx, y, wz, BLOCKS.AIR);
              }
            } else {
              this.world.setBlock(wx, y, wz, BLOCKS.SAND);
            }
          }
        }
      }
    }
  }
}
