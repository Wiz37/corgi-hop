import { BOB_LULU_ASSET_CHUNK_00 } from './BobLuluAssetsChunk00';
import { BOB_LULU_ASSET_CHUNK_01 } from './BobLuluAssetsChunk01';
import { BOB_LULU_ASSET_CHUNK_02 } from './BobLuluAssetsChunk02';
import { BOB_LULU_ASSET_CHUNK_03 } from './BobLuluAssetsChunk03';

const PNG_BASE64 =
  BOB_LULU_ASSET_CHUNK_00 +
  BOB_LULU_ASSET_CHUNK_01 +
  BOB_LULU_ASSET_CHUNK_02 +
  BOB_LULU_ASSET_CHUNK_03;

if (!PNG_BASE64.startsWith('iVBOR')) {
  throw new Error('[Corgi Hop] Pilot Bob / Princess Lulu art is not a valid PNG.');
}

export const BOB_LULU_SHEET_DATA_URI = `data:image/png;base64,${PNG_BASE64}`;
export const BOB_LULU_FRAME_SIZE = 144;
export const BOB_LULU_FRAME_COUNT = 14;
