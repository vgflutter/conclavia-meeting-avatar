import type {TgStudioConfig} from '@conclavia/avatar-kit/formats/tg';
import {dailyStudioConfig} from './daily-studio-theme';

/** Production opts into the approved articulated anatomy. Artwork, palette,
 * frozen exports and the historical design catalogue remain independent. */
export const dailyProductionStudioConfig:TgStudioConfig={...dailyStudioConfig,
 palette:{...dailyStudioConfig.palette,finish:'sculpted',posture:'standing',handStyle:'anatomical'},
 secondaryPalette:{...dailyStudioConfig.secondaryPalette!,finish:'sculpted',posture:'standing',handStyle:'anatomical'},
};
