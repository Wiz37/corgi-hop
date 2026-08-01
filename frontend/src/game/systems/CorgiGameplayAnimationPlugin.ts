import Phaser from 'phaser';
import { CORGIS, gameState } from './GameState';

type SceneClass = { prototype: Record<string, any> };

type Pose = 'run' | 'jump' | 'fall' | 'land' | 'hit';

interface RuntimeCorgiDef {
  id: string;
  texture: string;
  textureFrame?: number;
  runFrame?: number;
  runSheetKey?: string;
  runAnimKey?: string;
  jumpFrame?: number;
  fallFrame?: number;
  landFrame?: number;
  hitFrame?: number;
}

interface AtlasRow {
  id: string;
  row: number;
  runAnimKey: string;
}

const ATLAS_KEY = 'corgi_gameplay_atlas_20260801';
const ATLAS_URL = '/assets/corgi_gameplay_atlas_160.webp?v=20260801g';
const FRAME_SIZE = 160;
const FRAMES_PER_CORGI = 7;
const RUN_FRAME_COUNT = 4;

const ATLAS_ROWS: AtlasRow[] = [
  { id: 'classic', row: 0, runAnimKey: 'run' },
  { id: 'starter', row: 1, runAnimKey: 'starter_run' },
  { id: 'cowboy', row: 2, runAnimKey: 'cowboy_run' },
  { id: 'superhero', row: 3, runAnimKey: 'superhero_run' },
  { id: 'pirate', row: 4, runAnimKey: 'pirate_run_fixed' },
  { id: 'astronaut', row: 5, runAnimKey: 'astronaut_run' },
  { id: 'blue_merle_chef', row: 6, runAnimKey: 'blue_merle_chef_run' },
  { id: 'black_tri_tuxedo', row: 7, runAnimKey: 'black_tri_tuxedo_run' },
  { id: 'red_tri_ninja', row: 8, runAnimKey: 'red_tri_ninja_run' },
  { id: 'sable_aviator', row: 9, runAnimKey: 'sable_aviator_run' },
  { id: 'brindle_viking', row: 10, runAnimKey: 'brindle_viking_run' },
  { id: 'heeler_lifeguard', row: 11, runAnimKey: 'heeler_lifeguard_run' },
  { id: 'pilot_bob', row: 12, runAnimKey: 'pilot_bob_run' },
  { id: 'princess_lulu', row: 13, runAnimKey: 'princess_lulu_run' },
];

const ROW_BY_ID = new Map(ATLAS_ROWS.map((row) => [row.id, row]));
let installed = false;

function firstFrame(row: number): number {
  return row * FRAMES_PER_CORGI;
}

function configureRuntimeDefinitions(): void {
  const defs = CORGIS as unknown as RuntimeCorgiDef[];

  for (const atlasRow of ATLAS_ROWS) {
    const def = defs.find((candidate) => candidate.id === atlasRow.id);
    if (!def) continue;

    const base = firstFrame(atlasRow.row);
    Object.assign(def, {
      texture: ATLAS_KEY,
      textureFrame: base,
      runFrame: base,
      runSheetKey: ATLAS_KEY,
      runAnimKey: atlasRow.runAnimKey,
      jumpFrame: base + 4,
      fallFrame: base + 5,
      landFrame: base + 6,
      hitFrame: base + 6,
    });
  }
}

function registerAtlasAnimations(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ATLAS_KEY)) {
    throw new Error('[Corgi Hop] The 14-corgi gameplay atlas failed to load.');
  }

  for (const atlasRow of ATLAS_ROWS) {
    const base = firstFrame(atlasRow.row);
    if (scene.anims.exists(atlasRow.runAnimKey)) {
      scene.anims.remove(atlasRow.runAnimKey);
    }

    scene.anims.create({
      key: atlasRow.runAnimKey,
      frames: Array.from({ length: RUN_FRAME_COUNT }, (_, offset) => ({
        key: ATLAS_KEY,
        frame: base + offset,
      })),
      frameRate: 12,
      repeat: -1,
    });
  }
}

