import * as THREE from 'three';
import { BLOCKS, BLOCK_DEFS } from './blocks.js';
import { sounds } from './audio.js';

export class Player {
  constructor(camera, domElement, world, particleSystem) {
    this.camera = camera;
    this.domElement = domElement;
    this.world = world;
    this.particles = particleSystem;

    // Position & Orientation
    this.position = new THREE.Vector3(0, 20, 0);
    this.yaw = 0;
    this.pitch = 0;

    // Movement & Physics
    this.velocity = new THREE.Vector3();
    this.isFlying = true; // Free fly mode by default
    this.flySpeed = 16.0;
    this.walkSpeed = 5.5;
    this.sprintMultiplier = 1.8;
    this.lookSpeed = 2.4; // Keyboard rotation speed (radians per sec)
    this.onGround = false;

    // Magic World: health + the speed boost you get from eating cooked fish
    this.maxHealth = 20;
    this.health = 20;
    this.boostTimer = 0;
    this.creatures = null; // wired from main.js so 挖掘 can also catch a fish

    this.playerHeight = 1.8;
    this.eyeHeight = 1.62;
    this.playerRadius = 0.3;

    // Input States
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false,
      sprint: false,
      lookUp: false,
      lookDown: false,
      lookLeft: false,
      lookRight: false
    };

    // Modes & Device Detection
    this.isLocked = false;
    this.keyboardMode = false;
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.isPlaying = false;

    // Callbacks for actions
    this.onBreak = null;
    this.onPlace = null;
    this.onPick = null;
    this.onPrevSlot = null;
    this.onNextSlot = null;

    // Pointer Lock setup
    this.setupPointerLock();

    // Raycasting & Block Targeting
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 7.0; // Reach distance
    this.targetBlock = null;

    // Highlight wireframe box for targeted block
    const boxGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const wireframeGeo = new THREE.EdgesGeometry(boxGeo);
    this.highlightBox = new THREE.LineSegments(
      wireframeGeo,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );
    this.highlightBox.visible = false;
    this.world.scene.add(this.highlightBox);

    // Audio step timer
    this.stepTimer = 0;

