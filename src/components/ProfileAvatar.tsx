import {useState} from 'react';
import {useAuth} from '@/hooks/useAuth';
import {useProfilePhoto} from '@/hooks/useProfilePhoto';
export default function ProfileAvatar({size=36}:{size?:number}){
 const {user}=useAuth();const url=useProfilePhoto();const [failed,setFailed]=useState<string|null>(null);
 return url&&failed!==url?<img src={url} alt={(user?.name||'Your')+' profile photo'} width={size} height={size} onError={()=>setFailed(url)} className="shrink-0 rounded-full object-cover" style={{width:size,height:size}}/>:<span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-full bg-[#332C28] text-xs font-bold text-[#F4C895]" style={{width:size,height:size}}>{user?.initials||'BB'}</span>;
}
