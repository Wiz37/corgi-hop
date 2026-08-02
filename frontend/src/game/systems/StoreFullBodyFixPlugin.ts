import Phaser from 'phaser';
import { CORGIS } from './GameState';

type SceneClass = { prototype: Record<string, any> };

interface RuntimeCorgiDef {
  id: string;
  texture: string;
  textureFrame?: number;
}

const GAMEPLAY_ATLAS_KEY = 'corgi_gameplay_atlas_20260801';
const FRAMES_PER_CORGI = 7;

const FULL_BODY_ROWS: Record<string, number> = {
  blue_merle_chef: 6,
  black_tri_tuxedo: 7,
  red_tri_ninja: 8,
  sable_aviator: 9,
  brindle_viking: 10,
  heeler_lifeguard: 11,
};

let installed = false;

function applyFullBodyFrame(id: string): void {
  const sourceRow = FULL_BODY_ROWS[id];
  if (sourceRow === undefined) return;

  const definition = (CORGIS as unknown as RuntimeCorgiDef[])
    .find((candidate) => candidate.id === id);
  if (!definition) return;

  definition.texture = GAMEPLAY_ATLAS_KEY;
  definition.textureFrame = sourceRow * FRAMES_PER_CORGI;
}

/**
 * The previous page-two portrait sheet was created from source drawings whose
 * lower legs were already cropped. The gameplay atlas contains clean full-body
 * standing/run-key frames, so use those frames only while each store card is
 * being built. Gameplay animation and Bob/Lulu portraits remain untouched.
 */
export function installStoreFullBodyFix(CorgiSelectSceneClass: SceneClass): void {
  if (installed) return;
  installed = true;

  const prototype = CorgiSelectSceneClass.prototype;
  const previousBuildCard = prototype.buildCard;

  prototype.buildCard = function buildCardWithFullBodyPaws(
    this: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    id: string,
  ): unknown {
    if (this.textures.exists(GAMEPLAY_ATLAS_KEY)) applyFullBodyFrame(id);
    return previousBuildCard.call(this, x, y, width, height, id);
  };
}
