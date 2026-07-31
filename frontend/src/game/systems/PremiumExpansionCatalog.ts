export type { ExpansionDef, CoatStyle, Theme } from './PremiumExpansionTypes';
import type { ExpansionDef } from './PremiumExpansionTypes';
import { PREMIUM_A } from './PremiumExpansionCatalogA';
import { PREMIUM_B } from './PremiumExpansionCatalogB';
import { PREMIUM_C } from './PremiumExpansionCatalogC';
export const PREMIUM_EXPANSION: ExpansionDef[] = [...PREMIUM_A, ...PREMIUM_B, ...PREMIUM_C];
