import type { TgProduct } from './types';
import { alex2SynthesisVerified } from './alex2-proof';
export function tgReadiness(product: TgProduct, env: Record<string, string | undefined> = process.env) {
  const scopedDaily=product.productionStandard==='cdaily-v1'&&product.publicationDriver==='chatgpt-work';
  const prefix = product.edition === 'it' ? 'TG_IT_' : 'TG_WORLD_';
  const alex2=product.productionStandard==='cdaily-v1'&&product.edition==='it'&&product.presenters===1&&alex2SynthesisVerified(env);
  const checks = [
    { id: 'ai', label: 'Ricerca e redazione AI', ready: Boolean(env.OPENAI_API_KEY) && (scopedDaily || env.TG_AI_ENABLED === 'true' && env.PODCAST_AI_ENABLED === 'true') },
    { id: 'speech', label: product.productionStandard==='cdaily-v1' ? alex2?'Alex 2 · sintesi API verificata':'Alex 2 · verifica API reale richiesta' : product.language === 'it' ? 'Voci italiane · Inworld TTS-2' : 'Voci inglesi · Inworld TTS-2', ready: (scopedDaily||env.PODCAST_SPEECH_ENABLED === 'true')&&(product.productionStandard==='cdaily-v1'?alex2:Boolean(env.INWORLD_API_KEY)) },
    { id: 'worker', label: scopedDaily?'Controller giornaliero · segnale recente richiesto':'Worker video e archivio persistente', ready: scopedDaily||env.TG_WORKER_ENABLED === 'true' && Boolean(env.TG_ARTIFACT_DIR) },
  ];
  if(product.automatic)checks.push({id:'final-review',label:'Revisore finale AI indipendente',ready:Boolean(env.OPENAI_API_KEY)&&(scopedDaily||env.TG_AUTOMATIC_REVIEW_ENABLED==='true'&&env.TG_AI_ENABLED==='true')});
  let publicMedia=false;
  try {const url=new URL(env.TG_MEDIA_PUBLIC_ORIGIN||'');publicMedia=url.protocol==='https:'&&!url.username&&!url.password;}catch{}
  const channels = product.platforms.map(platform => {
    const required = platform === 'youtube' ? ['YOUTUBE_CLIENT_ID','YOUTUBE_CLIENT_SECRET','YOUTUBE_REFRESH_TOKEN','YOUTUBE_CHANNEL_ID']
      : platform === 'instagram' ? ['INSTAGRAM_ACCESS_TOKEN','INSTAGRAM_ACCOUNT_ID']
      : platform === 'tiktok' ? ['METRICOOL_BLOG_ID','TIKTOK_USERNAME'] : ['SPOTIFY_SHOW_ID'];
    const linked=required.every(name=>Boolean(env[prefix+name]));
    const extra=platform==='tiktok'?Boolean(env.TG_METRICOOL_TOKEN&&env.TG_METRICOOL_USER_ID)
      :platform==='spotify'?Boolean(env.TG_SPOTIFY_PARTNER_URL?.startsWith('https://')&&env.TG_SPOTIFY_PARTNER_TOKEN)
      :platform==='instagram'?Boolean(env.TG_META_GRAPH_VERSION):true;
    const mediaReady=platform==='youtube'||platform==='tiktok'||publicMedia;
    const configured=linked&&extra&&mediaReady;
    const target=platform==='youtube'?env[prefix+'YOUTUBE_CHANNEL_ID']:platform==='instagram'?env[prefix+'INSTAGRAM_ACCOUNT_ID']
      :platform==='tiktok'?env[prefix+'TIKTOK_USERNAME']:env[prefix+'SPOTIFY_SHOW_ID'];
    return {platform,configured,ready:configured&&env.TG_PUBLISH_ENABLED==='true',target:target||'',
      reason:!linked?'Account dell’edizione da collegare':!extra?'Servizio di distribuzione da configurare':!mediaReady?'Indirizzo HTTPS dei video da configurare':env.TG_PUBLISH_ENABLED!=='true'?'Invii reali disabilitati sul server':'Configurato; verifica il collegamento prima del lancio',
      mode:platform==='tiktok'?'Metricool · pubblicazione programmata':platform==='spotify'?'Host video Spotify':'API nativa'};
  });
  const editorialConfigured=checks.find(c=>c.id==='ai')!.ready;
  return {checks,channels,editorialConfigured,editorialReady:false,
    mediaDeferred:product.productionMode==='editorial',
    productionReady:product.productionMode!=='editorial'&&checks.every(x=>x.ready)&&channels.every(x=>x.ready),reviewRequired:true,automaticReviewAvailable:scopedDaily?Boolean(env.OPENAI_API_KEY):env.TG_AUTOMATIC_REVIEW_ENABLED==='true',reviewMode:product.automatic?'ai' as const:'human' as const};
}
