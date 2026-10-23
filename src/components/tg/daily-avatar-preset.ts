import type {RobotPalette} from '@conclavia/avatar-kit/characters/robot';

/** Product approval, separate from the reusable character/motion engine. */
export const dailyApprovedAvatar={
 finish:'sculpted',posture:'standing',handStyle:'anatomical',
} as const satisfies Pick<RobotPalette,'finish'|'posture'|'handStyle'>;
export const dailyApprovedStyleRevision='avatar-refined-presence-20261023';

export type DailyAvatarMetadata={avatarFinish?:unknown;avatarPosture?:unknown;avatarHands?:unknown};
/** Frozen edition metadata selects its appearance. Historical manifests with
 * no appearance fields retain the legacy look; explicit lab queries win. */
export function dailyAvatarAppearance(metadata:DailyAvatarMetadata,query:URLSearchParams){
 const finish=query.has('finish')?query.get('finish'):metadata.avatarFinish;
 const posture=query.has('posture')?query.get('posture'):metadata.avatarPosture;
 const hands=query.has('hands')?query.get('hands'):metadata.avatarHands;
 return {finish:finish==='sculpted'?'sculpted' as const:undefined,
  posture:posture==='desk'?'desk' as const:posture==='standing'?'standing' as const:undefined,
  handStyle:hands==='anatomical'?'anatomical' as const:hands==='shell'?'shell' as const:undefined};
}
