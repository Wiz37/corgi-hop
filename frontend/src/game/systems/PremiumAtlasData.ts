import atlasA from './PremiumAtlasA';
import atlasB from './PremiumAtlasB';
import atlasC from './PremiumAtlasC';

const PREFIX = 'data:image/webp;base64,';
export const PREMIUM_ATLAS_DATA_URLS = [
  PREFIX + atlasA,
  PREFIX + atlasB,
  PREFIX + atlasC,
] as const;
