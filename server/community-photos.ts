import {CloudError,cloudConfiguration,cloudRequest} from './cloud-client.js';
export const validMemberId=(id:unknown):id is string=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
export async function communityPhotos(token:string,ids:string[]):Promise<Record<string,string>>{
 const unique=[...new Set(ids.filter(validMemberId))].slice(0,100);if(!unique.length)return {};
 const photos:any=await cloudRequest('/rest/v1/community_photos?visible=eq.true&owner_id=in.('+unique.join(',')+')&select=owner_id,version',token);
 if(!Array.isArray(photos)||!photos.length)return {};
 const versions=new Map(photos.map((row:any)=>[row.owner_id,row.version]));const paths=photos.map((row:any)=>row.owner_id+'/avatar.png');
 const signed:any=await cloudRequest('/storage/v1/object/sign/community-avatars',token,{method:'POST',body:JSON.stringify({paths,expiresIn:900})});const result:Record<string,string>={};
 if(!Array.isArray(signed))throw new CloudError('PHOTO_UNAVAILABLE');
 for(const row of signed){const owner=String(row.path||'').split('/')[0];if(!paths.includes(row.path)||row.error||typeof row.signedURL!=='string'||!row.signedURL.startsWith('/object/sign/community-avatars/'+row.path+'?'))continue;result[owner]=cloudConfiguration().url+'/storage/v1'+row.signedURL+'&cacheNonce='+encodeURIComponent(String(versions.get(owner)));}
 return result;
}
export function normalizedPhoto(value:unknown):Buffer{
 if(typeof value!=='string'||value.length>1398104||!value.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new CloudError('INVALID_PHOTO',400);
 const bytes=Buffer.from(value,'base64');
 if(bytes.length<45||bytes.length>1048576||bytes.toString('base64')!==value||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR')throw new CloudError('INVALID_PHOTO',400);
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(width<48||height<48||width>512||height>512)throw new CloudError('INVALID_PHOTO',400);
 return bytes;
}
