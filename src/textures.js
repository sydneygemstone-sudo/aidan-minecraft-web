import * as THREE from 'three';

function pseudoRandom(x, y, seed = 42) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
  return n - Math.floor(n);
}

function create16Canvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  return canvas;
}

export const TILE_INDICES = {
  dirt: 0,
  grass_top: 1,
  grass_side: 2,
  stone: 3,
  cobblestone: 4,
  oak_log_side: 5,
  oak_log_top: 6,
  oak_planks: 7,
  oak_leaves: 8,
  glass: 9,
  bricks: 10,
  sand: 11,
  bookshelf: 12,
  diamond_block: 13,
  gold_block: 14,
  iron_block: 15,
  glowstone: 16,
  tnt_side: 17,
  tnt_top: 18,
  obsidian: 19,
  bedrock: 20,
  water: 21
};

export function generateBlockTextures() {
  const textures = {};
  const icons = {};

  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = 256;
  atlasCanvas.height = 256;
  const atlasCtx = atlasCanvas.getContext('2d');
  atlasCtx.imageSmoothingEnabled = false;

  function register(name, drawFn) {
    const canvas = create16Canvas();
    const ctx = canvas.getContext('2d');
    drawFn(ctx);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    textures[name] = texture;
    icons[name] = canvas.toDataURL();

    // Draw to atlas
    const tileIdx = TILE_INDICES[name];
    if (tileIdx !== undefined) {
      const col = tileIdx % 16;
      const row = Math.floor(tileIdx / 16);
      atlasCtx.drawImage(canvas, col * 16, row * 16);
    }
  }

  // 1. DIRT
  register('dirt', (ctx) => {
    const palette = ['#866043', '#77543a', '#966c4c', '#60432e', '#80593e'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = Math.floor(pseudoRandom(x, y, 101) * palette.length);
        ctx.fillStyle = palette[r];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // 2. GRASS TOP
  register('grass_top', (ctx) => {
    const palette = ['#5e8e32', '#6da238', '#527f2c', '#4b7528', '#73ab3e'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = Math.floor(pseudoRandom(x, y, 202) * palette.length);
        ctx.fillStyle = palette[r];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // 3. GRASS SIDE
  register('grass_side', (ctx) => {
    const dirtPalette = ['#866043', '#77543a', '#966c4c', '#60432e'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = Math.floor(pseudoRandom(x, y, 303) * dirtPalette.length);
        ctx.fillStyle = dirtPalette[r];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const grassPalette = ['#5e8e32', '#6da238', '#527f2c', '#73ab3e'];
    for (let x = 0; x < 16; x++) {
      const overhang = 3 + Math.floor(pseudoRandom(x, 1, 404) * 3);
      for (let y = 0; y < overhang; y++) {
        const r = Math.floor(pseudoRandom(x, y, 505) * grassPalette.length);
        ctx.fillStyle = grassPalette[r];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // 4. STONE
  register('stone', (ctx) => {
    const palette = ['#737373', '#686868', '#7f7f7f', '#5c5c5c', '#8a8a8a'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = Math.floor(pseudoRandom(x, y, 606) * palette.length);
        ctx.fillStyle = palette[r];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // 5. COBBLESTONE
  register('cobblestone', (ctx) => {
    ctx.fillStyle = '#444444';
    ctx.fillRect(0, 0, 16, 16);
    const stones = [
      { x: 1, y: 1, w: 6, h: 4 },
      { x: 8, y: 1, w: 7, h: 3 },
      { x: 1, y: 6, w: 5, h: 4 },
      { x: 7, y: 5, w: 8, h: 5 },
      { x: 1, y: 11, w: 7, h: 4 },
      { x: 9, y: 11, w: 6, h: 4 }
    ];
    for (const s of stones) {
      for (let y = s.y; y < s.y + s.h; y++) {
        for (let x = s.x; x < s.x + s.w; x++) {
          if (x < 16 && y < 16) {
            const isBorder = x === s.x || y === s.y || x === s.x + s.w - 1 || y === s.y + s.h - 1;
            ctx.fillStyle = isBorder ? '#606060' : (pseudoRandom(x, y, 707) > 0.5 ? '#808080' : '#727272');
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }
  });

  // 6. OAK LOG SIDE
  register('oak_log_side', (ctx) => {
    const barkPalette = ['#624b30', '#554028', '#735839', '#463420'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const col = (x % 4 === 0) ? '#463420' : barkPalette[Math.floor(pseudoRandom(x, y, 808) * barkPalette.length)];
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // 7. OAK LOG TOP
  register('oak_log_top', (ctx) => {
    ctx.fillStyle = '#624b30';
    ctx.fillRect(0, 0, 16, 16);
    for (let y = 1; y < 15; y++) {
      for (let x = 1; x < 15; x++) {
        const dx = x - 7.5;
        const dy = y - 7.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let col = '#a98759';
        if (dist > 6) col = '#624b30';
        else if (dist > 4.5 && dist < 5.8) col = '#8f6e43';
        else if (dist > 2.2 && dist < 3.4) col = '#8f6e43';
        else if (pseudoRandom(x, y, 909) > 0.5) col = '#b89464';
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // 8. OAK PLANKS
  register('oak_planks', (ctx) => {
    const wood = ['#bc9862', '#ad8a54', '#cb9f64', '#9e7b45'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (y % 4 === 0) {
          ctx.fillStyle = '#68502c';
        } else if ((y < 4 && x === 7) || (y >= 4 && y < 8 && x === 14) || (y >= 8 && y < 12 && x === 5) || (y >= 12 && x === 11)) {
          ctx.fillStyle = '#68502c';
        } else {
          ctx.fillStyle = wood[Math.floor(pseudoRandom(x, y, 1010) * wood.length)];
        }
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // 9. OAK LEAVES
  register('oak_leaves', (ctx) => {
    const leaves = ['#387723', '#2d621b', '#488e2c', '#204d12', '#59a738'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const rnd = pseudoRandom(x, y, 1111);
        if (rnd < 0.15) {
          ctx.fillStyle = 'rgba(0,0,0,0)';
        } else {
          const idx = Math.floor(rnd * leaves.length);
          ctx.fillStyle = leaves[idx];
        }
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // 10. GLASS
  register('glass', (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#d5ecf8';
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(0, 0, 1, 16);
    ctx.fillRect(15, 0, 1, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(2, 2, 2, 2);
    ctx.fillRect(4, 4, 3, 2);
    ctx.fillRect(7, 6, 2, 1);
    ctx.fillRect(11, 11, 2, 2);
    ctx.fillRect(13, 13, 1, 1);
    ctx.fillStyle = 'rgba(215, 240, 255, 0.25)';
    ctx.fillRect(1, 1, 14, 14);
  });

  // 11. BRICKS
  register('bricks', (ctx) => {
    ctx.fillStyle = '#c5b59e';
    ctx.fillRect(0, 0, 16, 16);
    const brickCols = ['#9c4939', '#ad5240', '#8b3d2f', '#ba5b47'];
    for (let row = 0; row < 4; row++) {
      const yStart = row * 4;
      const offset = (row % 2 === 0) ? 0 : 4;
      for (let col = 0; col < 3; col++) {
        const xStart = (col * 8 + offset) % 16;
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 7; dx++) {
            const px = (xStart + dx) % 16;
            const py = yStart + dy;
            ctx.fillStyle = brickCols[Math.floor(pseudoRandom(px, py, 1212) * brickCols.length)];
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    }
  });

  // 12. SAND
  register('sand', (ctx) => {
    const palette = ['#dcbe7e', '#d2b474', '#e6c888', '#c8aa6a'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = Math.floor(pseudoRandom(x, y, 1313) * palette.length);
        ctx.fillStyle = palette[r];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // 13. BOOKSHELF
  register('bookshelf', (ctx) => {
    const wood = '#ad8a54';
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#68502c';
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(0, 7, 16, 2);
    ctx.fillRect(0, 15, 16, 1);
    const bookColors = ['#9e2a2b', '#335c67', '#e09f3e', '#540b0e', '#3f88c5', '#795290', '#38b000'];
    for (let shelf = 0; shelf < 2; shelf++) {
      const sy = shelf === 0 ? 1 : 9;
      let bx = 1;
      while (bx < 15) {
        const bw = 1 + Math.floor(pseudoRandom(bx, sy, 1414) * 2);
        const col = bookColors[Math.floor(pseudoRandom(bx, sy, 1515) * bookColors.length)];
        ctx.fillStyle = col;
        ctx.fillRect(bx, sy, Math.min(bw, 15 - bx), 6);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(bx, sy, Math.min(bw, 15 - bx), 1);
        bx += bw + 1;
      }
    }
  });

  // 14. DIAMOND BLOCK
  register('diamond_block', (ctx) => {
    ctx.fillStyle = '#40c9d6';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#6bf2ff';
    ctx.fillRect(1, 1, 14, 1);
    ctx.fillRect(1, 1, 1, 14);
    ctx.fillStyle = '#2297a3';
    ctx.fillRect(1, 14, 14, 1);
    ctx.fillRect(14, 1, 1, 14);
    ctx.fillStyle = '#55e3f0';
    ctx.fillRect(3, 3, 10, 10);
    ctx.fillStyle = '#a6f8ff';
    ctx.fillRect(4, 4, 3, 3);
  });

  // 15. GOLD BLOCK
  register('gold_block', (ctx) => {
    ctx.fillStyle = '#e8b820';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#ffea6c';
    ctx.fillRect(1, 1, 14, 1);
    ctx.fillRect(1, 1, 1, 14);
    ctx.fillStyle = '#ad840f';
    ctx.fillRect(1, 14, 14, 1);
    ctx.fillRect(14, 1, 1, 14);
    ctx.fillStyle = '#ffd13b';
    ctx.fillRect(3, 3, 10, 10);
    ctx.fillStyle = '#fff4a3';
    ctx.fillRect(4, 4, 3, 3);
  });

  // 16. IRON BLOCK
  register('iron_block', (ctx) => {
    ctx.fillStyle = '#d5d5d5';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(1, 1, 14, 1);
    ctx.fillRect(1, 1, 1, 14);
    ctx.fillStyle = '#9e9e9e';
    ctx.fillRect(1, 14, 14, 1);
    ctx.fillRect(14, 1, 1, 14);
    ctx.fillStyle = '#e5e5e5';
    ctx.fillRect(3, 3, 10, 10);
    ctx.fillStyle = '#999999';
    ctx.fillRect(2, 2, 1, 1);
    ctx.fillRect(13, 2, 1, 1);
    ctx.fillRect(2, 13, 1, 1);
    ctx.fillRect(13, 13, 1, 1);
  });

  // 17. GLOWSTONE
  register('glowstone', (ctx) => {
    const palette = ['#ffd455', '#ffbe26', '#fce881', '#df9510', '#fff3ab'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = Math.floor(pseudoRandom(x, y, 1616) * palette.length);
        ctx.fillStyle = palette[r];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // 18. TNT SIDE
  register('tnt_side', (ctx) => {
    ctx.fillStyle = '#cc2a1a';
    ctx.fillRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y++) {
      if (y < 4 || y > 11) {
        for (let x = 0; x < 16; x++) {
          if (x % 4 === 0) {
            ctx.fillStyle = '#8f190e';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 5, 16, 6);
    ctx.fillStyle = '#000000';
    ctx.fillRect(2, 6, 3, 1);
    ctx.fillRect(3, 7, 1, 3);
    ctx.fillRect(6, 6, 1, 4);
    ctx.fillRect(7, 7, 1, 1);
    ctx.fillRect(8, 8, 1, 1);
    ctx.fillRect(9, 6, 1, 4);
    ctx.fillRect(11, 6, 3, 1);
    ctx.fillRect(12, 7, 1, 3);
  });

  // 19. TNT TOP
  register('tnt_top', (ctx) => {
    ctx.fillStyle = '#cc2a1a';
    ctx.fillRect(0, 0, 16, 16);
    for (let gy = 1; gy < 15; gy += 4) {
      for (let gx = 1; gx < 15; gx += 4) {
        ctx.fillStyle = '#8f190e';
        ctx.strokeRect(gx, gy, 3, 3);
      }
    }
    ctx.fillStyle = '#444444';
    ctx.fillRect(7, 7, 2, 2);
  });

  // 20. OBSIDIAN
  register('obsidian', (ctx) => {
    const palette = ['#151022', '#1f1633', '#2a1a45', '#100b1a', '#3e2468'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = Math.floor(pseudoRandom(x, y, 1717) * palette.length);
        ctx.fillStyle = palette[r];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // 21. BEDROCK
  register('bedrock', (ctx) => {
    const palette = ['#111111', '#222222', '#333333', '#080808', '#444444'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = Math.floor(pseudoRandom(x, y, 1818) * palette.length);
        ctx.fillStyle = palette[r];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // 22. WATER
  register('water', (ctx) => {
    const blues = ['#2f5cd6', '#264eb8', '#386ef2', '#1e3f94'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = Math.floor(pseudoRandom(x, y, 1919) * blues.length);
        ctx.fillStyle = blues[r];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // Create Atlas Texture
  const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.colorSpace = THREE.SRGBColorSpace;

  return { textures, icons, atlasTexture };
}