function selectedAtlasRow(): AtlasRow | undefined {
  return ROW_BY_ID.get(String((gameState as any).selectedCorgi ?? 'classic'));
}

function poseFrame(row: AtlasRow, pose: Pose): number {
  const base = firstFrame(row.row);
  switch (pose) {
    case 'run': return base;
    case 'jump': return base + 4;
    case 'fall': return base + 5;
    case 'land': return base + 6;
    case 'hit': return base + 6;
  }
}

export function installCorgiGameplayAnimation(
  PreloadSceneClass: SceneClass,
  GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  configureRuntimeDefinitions();

  const preloadProto = PreloadSceneClass.prototype;
  const previousPreload = preloadProto.preload;
  preloadProto.preload = function preloadCorgiGameplayAtlas(this: Phaser.Scene): void {
    previousPreload.call(this);
    this.load.spritesheet(ATLAS_KEY, ATLAS_URL, {
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
      startFrame: 0,
      endFrame: ATLAS_ROWS.length * FRAMES_PER_CORGI - 1,
    });
  };

  const previousPreloadCreate = preloadProto.create;
  preloadProto.create = function createCorgiGameplayAnimations(this: Phaser.Scene): any {
    registerAtlasAnimations(this);
    return previousPreloadCreate.call(this);
  };

  const gameProto = GameSceneClass.prototype;
  const previousGameCreate = gameProto.create;
  gameProto.create = function createWithCorgiGameplayAtlas(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    configureRuntimeDefinitions();
    const atlasRow = selectedAtlasRow();
    const defs = CORGIS as unknown as RuntimeCorgiDef[];
    const selectedDef = atlasRow
      ? defs.find((candidate) => candidate.id === atlasRow.id)
      : undefined;

    const savedRunFrame = selectedDef?.runFrame;
    const savedTextureFrame = selectedDef?.textureFrame;
    if (selectedDef && atlasRow && atlasRow.row >= 6) {
      const legacyFrame = atlasRow.row - 6;
      selectedDef.runFrame = legacyFrame;
      selectedDef.textureFrame = legacyFrame;
    }

    let result: any;
    try {
      result = previousGameCreate.apply(this, args);
    } finally {
      if (selectedDef && atlasRow) {
        const base = firstFrame(atlasRow.row);
        selectedDef.runFrame = savedRunFrame ?? base;
        selectedDef.textureFrame = savedTextureFrame ?? base;
      }
    }

    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
    if (!atlasRow || !corgi) return result;

    const base = firstFrame(atlasRow.row);
    this.runTexKey = ATLAS_KEY;
    this.runAnimKey = atlasRow.runAnimKey;

    corgi.anims.stop();
    corgi.setTexture(ATLAS_KEY, base);
    corgi.setFlipX(false);
    corgi.setAngle(0);
    corgi.clearTint();
    corgi.setAlpha(1);
    if (typeof this.sizeCorgiUniform === 'function') this.sizeCorgiUniform();
    if (this.anims.exists(atlasRow.runAnimKey)) corgi.play(atlasRow.runAnimKey);
    return result;
  };

  const previousSetPose = gameProto.setPose;
  gameProto.setPose = function setAtlasPose(
    this: Phaser.Scene & Record<string, any>,
    pose: Pose,
  ): void {
    const atlasRow = selectedAtlasRow();
    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
    if (!atlasRow || !corgi || !this.textures.exists(ATLAS_KEY)) {
      previousSetPose.call(this, pose);
      return;
    }

    const frame = poseFrame(atlasRow, pose);
    const sameTexture = corgi.texture?.key === ATLAS_KEY;
    const sameFrame = String(corgi.frame?.name) === String(frame);
    if (!sameTexture || !sameFrame) {
      corgi.setTexture(ATLAS_KEY, frame);
      if (typeof this.sizeCorgiUniform === 'function') this.sizeCorgiUniform();
    }

    corgi.setFlipX(false);
    corgi.setAngle(0);
    corgi.clearTint();
    corgi.setAlpha(1);
  };
}
