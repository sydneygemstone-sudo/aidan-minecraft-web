import * as THREE from 'three';

export const BLOCKS = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  OAK_LOG: 5,
  OAK_PLANKS: 6,
  OAK_LEAVES: 7,
  GLASS: 8,
  BRICKS: 9,
  SAND: 10,
  BOOKSHELF: 11,
  DIAMOND_BLOCK: 12,
  GOLD_BLOCK: 13,
  IRON_BLOCK: 14,
  GLOWSTONE: 15,
  TNT: 16,
  OBSIDIAN: 17,
  BEDROCK: 18,
  WATER: 19
};

export const BLOCK_DEFS = {
  [BLOCKS.GRASS]: {
    id: BLOCKS.GRASS,
    name: '草方块',
    enName: 'Grass Block',
    iconTexture: 'grass_side',
    sound: 'grass',
    faces: {
      top: 'grass_top',
      bottom: 'dirt',
      sides: 'grass_side'
    }
  },
  [BLOCKS.DIRT]: {
    id: BLOCKS.DIRT,
    name: '泥土',
    enName: 'Dirt',
    iconTexture: 'dirt',
    sound: 'dirt',
    faces: { all: 'dirt' }
  },
  [BLOCKS.STONE]: {
    id: BLOCKS.STONE,
    name: '石头',
    enName: 'Stone',
    sound: 'stone',
    iconTexture: 'stone',
    faces: { all: 'stone' }
  },
  [BLOCKS.COBBLESTONE]: {
    id: BLOCKS.COBBLESTONE,
    name: '圆石',
    enName: 'Cobblestone',
    sound: 'stone',
    iconTexture: 'cobblestone',
    faces: { all: 'cobblestone' }
  },
  [BLOCKS.OAK_LOG]: {
    id: BLOCKS.OAK_LOG,
    name: '橡木原木',
    enName: 'Oak Log',
    sound: 'wood',
    iconTexture: 'oak_log_side',
    faces: {
      top: 'oak_log_top',
      bottom: 'oak_log_top',
      sides: 'oak_log_side'
    }
  },
  [BLOCKS.OAK_PLANKS]: {
    id: BLOCKS.OAK_PLANKS,
    name: '橡木木板',
    enName: 'Oak Planks',
    sound: 'wood',
    iconTexture: 'oak_planks',
    faces: { all: 'oak_planks' }
  },
  [BLOCKS.OAK_LEAVES]: {
    id: BLOCKS.OAK_LEAVES,
    name: '橡树树叶',
    enName: 'Oak Leaves',
    sound: 'grass',
    iconTexture: 'oak_leaves',
    transparent: true,
    opacity: 0.95,
    faces: { all: 'oak_leaves' }
  },
  [BLOCKS.GLASS]: {
    id: BLOCKS.GLASS,
    name: '玻璃',
    enName: 'Glass',
    sound: 'glass',
    iconTexture: 'glass',
    transparent: true,
    opacity: 0.65,
    faces: { all: 'glass' }
  },
  [BLOCKS.BRICKS]: {
    id: BLOCKS.BRICKS,
    name: '红砖块',
    enName: 'Bricks',
    sound: 'stone',
    iconTexture: 'bricks',
    faces: { all: 'bricks' }
  },
  [BLOCKS.SAND]: {
    id: BLOCKS.SAND,
    name: '沙子',
    enName: 'Sand',
    sound: 'sand',
    iconTexture: 'sand',
    faces: { all: 'sand' }
  },
  [BLOCKS.BOOKSHELF]: {
    id: BLOCKS.BOOKSHELF,
    name: '书架',
    enName: 'Bookshelf',
    sound: 'wood',
    iconTexture: 'bookshelf',
    faces: {
      top: 'oak_planks',
      bottom: 'oak_planks',
      sides: 'bookshelf'
    }
  },
  [BLOCKS.DIAMOND_BLOCK]: {
    id: BLOCKS.DIAMOND_BLOCK,
    name: '钻石块',
    enName: 'Diamond Block',
    sound: 'metal',
    iconTexture: 'diamond_block',
    faces: { all: 'diamond_block' }
  },
  [BLOCKS.GOLD_BLOCK]: {
    id: BLOCKS.GOLD_BLOCK,
    name: '金块',
    enName: 'Gold Block',
    sound: 'metal',
    iconTexture: 'gold_block',
    faces: { all: 'gold_block' }
  },
  [BLOCKS.IRON_BLOCK]: {
    id: BLOCKS.IRON_BLOCK,
    name: '铁块',
    enName: 'Iron Block',
    sound: 'metal',
    iconTexture: 'iron_block',
    faces: { all: 'iron_block' }
  },
  [BLOCKS.GLOWSTONE]: {
    id: BLOCKS.GLOWSTONE,
    name: '荧石',
    enName: 'Glowstone',
    sound: 'glass',
    iconTexture: 'glowstone',
    emissive: true,
    faces: { all: 'glowstone' }
  },
  [BLOCKS.TNT]: {
    id: BLOCKS.TNT,
    name: 'TNT 炸药',
    enName: 'TNT',
    sound: 'grass',
    iconTexture: 'tnt_side',
    faces: {
      top: 'tnt_top',
      bottom: 'tnt_top',
      sides: 'tnt_side'
    }
  },
  [BLOCKS.OBSIDIAN]: {
    id: BLOCKS.OBSIDIAN,
    name: '黑曜石',
    enName: 'Obsidian',
    sound: 'stone',
    iconTexture: 'obsidian',
    faces: { all: 'obsidian' }
  },
  [BLOCKS.BEDROCK]: {
    id: BLOCKS.BEDROCK,
    name: '基岩',
    enName: 'Bedrock',
    sound: 'stone',
    iconTexture: 'bedrock',
    faces: { all: 'bedrock' }
  },
  [BLOCKS.WATER]: {
    id: BLOCKS.WATER,
    name: '水源',
    enName: 'Water',
    sound: 'sand',
    iconTexture: 'water',
    transparent: true,
    opacity: 0.6,
    faces: { all: 'water' }
  }
};

