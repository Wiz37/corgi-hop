import { PREMIUM_STORE_PORTRAITS_CHUNK_0 } from './PremiumStorePortraitsChunk0';
import { PREMIUM_STORE_PORTRAITS_CHUNK_1 } from './PremiumStorePortraitsChunk1';
import { PREMIUM_STORE_PORTRAITS_CHUNK_2 } from './PremiumStorePortraitsChunk2';
import { PREMIUM_STORE_PORTRAITS_CHUNK_3 } from './PremiumStorePortraitsChunk3';
import {
  PREMIUM_STORE_PORTRAITS_DATA_URI as PREMIUM_STORE_PORTRAITS_TAIL_URI,
  PREMIUM_STORE_PORTRAIT_FRAME_COUNT,
  PREMIUM_STORE_PORTRAIT_FRAME_SIZE,
} from './PremiumStorePortraits';

const DATA_URI_PREFIX = 'data:image/webp;base64,';

// The connector stores large embedded assets in bounded source chunks. The
// legacy PremiumStorePortraits module contains the final 19,999 characters of
// the WebP payload, so rebuild the original 80,432-character base64 stream here.
export const PREMIUM_STORE_PORTRAITS_DATA_URI =
  DATA_URI_PREFIX
  + PREMIUM_STORE_PORTRAITS_CHUNK_0
  + PREMIUM_STORE_PORTRAITS_CHUNK_1
  + PREMIUM_STORE_PORTRAITS_CHUNK_2
  + PREMIUM_STORE_PORTRAITS_CHUNK_3
  + PREMIUM_STORE_PORTRAITS_TAIL_URI.slice(DATA_URI_PREFIX.length);

export {
  PREMIUM_STORE_PORTRAIT_FRAME_COUNT,
  PREMIUM_STORE_PORTRAIT_FRAME_SIZE,
};
