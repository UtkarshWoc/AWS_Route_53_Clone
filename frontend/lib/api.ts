const api=process.env.NEXT_PUBLIC_API_URL||'http://localhost:8000';
export class ApiError extends Error{constructor(public code:string,message:string){super(message)}}
export async function request(path:string,options:RequestInit={}){const r=await fetch(api+path,{...options,credentials:'include',headers:{'Content-Type':'application/json',...options.headers}});if(!r.ok){const j=await r.json().catch(()=>null);throw new ApiError(j?.error?.code||'REQUEST_FAILED',j?.error?.message||'Request failed.')}return r.status===204?null:r.json()}
