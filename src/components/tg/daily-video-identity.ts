import type {TgPromoConfig} from '@conclavia/avatar-kit/formats/tg';
import {dailyStudioConfig} from './daily-studio-theme';

/** Approved CDaily video identity. Reuse for future videos without importing UI.
 * Product artwork/type/colour live here; rendering and anatomy live in the kit.
 * Reference: docs/tg/cdaily-video-guide.md and cdaily-visual-lock.json. */
export const dailyVideoIdentity:TgPromoConfig={...dailyStudioConfig,
 fontFamily:'CDaily Editorial',displayFontFamily:'CDaily Editorial',
 fonts:[{family:'CDaily Editorial',url:'/brand/cdaily-bricolage.woff2',weight:'400 800'}],
 invertedLogoUrl:'/daily-studio/conclavia-logo-white.svg',programmeLogoUrl:'/brand/cdaily.svg',
 ink:'#182f3b',paper:'#fafbfc',accent:'#305bd2',highlight:'#9fbaff',dark:'#182f3b',
 visualStyle:'clean',deskStyle:'slim',captions:'separate',provenanceLabel:'by',statusLabel:'Progetto in sviluppo',
};