    // Setup input listeners
    this.setupInputs();
    this.setupTouchControls();
  }

  setupPointerLock() {
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      if (this.isLocked) {
        this.setPlaying(true);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      const sensitivity = 0.0022;
      this.yaw -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;

      const maxPitch = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });
  }

  setPlaying(playing) {
    this.isPlaying = playing;
    const overlay = document.getElementById('pause-overlay');
    if (overlay) {
      overlay.classList.toggle('hidden', playing);
    }
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Pure Keyboard Mode Activation: If not locked and user presses movement/action key
      const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyZ', 'KeyX', 'KeyJ', 'KeyK', 'Enter'];
      if (!this.isPlaying && gameKeys.includes(e.code)) {
        this.keyboardMode = true;
        this.setPlaying(true);
        sounds.ensureContext();
      }

      switch (e.code) {
        // Movement
        case 'KeyW':
          this.keys.forward = true;
          break;
        case 'KeyS':
          this.keys.backward = true;
          break;
        case 'KeyA':
          this.keys.left = true;
          break;
        case 'KeyD':
          this.keys.right = true;
          break;
        case 'Space':
          this.keys.up = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyC':
          this.keys.down = true;
          break;
        case 'ControlLeft':
        case 'ControlRight':
          this.keys.sprint = true;
          break;
        case 'KeyF':
          this.toggleFlyMode();
          break;

        // Pure Keyboard Camera Look (Arrow keys)
        case 'ArrowUp':
          this.keys.lookUp = true;
          e.preventDefault();
          break;
        case 'ArrowDown':
          this.keys.lookDown = true;
          e.preventDefault();
          break;
        case 'ArrowLeft':
          this.keys.lookLeft = true;
          e.preventDefault();
          break;
        case 'ArrowRight':
          this.keys.lookRight = true;
          e.preventDefault();
          break;

        // Pure Keyboard Action Keys
        case 'KeyZ':
        case 'KeyJ':
        case 'Delete':
        case 'Backspace':
          if (this.onBreak) this.onBreak();
          else this.breakBlock();
          e.preventDefault();
          break;

        case 'KeyX':
        case 'KeyK':
        case 'Enter':
          if (this.onPlace) this.onPlace();
          e.preventDefault();
          break;

        case 'KeyQ':
          if (this.onPick) this.onPick();
          break;

        // Keyboard hotbar cycle
        case 'BracketLeft':
        case 'Minus':
          if (this.onPrevSlot) this.onPrevSlot();
          break;
        case 'BracketRight':
        case 'Equal':
          if (this.onNextSlot) this.onNextSlot();
          break;

        case 'Escape':
          this.keyboardMode = false;
          this.setPlaying(false);
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
          this.keys.forward = false;
          break;
        case 'KeyS':
          this.keys.backward = false;
          break;
        case 'KeyA':
          this.keys.left = false;
          break;
        case 'KeyD':
          this.keys.right = false;
          break;
        case 'Space':
          this.keys.up = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyC':
          this.keys.down = false;
          break;
        case 'ControlLeft':
        case 'ControlRight':
          this.keys.sprint = false;
          break;

        case 'ArrowUp':
          this.keys.lookUp = false;
          break;
        case 'ArrowDown':
          this.keys.lookDown = false;
          break;
        case 'ArrowLeft':
          this.keys.lookLeft = false;
          break;
        case 'ArrowRight':
          this.keys.lookRight = false;
          break;
      }
    });
  }

  setupTouchControls() {
    // iPad / Touch screen drag rotation on right side of canvas
    let touchId = null;
    let lastX = 0;
    let lastY = 0;

    const container = this.domElement;

    container.addEventListener('touchstart', (e) => {
      sounds.ensureContext();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        // Only touches on right 60% of the screen are for camera look
        if (t.clientX > window.innerWidth * 0.35 && touchId === null) {
          touchId = t.identifier;
          lastX = t.clientX;
          lastY = t.clientY;
          if (!this.isPlaying) {
            this.setPlaying(true);
          }
          break;
        }
      }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchId) {
          const dx = t.clientX - lastX;
          const dy = t.clientY - lastY;
          lastX = t.clientX;
          lastY = t.clientY;

          const touchSensitivity = 0.005;
          this.yaw -= dx * touchSensitivity;
          this.pitch -= dy * touchSensitivity;

          const maxPitch = Math.PI / 2 - 0.01;
          this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
          e.preventDefault();
          break;
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          touchId = null;
          break;
        }
      }
    };

    container.addEventListener('touchend', endTouch);
    container.addEventListener('touchcancel', endTouch);
  }

  toggleFlyMode() {
    this.isFlying = !this.isFlying;
    this.velocity.set(0, 0, 0);
    sounds.playFlyToggleSound(this.isFlying);

    const modeBadge = document.getElementById('mode-indicator');
    if (modeBadge) {
      if (this.isFlying) {
        modeBadge.innerHTML = '🕊️ <b>飞行建造模式</b> (按 F 切换)';
        modeBadge.className = 'badge flying';
      } else {
        modeBadge.innerHTML = '🚶 <b>地面行走模式</b> (按 F 切换)';
        modeBadge.className = 'badge walking';
      }
    }
  }

  update(delta) {
    if (delta > 0.1) delta = 0.1;

    // Pure Keyboard Camera Look with Arrow keys
    if (this.keys.lookLeft) {
      this.yaw += this.lookSpeed * delta;
    }
    if (this.keys.lookRight) {
      this.yaw -= this.lookSpeed * delta;
    }
    if (this.keys.lookUp) {
      this.pitch += this.lookSpeed * delta;
    }
    if (this.keys.lookDown) {
      this.pitch -= this.lookSpeed * delta;
    }

    const maxPitch = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // Update Camera Orientation
    const cameraRotation = new THREE.Euler(0, 0, 0, 'YXZ');
    cameraRotation.y = this.yaw;
    cameraRotation.x = this.pitch;
    this.camera.quaternion.setFromEuler(cameraRotation);

    // Calculate forward & right horizontal vectors
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    if (this.boostTimer > 0) this.boostTimer -= delta;
    const foodBoost = this.boostTimer > 0 ? 1.6 : 1.0;

    const speed =
      (this.isFlying ? this.flySpeed : this.walkSpeed) *
      (this.keys.sprint ? this.sprintMultiplier : 1.0) *
      foodBoost;

    if (this.isFlying) {
      // Free Fly Mode
      const move = new THREE.Vector3();
      if (this.keys.forward) move.add(forward);
      if (this.keys.backward) move.sub(forward);
      if (this.keys.right) move.add(right);
      if (this.keys.left) move.sub(right);
      if (this.keys.up) move.y += 1;
      if (this.keys.down) move.y -= 1;

      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed * delta);
        this.position.add(move);
      }
    } else {
      // Walk & Gravity Physics Mode
      const move = new THREE.Vector3();
      if (this.keys.forward) move.add(forward);
      if (this.keys.backward) move.sub(forward);
      if (this.keys.right) move.add(right);
      if (this.keys.left) move.sub(right);

      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed);
        this.velocity.x = move.x;
        this.velocity.z = move.z;

        if (this.onGround) {
          this.stepTimer += delta * (this.keys.sprint ? 1.5 : 1.0);
          if (this.stepTimer > 0.38) {
            sounds.playStepSound();
            this.stepTimer = 0;
          }
        }
      } else {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }

      if (this.keys.up && this.onGround) {
        this.velocity.y = 8.5;
        this.onGround = false;
      }
      this.velocity.y -= 26.0 * delta;

      this.moveWithCollision(delta);
    }

    // Update Camera position
    this.camera.position.copy(this.position);
    this.camera.position.y += this.eyeHeight;

    // Raycast target block whenever playing
    const canRaycast = this.isLocked || this.keyboardMode || this.isTouchDevice || this.isPlaying;
    if (canRaycast) {
      this.updateTargetBlock();
    } else {
      this.targetBlock = null;
      this.highlightBox.visible = false;
    }
  }

  moveWithCollision(delta) {
    this.position.x += this.velocity.x * delta;
    if (this.checkCollision()) {
      this.position.x -= this.velocity.x * delta;
      this.velocity.x = 0;
    }

    this.position.z += this.velocity.z * delta;
    if (this.checkCollision()) {
      this.position.z -= this.velocity.z * delta;
      this.velocity.z = 0;
    }

    this.position.y += this.velocity.y * delta;
    this.onGround = false;
    if (this.checkCollision()) {
      if (this.velocity.y < 0) {
        this.onGround = true;
      }
      this.position.y -= this.velocity.y * delta;
      this.velocity.y = 0;
    }
  }

  checkCollision() {
    const r = this.playerRadius;
    const h = this.playerHeight;

    const minX = Math.floor(this.position.x - r);
    const maxX = Math.floor(this.position.x + r);
    const minY = Math.floor(this.position.y);
    const maxY = Math.floor(this.position.y + h);
    const minZ = Math.floor(this.position.z - r);
    const maxZ = Math.floor(this.position.z + r);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.world.isSolid(x, y, z)) {
            if (
              this.position.x + r > x &&
              this.position.x - r < x + 1 &&
              this.position.y + h > y &&
              this.position.y < y + 1 &&
              this.position.z + r > z &&
              this.position.z - r < z + 1
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  updateTargetBlock() {
    this.raycaster.set(this.camera.position, this.camera.getWorldDirection(new THREE.Vector3()));
    const intersects = this.raycaster.intersectObjects(this.world.meshList, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const norm = hit.face.normal;

      const targetX = Math.floor(hit.point.x - norm.x * 0.05);
      const targetY = Math.floor(hit.point.y - norm.y * 0.05);
      const targetZ = Math.floor(hit.point.z - norm.z * 0.05);

      const blockId = this.world.getBlock(targetX, targetY, targetZ);
      if (blockId !== BLOCKS.AIR) {
        this.targetBlock = {
          x: targetX,
          y: targetY,
          z: targetZ,
          normal: norm.clone(),
          id: blockId
        };

        this.highlightBox.position.set(targetX + 0.5, targetY + 0.5, targetZ + 0.5);
        this.highlightBox.visible = true;
        return;
      }
    }

    this.targetBlock = null;
    this.highlightBox.visible = false;
  }

  breakBlock() {
    // Aiming at a fish or a berry bush and hitting 挖掘 harvests it instead of mining
    if (this.creatures && this.creatures.interactByRay(this.camera)) return true;

    if (!this.targetBlock) return false;
    const { x, y, z, id } = this.targetBlock;
    if (id === BLOCKS.BEDROCK) return false;

    const def = BLOCK_DEFS[id];
    sounds.playBreakSound(def ? def.sound : 'stone');

    this.particles.spawnBlockBreak(x, y, z, id);
    this.world.setBlock(x, y, z, BLOCKS.AIR);
    this.updateTargetBlock();
    return true;
  }

  placeBlock(blockId) {
    if (!this.targetBlock) return false;
    const { x, y, z, normal } = this.targetBlock;

    const px = x + Math.round(normal.x);
    const py = y + Math.round(normal.y);
    const pz = z + Math.round(normal.z);

    if (!this.isFlying) {
      const r = this.playerRadius;
      const h = this.playerHeight;
      if (
        this.position.x + r > px &&
        this.position.x - r < px + 1 &&
        this.position.y + h > py &&
        this.position.y < py + 1 &&
        this.position.z + r > pz &&
        this.position.z - r < pz + 1
      ) {
        return false;
      }
    }

    const def = BLOCK_DEFS[blockId];
    sounds.playPlaceSound(def ? def.sound : 'stone');

    this.world.setBlock(px, py, pz, blockId);
    this.updateTargetBlock();
    return true;
  }
}
