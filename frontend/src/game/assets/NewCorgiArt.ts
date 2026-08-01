import { NEW_CORGI_ART_CHUNK_0 } from './NewCorgiArtChunk0';
import { NEW_CORGI_ART_CHUNK_1 } from './NewCorgiArtChunk1';
import { NEW_CORGI_ART_CHUNK_2 } from './NewCorgiArtChunk2';
import { NEW_CORGI_ART_CHUNK_3 } from './NewCorgiArtChunk3';
import { NEW_CORGI_ART_CHUNK_4 } from './NewCorgiArtChunk4';
import { NEW_CORGI_ART_CHUNK_5 } from './NewCorgiArtChunk5';
import { NEW_CORGI_ART_CHUNK_6 } from './NewCorgiArtChunk6';
import { NEW_CORGI_ART_CHUNK_7 } from './NewCorgiArtChunk7';

const WEBP_BASE64 =
  NEW_CORGI_ART_CHUNK_0 +
  NEW_CORGI_ART_CHUNK_1 +
  NEW_CORGI_ART_CHUNK_2 +
  NEW_CORGI_ART_CHUNK_3 +
  NEW_CORGI_ART_CHUNK_4 +
  NEW_CORGI_ART_CHUNK_5 +
  NEW_CORGI_ART_CHUNK_6 +
  NEW_CORGI_ART_CHUNK_7;

if (!WEBP_BASE64.startsWith('UklG')) {
  throw new Error('[Corgi Hop] Bundled premium corgi art is not a RIFF WebP.');
}

export const NEW_CORGI_ART_DATA_URI = `data:image/webp;base64,${WEBP_BASE64}`;
export const NEW_CORGI_ART_FRAME_SIZE = 128;
export const NEW_CORGI_ART_FRAME_COUNT = 8;
