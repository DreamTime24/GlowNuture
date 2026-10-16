window.GNApi=(()=>{
  'use strict';
  const BASE=(document.querySelector('meta[name="gn-api-base"]')?.content||'').trim().replace(/\/+$/,'');
  const csrf=()=>document.cookie.split('; ').find(v=>v.startsWith('gn_csrf='))?.split('=')[1]||'';
  async function request(url,options={}){
    if(!url.startsWith('/api/'))throw new Error('Use a store API path.');
    const headers={...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),'X-CSRF-Token':csrf(),...options.headers};
    if(window.GNAuth?.appCheckToken){const token=await GNAuth.appCheckToken();if(token)headers['X-Firebase-AppCheck']=token;}
    let response;
    try{response=await fetch(BASE+url,{credentials:'include',...options,headers,signal:options.signal||AbortSignal.timeout(65000)});}
    catch(error){throw new Error(error.name==='TimeoutError'?'Server response দেরি হচ্ছে। পরে চেষ্টা করুন।':'Server connection হয়নি। আবার চেষ্টা করুন।');}
    if(!response.ok){
      const data=await response.json().catch(()=>({})),detail=data.detail;
      const error=new Error(typeof detail==='string'?detail:Array.isArray(detail)?detail[0]?.msg||'তথ্য যাচাই করুন।':detail?.message||'Request failed. Try again.');
      error.checks=Array.isArray(detail?.checks)?detail.checks:[];error.code=detail?.code||'';
      error.status=response.status;throw error;
    }
    return options.raw?response:response.status===204?null:response.json();
  }
  const write=method=>(url,data,options={})=>request(url,{...options,method,body:JSON.stringify(data??{})});
  async function download(url,name,data){
    const response=await request(url,{raw:true,...(data?{method:'POST',body:JSON.stringify(data)}:{})});
    const href=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=href;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),30000);
  }
  return {get:(url,options)=>request(url,options),post:write('POST'),put:write('PUT'),patch:write('PATCH'),delete:write('DELETE'),request,download,csrf,base:BASE};
})();
window.GNConfigReady=GNApi.get('/api/config').then(config=>(window.GNConfig=config)).catch(error=>{
  window.GNConfigError=error.message;window.GNConfig={checkoutEnabled:false,payments:{},firebase:{enabled:false},brand:{},seller:{}};return window.GNConfig;
});
