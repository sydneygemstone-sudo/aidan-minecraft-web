import * as THREE from 'three';
import { BLOCKS, BLOCK_DEFS, ALL_BLOCKS, DEFAULT_HOTBAR } from './blocks.js';
import { sounds } from './audio.js';

export class UIManager {
  constructor(world, player, storage, icons) {
    this.world = world;
    this.player = player;
    this.storage = storage;
    this.icons = icons;

    this.hotbarSlots = [...DEFAULT_HOTBAR];
    this.selectedIndex = 0; // 0-8

    this.isInventoryOpen = false;
    this.isPresetOpen = false;

    // Magic World items (not blocks — they live in their own little bar)
    this.items = { raw_fish: 0, cooked_fish: 0 };
    this.magic = null; // MagicSystem, wired from main.js
    this.creatures = null; // Creatures, wired from main.js

    this.initDOM();
    this.setupListeners();
    this.setupTouchControls();
    this.setupMagicBar();
    this.renderHotbar();
    this.renderInventory();

    // Wire player action callbacks
    this.player.onBreak = () => this.player.breakBlock();
    this.player.onPlace = () => this.player.placeBlock(this.getSelectedBlockId());
    this.player.onPick = () => this.pickBlock();
    this.player.onPrevSlot = () => this.prevSlot();
    this.player.onNextSlot = () => this.nextSlot();
  }

  getSelectedBlockId() {
    return this.hotbarSlots[this.selectedIndex];
  }

  setSelectedBlockId(blockId) {
    this.hotbarSlots[this.selectedIndex] = blockId;
    this.renderHotbar();
    this.showNotification(`已装备: ${BLOCK_DEFS[blockId]?.name}`);
  }

  prevSlot() {
    this.selectSlot((this.selectedIndex - 1 + 9) % 9);
  }

  nextSlot() {
    this.selectSlot((this.selectedIndex + 1) % 9);
  }

  initDOM() {
    this.hotbarContainer = document.getElementById('hotbar');
    this.activeBlockLabel = document.getElementById('active-block-name');
    this.statsOverlay = document.getElementById('stats-overlay');
    this.notificationBox = document.getElementById('toast-notification');
    this.inventoryModal = document.getElementById('inventory-modal');
    this.presetModal = document.getElementById('preset-modal');
    this.helpModal = document.getElementById('help-modal');
    this.touchContainer = document.getElementById('touch-controls');
    this.magicBar = document.getElementById('magic-bar');
    this.rawCountEl = document.getElementById('magic-raw-count');
    this.cookedCountEl = document.getElementById('magic-cooked-count');
    this.healthFillEl = document.getElementById('health-fill');

    // Auto show touch controls on touch devices (iPad / phones)
    if (this.player.isTouchDevice && this.touchContainer) {
      this.touchContainer.classList.remove('hidden');
    }
  }

