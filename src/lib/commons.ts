import {currentManagedToken} from './managedSession';
export type CommonsAuthor={id:string|null;name:string;country:string;official:boolean;photo?:string|null};
export type CommonsComment={id:string;body:string;createdAt:string;author:CommonsAuthor;canHide:boolean};
export type CommonsPost={id:string;title:string;body:string;forum:string;createdAt:string;author:CommonsAuthor;canHide:boolean;likes:number;liked:boolean;replyCount:number;comments:CommonsComment[];reports?:{reason:string;createdAt:string}[]};
export async function commonsRequest(body?:Record<string,unknown>,before?:string):Promise<{posts:CommonsPost[];nextCursor:string|null}>{
 const token=await currentManagedToken();const response=await fetch('/api/commons'+(before?'?before='+encodeURIComponent(before):''),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});const result=await response.json();if(!response.ok)throw new Error(result.code==='COMMUNITY_LIMIT'?'You have reached today’s community posting limit. Please try again tomorrow.':result.code==='PAID_SUBSCRIPTION_REQUIRED'?'An active paid membership is required to participate in Commons.':'Commons could not complete this request. Please try again.');return result;
}
