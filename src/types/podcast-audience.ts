// Recovered from vgflutter/conclavia @ 5d4746f900a106defe1377131bce7ebbc5b69ca3.
// Namespaced podcast feature; existing Meeting records and runtime stay separate.
export type AudienceMessageStatus =
  | "pending"
  | "available"
  | "on_air"
  | "queued"
  | "used"
  | "rejected";

export type AudienceCueMode = "host" | "participant" | "prompt";

export interface TalkRunAudienceCue {
  provider: "youtube";
  messageId: string;
  authorName: string;
  authorImageUrl?: string;
  content: string;
  mode: AudienceCueMode;
  targetParticipantIndex?: number;
}

export interface AudienceMessageResponse {
  id: string;
  authorChannelId?: string;
  authorName: string;
  authorImageUrl?: string;
  content: string;
  publishedAt: string;
  status: AudienceMessageStatus;
  isSponsor: boolean;
  isModerator: boolean;
  amountDisplayString?: string;
  action?: "on_air" | AudienceCueMode;
  targetParticipantIndex?: number;
  onAirUntil?: string;
  selectedAt?: string;
  usedAt?: string;
}

export interface AudienceRoomResponse {
  configured: boolean;
  connected: boolean;
  provider: "youtube";
  videoId?: string;
  videoTitle?: string;
  moderationEnabled: boolean;
  pollingIntervalMillis: number;
  messages: AudienceMessageResponse[];
  activeMessage?: AudienceMessageResponse;
  error?: string;
  updatedAt?: string;
}