  setupListeners() {
    // Number keys 1-9 to select hotbar
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;

      if (e.code.startsWith('Digit') && e.code !== 'Digit0') {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) {
          this.selectSlot(num - 1);
        }
      } else if (e.code === 'KeyR') {
        // 🔥 Fire magic
        this.castFireMagic();
      } else if (e.code === 'KeyG') {
        // Put a raw fish on the ground so you can roast it
        this.dropRawFish();
      } else if (e.code === 'KeyV') {
        this.eatCookedFish();
      } else if (e.code === 'KeyE') {
        if (!this.player.isLocked && this.isInventoryOpen) {
          this.closeInventory();
        } else {
          if (document.pointerLockElement) document.exitPointerLock();
          this.openInventory();
        }
      }
    });

    // Mouse wheel to cycle hotbar
    window.addEventListener('wheel', (e) => {
      if (!this.player.isLocked && !this.player.keyboardMode) return;
      if (e.deltaY > 0) {
        this.nextSlot();
      } else if (e.deltaY < 0) {
        this.prevSlot();
      }
    });

    // Middle click to pick block
    window.addEventListener('mousedown', (e) => {
      if (e.button === 1 && (this.player.isLocked || this.player.keyboardMode)) {
        e.preventDefault();
        this.pickBlock();
      }
    });

    // File input for import
    const importInput = document.getElementById('import-file-input');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.storage.importFromFile(file, (result) => {
            if (result.success) {
              this.showNotification(`存档导入成功！共加载 ${result.count} 个方块`);
              sounds.playClickSound();
            } else {
              this.showNotification(`导入失败: ${result.error}`, 'error');
            }
            importInput.value = '';
          });
        }
      });
    }
  }

  setupTouchControls() {
    if (!this.touchContainer) return;

    // Helper for touch buttons
    const bindTouchButton = (elemId, onPress, onRelease) => {
      const btn = document.getElementById(elemId);
      if (!btn) return;

      const press = (e) => {
        e.preventDefault();
        e.stopPropagation();
        sounds.ensureContext();
        if (!this.player.isPlaying) {
          this.player.setPlaying(true);
        }
        btn.classList.add('pressed');
        if (onPress) onPress();
      };

      const release = (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove('pressed');
        if (onRelease) onRelease();
      };

      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release, { passive: false });
      btn.addEventListener('touchcancel', release, { passive: false });
      // Also support mouse for easy desktop testing
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
    };

    // D-Pad
    bindTouchButton('touch-up', () => { this.player.keys.forward = true; }, () => { this.player.keys.forward = false; });
    bindTouchButton('touch-down', () => { this.player.keys.backward = true; }, () => { this.player.keys.backward = false; });
    bindTouchButton('touch-left', () => { this.player.keys.left = true; }, () => { this.player.keys.left = false; });
    bindTouchButton('touch-right', () => { this.player.keys.right = true; }, () => { this.player.keys.right = false; });

    // Actions
    bindTouchButton('touch-jump', () => { this.player.keys.up = true; }, () => { this.player.keys.up = false; });
    bindTouchButton('touch-descend', () => { this.player.keys.down = true; }, () => { this.player.keys.down = false; });
    bindTouchButton('touch-break', () => { this.player.breakBlock(); });
    bindTouchButton('touch-place', () => { this.player.placeBlock(this.getSelectedBlockId()); });
    bindTouchButton('touch-fly', () => { this.player.toggleFlyMode(); });
    bindTouchButton('touch-inv', () => { this.openInventory(); });

    // Magic World touch buttons
    bindTouchButton('touch-fire', () => { this.castFireMagic(); });
    bindTouchButton('touch-drop-fish', () => { this.dropRawFish(); });
    bindTouchButton('touch-eat-fish', () => { this.eatCookedFish(); });
  }

  // ---- Magic World: fire, fish, food -----------------------------------

  setupMagicBar() {
    document.getElementById('magic-cast')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.castFireMagic();
    });
    document.getElementById('magic-raw')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropRawFish();
    });
    document.getElementById('magic-cooked')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.eatCookedFish();
    });
    this.renderMagicBar();
  }

  castFireMagic() {
    if (!this.magic) return;
    if (!this.player.isPlaying) this.player.setPlaying(true);
    sounds.ensureContext();
    this.magic.cast();
  }

  addItem(kind, n = 1) {
    if (!(kind in this.items)) return;
    this.items[kind] += n;
    this.renderMagicBar();
  }

  dropRawFish() {
    if (!this.creatures) return;
    if (this.items.raw_fish <= 0) {
      this.showNotification('你还没有生鱼 — 先游到水里碰一条鱼把它抓住！');
      return;
    }
    this.items.raw_fish--;
    this.renderMagicBar();

    // Drop it a couple of blocks in front of the player so a fireball can reach it
    const dir = this.player.camera.getWorldDirection(new THREE.Vector3());
    dir.y = 0;
    if (dir.lengthSq() < 0.001) dir.set(0, 0, -1);
    dir.normalize();

    const px = this.player.position.x + dir.x * 2.5;
    const pz = this.player.position.z + dir.z * 2.5;
    const py = this.player.position.y + 0.6;

    this.creatures.addDrop(px, py, pz, 'raw_fish');
    sounds.playClickSound();
    this.showNotification('🐟 生鱼已放在地上 — 现在对它放火焰魔法 (R) 烤熟它！');
  }

  eatCookedFish() {
    if (this.items.cooked_fish <= 0) {
      this.showNotification('还没有烤鱼 — 把生鱼放地上 (G)，再用火焰魔法烤它！');
      return;
    }
    this.items.cooked_fish--;
    this.renderMagicBar();

    this.player.health = Math.min(this.player.maxHealth, this.player.health + 6);
    this.player.boostTimer = 8.0;
    sounds.playEatSound();
    this.showNotification('😋 Yum! 烤鱼真好吃！生命恢复 + 飞行加速 8 秒！');
  }

  renderMagicBar() {
    if (this.rawCountEl) this.rawCountEl.textContent = this.items.raw_fish;
    if (this.cookedCountEl) this.cookedCountEl.textContent = this.items.cooked_fish;

    document.getElementById('magic-raw')?.classList.toggle('empty', this.items.raw_fish <= 0);
    document.getElementById('magic-cooked')?.classList.toggle('empty', this.items.cooked_fish <= 0);
  }

  renderHealth() {
    if (!this.healthFillEl) return;
    const pct = Math.max(0, Math.min(1, this.player.health / this.player.maxHealth)) * 100;
    this.healthFillEl.style.width = `${pct}%`;
    this.healthFillEl.classList.toggle('low', pct <= 35);
  }

  pickBlock() {
    if (this.player.targetBlock) {
      const id = this.player.targetBlock.id;
      const existingIdx = this.hotbarSlots.indexOf(id);
      if (existingIdx !== -1) {
        this.selectSlot(existingIdx);
      } else {
        this.setSelectedBlockId(id);
      }
      sounds.playClickSound();
    }
  }

  selectSlot(index) {
    this.selectedIndex = Math.max(0, Math.min(8, index));
    this.renderHotbar();
    sounds.playClickSound();
  }

  renderHotbar() {
    if (!this.hotbarContainer) return;
    this.hotbarContainer.innerHTML = '';

    for (let i = 0; i < 9; i++) {
      const blockId = this.hotbarSlots[i];
      const def = BLOCK_DEFS[blockId];
      const iconUrl = def ? this.icons[def.iconTexture] : '';

      const slot = document.createElement('div');
      slot.className = `hotbar-slot ${i === this.selectedIndex ? 'active' : ''}`;
      slot.innerHTML = `
        <span class="slot-num">${i + 1}</span>
        ${iconUrl ? `<img src="${iconUrl}" class="slot-icon" alt="${def.name}" />` : ''}
      `;
      // Support both click and touchstart for instant iPad slot picking
      slot.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.selectSlot(i);
      });
      this.hotbarContainer.appendChild(slot);
    }

    const currentBlock = BLOCK_DEFS[this.getSelectedBlockId()];
    if (this.activeBlockLabel && currentBlock) {
      this.activeBlockLabel.textContent = `${currentBlock.name} (${currentBlock.enName})`;
    }
  }

  renderInventory() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (const block of ALL_BLOCKS) {
      if (block.id === BLOCKS.AIR) continue;
      const iconUrl = this.icons[block.iconTexture];

      const item = document.createElement('div');
      item.className = 'inventory-item';
      item.title = `${block.name} (${block.enName})`;
      item.innerHTML = `
        <img src="${iconUrl}" class="item-icon" />
        <div class="item-name">${block.name}</div>
      `;

      item.addEventListener('pointerdown', () => {
        this.setSelectedBlockId(block.id);
        sounds.playClickSound();
        this.closeInventory();
        if (!this.player.isTouchDevice && !this.player.keyboardMode) {
          document.body.requestPointerLock();
        } else {
          this.player.setPlaying(true);
        }
      });

      grid.appendChild(item);
    }
  }

  openInventory() {
    this.isInventoryOpen = true;
    if (this.inventoryModal) {
      this.inventoryModal.classList.remove('hidden');
    }
  }

  closeInventory() {
    this.isInventoryOpen = false;
    if (this.inventoryModal) {
      this.inventoryModal.classList.add('hidden');
    }
  }

  openPresets() {
    this.isPresetOpen = true;
    if (this.presetModal) {
      this.presetModal.classList.remove('hidden');
    }
  }

  closePresets() {
    this.isPresetOpen = false;
    if (this.presetModal) {
      this.presetModal.classList.add('hidden');
    }
  }

  showNotification(msg, type = 'info') {
    if (!this.notificationBox) return;
    this.notificationBox.textContent = msg;
    this.notificationBox.className = `toast-box ${type} show`;
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.notificationBox.className = 'toast-box';
    }, 2800);
  }

  updateStats(fps) {
    this.renderHealth();
    if (!this.statsOverlay) return;
    const p = this.player.position;
    const yawDeg = ((this.player.yaw * 180 / Math.PI) % 360 + 360) % 360;

    let dir = 'South (+Z)';
    if (yawDeg >= 45 && yawDeg < 135) dir = 'West (-X)';
    else if (yawDeg >= 135 && yawDeg < 225) dir = 'North (-Z)';
    else if (yawDeg >= 225 && yawDeg < 315) dir = 'East (+X)';

    const modeText = this.player.isTouchDevice ? '📱 iPad 触屏' : (this.player.keyboardMode ? '⌨️ 纯键盘' : '🖱️ 键鼠');

    this.statsOverlay.innerHTML = `
      <div><b>FPS:</b> ${Math.round(fps)} | <b>模式:</b> ${modeText}</div>
      <div><b>XYZ:</b> ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}</div>
      <div><b>朝向:</b> ${dir}</div>
      <div><b>自定义方块:</b> ${this.world.customBlocks.size}</div>
    `;
  }
}
