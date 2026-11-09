'use strict';
(function(){
 const config=window.YCShiftQAConfig;
 if(!config||config.enabled!==true)return;
 const endpoint=new URL(config.endpoint);
 if(endpoint.protocol!=='https:'||endpoint.hostname!=='script.google.com'||!/^\/macros\/s\/[\w-]+\/exec$/.test(endpoint.pathname)||endpoint.search||endpoint.hash||endpoint.username||endpoint.password||config.liffId!=='2012136707-CgGNZAuq')throw Error('隔離服務設定不正確');
 let initialized=false;
 async function login(){
  if(!window.liff){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://static.line-scdn.net/liff/edge/2/sdk.js';script.onload=resolve;script.onerror=()=>reject(Error('LINE元件載入失敗'));document.head.append(script);});}
  if(!initialized){await liff.init({liffId:config.liffId});initialized=true;}
  if(!liff.isLoggedIn()){liff.login({redirectUri:window.location.href});throw Error('正在開啟測試LINE登入，尚未送件。');}
  if(!liff.getIDToken())throw Error('無法取得測試登入憑證');
 }
 function call(operation,args){
  if(!initialized||!liff.isLoggedIn()||!liff.getIDToken())return Promise.reject(Error('請先確認測試LINE登入'));
  if(!['CLOCK_POLICY','GPS_CLOCK','GPS_STATUS','MY_CLOCKS'].includes(operation))return Promise.reject(Error('測試操作未開放'));
  return new Promise((resolve,reject)=>{
   const nonce=Array.from(crypto.getRandomValues(new Uint8Array(20)),v=>v.toString(16).padStart(2,'0')).join('');
   const frame=document.createElement('iframe'),form=document.createElement('form');frame.name='shift_'+nonce;frame.hidden=true;form.hidden=true;
   form.method='POST';form.action=endpoint.href;form.target=frame.name;form.acceptCharset='UTF-8';
   const params={nonce,operation,candidateRoute:'shift-qa-v1',payload:JSON.stringify({idToken:liff.getIDToken(),args})};
   for(const [key,value] of Object.entries(params)){const input=document.createElement('input');input.type='hidden';input.name=key;input.value=value;form.append(input);}
   let timer,done=false;
   function finish(error,value){if(done)return;done=true;clearTimeout(timer);window.removeEventListener('message',receive);form.remove();frame.remove();if(error)reject(error);else resolve(value);}
   function receive(event){let origin;try{origin=new URL(event.origin);}catch(_){return;}
    if(origin.protocol!=='https:'||!(origin.hostname==='script.google.com'||origin.hostname==='script.googleusercontent.com'||origin.hostname.endsWith('.googleusercontent.com')))return;
    const data=event.data;if(!data||data.bridge!=='YC_SHIFT_QA_V1'||data.nonce!==nonce)return;
    const result=data.ok?data.result:{ok:false,code:data.code,persisted:data.persisted};
    if(!result||typeof result.ok!=='boolean')return;
    if(!result.ok&&result.code!=='UNKNOWN'&&result.persisted===undefined)result.persisted=false;
    finish(null,result);
   }
   window.addEventListener('message',receive);document.body.append(frame,form);
   timer=setTimeout(()=>finish(Error('45秒內未收到有效回覆，請保留原申請編號。')),45000);
   try{form.submit();}catch(e){finish(e);}
  });
 }
 function gps(){return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(Error('裝置未提供定位'));navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,capturedAt:p.timestamp}),reject,{enableHighAccuracy:true,maximumAge:0,timeout:20000});});}
 window.YCShiftQAService=Object.freeze({scope:'TEST001/TEST_CO',enabled:true,login,call,gps});
})();