export const ALL_BLOCKS = Object.values(BLOCK_DEFS);

export const DEFAULT_HOTBAR = [
  BLOCKS.GRASS,
  BLOCKS.OAK_LOG,
  BLOCKS.OAK_PLANKS,
  BLOCKS.COBBLESTONE,
  BLOCKS.BRICKS,
  BLOCKS.GLASS,
  BLOCKS.DIAMOND_BLOCK,
  BLOCKS.GLOWSTONE,
  BLOCKS.TNT
];

export function createBlockMaterials(textures) {
  const materials = {};

  for (const block of ALL_BLOCKS) {
    const isTrans = !!block.transparent;
    const opacity = block.opacity || 1.0;
    const isEmissive = !!block.emissive;

    function getMat(texName) {
      const tex = textures[texName];
      const mat = new THREE.MeshLambertMaterial({
        map: tex,
        transparent: isTrans,
        opacity: opacity,
        alphaTest: isTrans && block.id === BLOCKS.OAK_LEAVES ? 0.3 : 0.05,
        side: THREE.FrontSide
      });
      if (isEmissive) {
        mat.emissive = new THREE.Color(0xfff0aa);
        mat.emissiveIntensity = 0.6;
      }
      return mat;
    }

    if (block.faces.all) {
      const mat = getMat(block.faces.all);
      materials[block.id] = [mat, mat, mat, mat, mat, mat];
    } else {
      const topMat = getMat(block.faces.top);
      const botMat = getMat(block.faces.bottom);
      const sideMat = getMat(block.faces.sides);
      // Three.js Box order: +X, -X, +Y, -Y, +Z, -Z
      materials[block.id] = [sideMat, sideMat, topMat, botMat, sideMat, sideMat];
    }
  }

  return materials;
}
