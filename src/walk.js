import { BLOCKS } from './blocks.js';

const WALKABLE = new Set([
  BLOCKS.GRASS,
  BLOCKS.DIRT,
  BLOCKS.SAND,
  BLOCKS.STONE,
  BLOCKS.COBBLESTONE,
  BLOCKS.OAK_PLANKS,
  BLOCKS.BRICKS
]);

// Sidestep angles, in radians, tried in order: straight on, then wider and wider
const ANGLES = [0, 0.6, -0.6, 1.2, -1.2, 2.0, -2.0];

export function isWalkable(id) {
  return WALKABLE.has(id);
}

/**
 * Move a ground-dwelling creature one step.
 *
 * Deliberately does NOT use world.getSurfaceHeight: under a tree that returns
 * the top of the leaf canopy, which is not something anything can stand on, so
 * every creature that wandered under a tree used to freeze in place. Instead we
 * look at the block directly beneath the creature's feet and allow a one-block
 * step up or down, the way a voxel character actually walks.
 *
 * @param height how many air blocks the creature needs above the ground (1 = chicken, 2 = monster)
 * @returns true if it moved
 */
export function stepOnGround(world, pos, dirX, dirZ, speed, delta, height = 2) {
  const feetY = Math.floor(pos.y + 0.001);

  for (const off of ANGLES) {
    const cos = Math.cos(off);
    const sin = Math.sin(off);
    const dx = dirX * cos - dirZ * sin;
    const dz = dirX * sin + dirZ * cos;

    const nx = pos.x + dx * speed * delta;
    const nz = pos.z + dz * speed * delta;
    const bx = Math.floor(nx);
    const bz = Math.floor(nz);

    // Same level first, then step up, then step down
    for (const dy of [0, 1, -1]) {
      const groundY = feetY + dy - 1;
      if (groundY < 0) continue;
      if (!isWalkable(world.getBlock(bx, groundY, bz))) continue;

      let clear = true;
      for (let h = 1; h <= height; h++) {
        if (world.getBlock(bx, groundY + h, bz) !== BLOCKS.AIR) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;

      pos.x = nx;
      pos.z = nz;
      const targetY = groundY + 1;
      pos.y += (targetY - pos.y) * Math.min(1, delta * 12);
      return true;
    }
  }
  return false;
}
