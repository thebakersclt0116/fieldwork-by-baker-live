import {currentManagedToken} from './managedSession';
export const countries=[['NONE','Prefer not to say'],['US','🇺🇸 United States'],['AU','🇦🇺 Australia'],['GB','🇬🇧 United Kingdom'],['OTHER','🌐 Other']] as const;
export type CommunityPreferences={country:string;show_country:boolean;share_presence:boolean};
export type CommunityMember={member_id:string;display_name:string;country:string;active_now:boolean|null};
export async function communityRequest(body?:Record<string,unknown>):Promise<{preferences:CommunityPreferences;members:CommunityMember[]}>{
 const token=await currentManagedToken();const response=await fetch('/api/community',{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('Community settings are unavailable. Please try again.');return response.json();
}
