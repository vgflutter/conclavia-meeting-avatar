import type { GestureIntent, PerformanceChoreography } from '@conclavia/avatar-kit/performance';
import type { PodcastEmotion } from '@conclavia/avatar-kit/types/podcast';
export type TgEdition = 'it' | 'world';
export type TgPlatform = 'youtube' | 'instagram' | 'tiktok' | 'spotify';
export type TgState = 'queued' | 'researching' | 'writing' | 'verifying' | 'editorial_ready' | 'voicing' | 'rendering' | 'reviewing' | 'needs_review' | 'ready' | 'publishing' | 'published' | 'blocked' | 'failed' | 'cancelled';
export interface TgProduct {
  edition: TgEdition; name: string; language: 'it' | 'en'; seconds: number; presenters: 1 | 2;
  /** Omitted on legacy snapshots: prepare 45 minutes before publication. */
  productionStandard?: 'cdaily-v1';
  /** Versioned editorial coverage/clock; absent on frozen legacy editions. */
  editorialProfile?: 'italia-morning-v2';
  /** Editorial commissioning stops after A/B and private text export. */
  productionMode?: 'editorial' | 'full';
  /** Additional user confirmation AFTER AI A/B; omitted/ai continues automatically. */
  textReviewMode?: 'manual' | 'ai';
  productionTime?: string;
  publicationDriver?: 'worker' | 'chatgpt-work';
  /** Publish approved media to the public site; Work consumes that release. */
  siteFirst?: boolean;
  publishTime: string; timezone: string; enabled: boolean; automatic: boolean; platforms: TgPlatform[];
}
export interface TgSource { id: string; publisher: string; url: string; title: string; publishedAt: string; evidence: string; independentGroup: string; feedId?:string }
export interface TgStory {
  id: string; headline: string; category: 'world' | 'economy' | 'society' | 'science' | 'culture';
  importance: number; changedSinceYesterday: string; whyItMatters: string; uncertainty: string;
  sourceIds: string[]; facts: { text: string; sourceIds: string[] }[];
}
export interface TgResearch { stories: TgStory[]; sources: TgSource[]; collectedAt: string; searchCalls: number; warnings: string[]; retrievedContext?:{storyId:string;brief:string;sourceUrls:string[]}[] }
export interface TgSentence { intent?:GestureIntent;gestureWord?:string;text: string; mood: PodcastEmotion; intensity: number; speaker: 0 | 1; storyId: string; sourceIds: string[] }
export interface TgScript { cards?:{storyId:string;context:string;change:string}[]; headlines?: {storyId:string;title:string}[]; title: string; description: string; sentences: TgSentence[] }
export interface TgCue extends TgSentence { choreography?:PerformanceChoreography;performanceWindow?:{start:number;end:number};gestureAccent?:number;gestureAlignment?:'word'|'phrase';start: number; end: number; alignment?:'word'|'estimated'|'sentence-pcm'; frameSeconds?: number; levels?: number[]; phones?: { start: number; end: number; viseme: string }[] }
export type TgSpeechPlan = {provider:'inworld';model:'inworld-tts-2';speakingRate:number;direction:'daily-natural-v1'|'daily-phrased-v2'|'daily-brisk-v3';voices:string[]}
  | {provider:'elevenlabs';model:'eleven_v4';speakingRate:1;direction:'alex2-connected-v1';voices:string[]};
export interface TgManifest { version: 1; product: TgProduct; date: string; seconds: number; stories: TgStory[]; sources: TgSource[]; cues: TgCue[]; demo?: boolean; speech?:TgSpeechPlan;
  fps?:25|50; voiceConfigSha256?:string; lipSync?:'word-anchored-estimate'; openingPause?:{atSeconds:number;addedSeconds:number;wordGapSeconds:number;quietRms:number;fadeSeconds:number} }
