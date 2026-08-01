import { CORGI_GAMEPLAY_ATLAS_CHUNK_00 } from './CorgiGameplayAtlasChunk00';
import { CORGI_GAMEPLAY_ATLAS_CHUNK_01 } from './CorgiGameplayAtlasChunk01';
import { CORGI_GAMEPLAY_ATLAS_CHUNK_02 } from './CorgiGameplayAtlasChunk02';
import { CORGI_GAMEPLAY_ATLAS_CHUNK_03 } from './CorgiGameplayAtlasChunk03';
import { CORGI_GAMEPLAY_ATLAS_CHUNK_04 } from './CorgiGameplayAtlasChunk04';
import { CORGI_GAMEPLAY_ATLAS_CHUNK_05 } from './CorgiGameplayAtlasChunk05';
import { CORGI_GAMEPLAY_ATLAS_CHUNK_06 } from './CorgiGameplayAtlasChunk06';
import { CORGI_GAMEPLAY_ATLAS_CHUNK_07 } from './CorgiGameplayAtlasChunk07';
import { CORGI_GAMEPLAY_ATLAS_CHUNK_08 } from './CorgiGameplayAtlasChunk08';
import { CORGI_GAMEPLAY_ATLAS_CHUNK_09 } from './CorgiGameplayAtlasChunk09';

const WEBP_BASE64 =
  CORGI_GAMEPLAY_ATLAS_CHUNK_00 +
  CORGI_GAMEPLAY_ATLAS_CHUNK_01 +
  CORGI_GAMEPLAY_ATLAS_CHUNK_02 +
  CORGI_GAMEPLAY_ATLAS_CHUNK_03 +
  CORGI_GAMEPLAY_ATLAS_CHUNK_04 +
  CORGI_GAMEPLAY_ATLAS_CHUNK_05 +
  CORGI_GAMEPLAY_ATLAS_CHUNK_06 +
  CORGI_GAMEPLAY_ATLAS_CHUNK_07 +
  CORGI_GAMEPLAY_ATLAS_CHUNK_08 +
  CORGI_GAMEPLAY_ATLAS_CHUNK_09;

if (!WEBP_BASE64.startsWith('UklG')) {
  throw new Error('[Corgi Hop] Gameplay atlas is not a valid RIFF WebP.');
}

export const CORGI_GAMEPLAY_ATLAS_DATA_URI = `data:image/webp;base64,${WEBP_BASE64}`;
export const CORGI_GAMEPLAY_FRAME_SIZE = 80;
export const CORGI_GAMEPLAY_FRAME_COUNT = 98;
