import Phaser from 'phaser';
import { CORGIS } from './GameState';

type SceneClass = { prototype: Record<string, any> };

interface RuntimeCorgiDef {
  id: string;
  texture: string;
  textureFrame?: number;
  runFrame?: number;
  runSheetKey?: string;
  runAnimKey?: string;
  tint?: number;
}

const CARD_TEST_ID_PREFIX = 'select-corgi-';
let installed = false;

function animatedAsset(
  scene: Phaser.Scene,
  definition: RuntimeCorgiDef,
): { texture: string; frame?: number; animation?: string } {
  const runSheetKey = definition.runSheetKey;
  const runAnimKey = definition.runAnimKey;

  if (
    runSheetKey
    && runAnimKey
    && scene.textures.exists(runSheetKey)
    && scene.anims.exists(runAnimKey)
  ) {
    return {
      texture: runSheetKey,
      frame: definition.runFrame ?? 0,
      animation: runAnimKey,
    };
  }

  if (scene.textures.exists(definition.texture)) {
    return {
      texture: definition.texture,
      frame: definition.textureFrame,
    };
  }

  return { texture: 'corgi_idle' };
}

function cardCorgiId(card: Phaser.GameObjects.Container): string | undefined {
  const testId = String(card.getData('testId') ?? '');
  if (!testId.startsWith(CARD_TEST_ID_PREFIX) || testId.endsWith('-btn')) return undefined;
  return testId.slice(CARD_TEST_ID_PREFIX.length);
}

function replaceCardPortrait(
  scene: Phaser.Scene,
  card: Phaser.GameObjects.Container,
  definition: RuntimeCorgiDef,
  phase: number,
): void {
  const currentPortrait = card.list.find((child) =>
    child instanceof Phaser.GameObjects.Image,
  ) as Phaser.GameObjects.Image | undefined;
  if (!currentPortrait) return;

  const asset = animatedAsset(scene, definition);
  const index = card.getIndex(currentPortrait);
  const width = currentPortrait.displayWidth;
  const height = currentPortrait.displayHeight;
  const x = currentPortrait.x;
  const y = currentPortrait.y;
  const alpha = currentPortrait.alpha;
  const depth = currentPortrait.depth;

  card.remove(currentPortrait, true);

  const sprite = scene.add.sprite(x, y, asset.texture, asset.frame)
    .setDisplaySize(width, height)
    .setAlpha(alpha)
    .setFlipX(false)
    .setAngle(0)
    .setDepth(depth);

  if (definition.tint !== undefined) sprite.setTint(definition.tint);
  if (index >= 0) card.addAt(sprite, index);
  else card.add(sprite);

  if (asset.animation && scene.anims.exists(asset.animation)) {
    sprite.play(asset.animation);
    const animation = sprite.anims.currentAnim;
    if (animation && animation.frames.length > 1) {
      sprite.anims.setProgress(phase % 1);
    }
  }
}

function animateVisibleStoreCards(scene: Phaser.Scene): void {
  const definitions = CORGIS as unknown as RuntimeCorgiDef[];
  const cards = scene.children.list.filter((child) =>
    child instanceof Phaser.GameObjects.Container
    && cardCorgiId(child as Phaser.GameObjects.Container),
  ) as Phaser.GameObjects.Container[];

  cards.forEach((card, index) => {
    const id = cardCorgiId(card);
    const definition = definitions.find((candidate) => candidate.id === id);
    if (!definition) return;
    replaceCardPortrait(scene, card, definition, index / Math.max(1, cards.length));
  });
}

/**
 * Uses each corgi's real gameplay run sheet and animation in the character
 * store. This keeps every card visually identical to the playable character,
 * gives all fourteen corgis their full eight-frame stride, and avoids the
 * optional portrait sheets that previously fell back to the Classic Corgi.
 *
 * Gameplay is intentionally untouched here. GameplayAnimationPlugin remains
 * the single owner of the newer corgis' run, jump, fall, and landing poses.
 */
export function installStoreFullBodyFix(
  CorgiSelectSceneClass: SceneClass,
  _GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const selectPrototype = CorgiSelectSceneClass.prototype;
  const previousCreate = selectPrototype.create;

  selectPrototype.create = function createAnimatedCorgiStore(
    this: Phaser.Scene & Record<string, any>,
    ...args: unknown[]
  ): unknown {
    const result = previousCreate.apply(this, args);
    animateVisibleStoreCards(this);
    return result;
  };
}