export interface TgAuditCheck { key: string; status: 'supported' | 'unsupported' | 'unverifiable'; evidence: string; sourceUrls: string[] }
export interface TgPublishedEdition {
  id:string; edition:TgEdition; date:string; publishedAt:string;
  stories:{key:string;headline:string;claims:string[];development?:string}[];
}
export interface TgFreshnessCheck {
  storyId:string;status:'new'|'update'|'duplicate'|'stale'|'unverifiable';development:string;eventDate:string;evidence:string;
  sourceIds:string[];webUrls:string[];previousStoryKeys:string[];
  /** Additive detail on new reports; historical reports remain readable. */
  latest?:{status:'current'|'superseded'|'unverifiable';evidence:string;webUrls:string[];supersededText:string;replacementText:string};
}
export interface TgFreshnessReview {
  version:1;checkedAt:string;researchSha256:string;scriptSha256:string;historySha256:string;windowStart:string;
  previousStoryKeys:string[];checks:TgFreshnessCheck[];issues:string[];passed:boolean;
  evidenceCheckedAt?:string;
}
export interface TgAudit { freshness?:TgFreshnessReview; scriptSha256: string; passed: boolean; issues: string[]; checkedFacts: number; checkedAt: string; evidence: string; sources: { url: string; title: string }[]; checks?: TgAuditCheck[]; webSourceUrls?:string[] }
export interface TgScriptReview {
  version:1;inputSha256:string;scriptSha256:string;checkedAt:string;model:string;passed:boolean;issues:string[];
  narrationText:string;scoreMarkup:string;
  checks:Record<'coherence'|'impartiality'|'opening'|'closing'|'coverage',boolean>;
  clauses:{index:number;content:boolean;form:boolean;delivery:boolean;reason:string}[];
  /** Required for new verdicts; absent on preserved historical reports. */
  quality?:Record<'naturalness'|'nonRedundancy'|'contextRelevance'|'informationValue',{passed:boolean;reason:string;clauseIndices:number[]}>;
}
export interface TgAsset { name: 'landscape.mp4' | 'portrait.mp4' | 'audio.mp3' | 'captions.vtt' | 'manifest.json'; bytes: number; sha256: string; duration?: number }
export interface TgPublicationPlan { platforms: TgPlatform[]; scheduledAt: string }
export interface TgReview {
  decision: 'approved' | 'changes_requested' | 'withdrawn'; reviewer: string; at: string; note: string;
  checks: Record<string, boolean>; bundleSha256?: string; destinations?: Partial<Record<TgPlatform | 'website', string>>; mode?: 'human' | 'ai'; scope?: 'website';
}
export interface TgMediaCheck {
  format: 'landscape' | 'portrait'; width: number; height: number; seconds: number;
  fps?: number;
  rms: number; peak: number; clippedRatio: number; leadingSilence: number; trailingSilence: number;
}
export interface TgFinalReview {
  version: 1; checkedAt: string; inputSha256: string; model: string; passed: boolean;
  checks: Record<'visual' | 'headlines' | 'captions' | 'emotion' | 'publication', boolean>;
  issues: string[]; summary: string; media: TgMediaCheck[];
  samples: { format: 'landscape' | 'portrait'; at: number }[];
}
export interface TgJob {
  id: string; edition: TgEdition; date: string; state: TgState; product: TgProduct; research?: TgResearch; script?: TgScript;
  audit?: TgAudit; scriptReview?:TgScriptReview; editorialRepairs?:number; durationRepairs?:number; manifest?: TgManifest; assets: TgAsset[]; issues: string[]; events: { at: string; stage: string; detail: string }[];
  approvedAt?: string; publishedAt?: string; createdAt: string; updatedAt: string; attempts: number;
  coverageRecovery?: import('./coverage-recovery').CoverageRecoveryState;
  coverageRecoveryHistory?: import('./coverage-recovery').CoverageRecoveryState[];
  revision?: number; publicationPlan?: TgPublicationPlan; review?: TgReview;
  finalReview?: TgFinalReview;
  sitePublication?: {url:string;releaseUrl:string;bundleSha256:string;publishedAt:string;stories:TgPublishedEdition['stories']};
  nextProductionAttemptAt?: string;
  textApproval?: {mode:'manual';reviewer:string;at:string;date:string;scriptSha256:string;scoreSha256:string};
  deliveries: { platform: TgPlatform; state: string; remoteId?: string; url?: string; issue?: string; attempts?: number; nextAttemptAt?: string; resumable?: boolean }[];
}
