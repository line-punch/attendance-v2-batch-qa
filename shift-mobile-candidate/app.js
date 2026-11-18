'use strict';
// This page uses the isolated TEST001 attendance service.
(function(){
 const $=id=>document.getElementById(id),api=window.YCShiftQAService;
 const state=window.YCShiftClientState.create();let busy=false,ready=false;
 const punches=[['clockIn','上班'],['clockLeave','中途離開'],['clockOut','下班'],['clockReturn','返回']];
 let allowedPunches=null;
 const key='yc_isolated_multi_pending_v1';let uncertain=null,missingConfirmation=null;
 try{uncertain=JSON.parse(sessionStorage.getItem(key)||'null');}catch(_){uncertain={invalid:true};}
 function message(t){$('status').textContent=t;}
 function controls(){
  for(const id of ['login','refresh','confirmMissingClock'])$(id).disabled=busy||!ready||!!uncertain&&id==='confirmMissingClock';
  for(const [id,type] of punches)$(id).disabled=busy||!ready||!!uncertain||!allowedPunches?.includes(type);
  $('shift').disabled=busy||!!uncertain;
 }
 function savePending(v){uncertain=v;try{if(v)sessionStorage.setItem(key,JSON.stringify(v));else sessionStorage.removeItem(key);}catch(_){if(v)throw Error('無法保存核對編號，尚未送出；請保留畫面，不要重送。');}controls();}
 async function policy(){
  allowedPunches=null;
  const p=await api.call('CLOCK_POLICY',{});
  if(!p.ok){
   const labels={
    AUTH_REQUIRED:'測試帳號驗證未通過，請關閉測試頁，再從 LINE 開啟。',
    FEATURE_DISABLED:'測試後端尚未開放選班。',
    INVALID_FORM:'測試頁與後端版本不一致，請關閉測試頁後重新開啟。'
   };
   throw Error((labels[p.code]||'目前無法讀取測試選班設定。')+' 本次未送出打卡。'+(p.code?'（'+p.code+'）':''));
  }
  try{state.setPolicy(p);}catch(e){
   if(e.message!=='POLICY_INVALID')throw e;
   throw Error('測試後端回傳的選班設定格式有誤，本次未送出打卡。');
  }
  if(!Array.isArray(p.allowedClockTypes)||p.allowedClockTypes.some(type=>!punches.some(([,kind])=>kind===type)))throw Error('測試後端尚未提供今日打卡狀態。');
  allowedPunches=p.allowedClockTypes;
  $('shiftBox').hidden=!p.choiceRequired||p.clockInRecorded;
  $('savedShift').textContent=p.clockInRecorded?'當日已保存班別：'+({EARLY:'早班',STANDARD:'正常班'}[p.todayShift]||'待核對'):'';
 }
 async function run(fn){if(busy)return;busy=true;controls();try{await fn();}catch(e){message(String(e.message||e));}finally{busy=false;controls();}}
 async function clock(type,missingAfter){await run(async()=>{
  missingConfirmation=null;$('confirmMissingClock').hidden=true;
  if(uncertain)throw Error('上一筆結果不明，請先重新整理核對，不能再送出。');
  await policy();
  if(!allowedPunches.includes(type))throw Error('此操作目前不可用，請依今日打卡順序操作。');
  if(type==='上班'&&!$('shiftBox').hidden)state.select($('shift').value);
  const id='QA_MULTI_'+Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  const original=state.prepare(type,id);message('正在定位，尚未送出…');
  let gps;try{gps=await api.gps();}catch(e){state.clearUnwritten(id);throw Error('定位未完成，尚未送出打卡。');}
  const ageOnPhone=Number.isFinite(gps.capturedAt)?Math.round((Date.now()-gps.capturedAt)/1000):null;
  savePending(original);message('正在送出隔離測試，請勿重複點擊。');
  let reply;try{reply=await api.call('GPS_CLOCK',{...original,...gps,...(missingAfter===undefined?{}:{missingAfter})});}catch(e){throw Error('結果尚未確認，請重新整理核對，暫勿重送。');}
  if(!reply.ok){
   if(reply.persisted===false){
    state.clearUnwritten(id);savePending(null);
    if(reply.code==='CLOCK_MISSING_CONFIRM'&&typeof reply.missingAfter==='string'){
     missingConfirmation={type,after:reply.missingAfter};
     $('confirmMissingClock').hidden=false;
     throw Error('上一段有漏卡。確認後可以先記下本次時間。');
    }
    if(reply.code==='GPS_EXPIRED'){
     const serverOffset=reply.gpsTiming?.relativeToServerSeconds;
     const phoneAge=Number.isFinite(ageOnPhone)?Math.abs(ageOnPhone)+' 秒'+(ageOnPhone<0?'後':'前'):'時間格式無效';
     const serverAge=Number.isFinite(serverOffset)?Math.abs(serverOffset)+' 秒'+(serverOffset>0?'後':'前'):'未取得';
     throw Error('定位時間未通過驗證，這次打卡未寫入。手機判定定位取得於 '+phoneAge+'，伺服器判定 '+serverAge+'。');
    }
    const labels={SAME_MINUTE:'同一分鐘已有打卡，請隔一分鐘再按下一顆。',OUT_OF_RANGE:'目前位置超出測試打卡範圍。',CLOCK_DAY_CLOSED:'測試日已完成下班打卡。',CLOCK_ALREADY_STARTED:'今天已打上班卡。',CLOCK_START_REQUIRED:'請先打上班卡。',CLOCK_LEAVE_REQUIRED:'請先打中途離開卡。',CLOCK_RETURN_REQUIRED:'請先打中途返回卡。'};
    throw Error(labels[reply.code]||'測試打卡未寫入：'+String(reply.code||'UNKNOWN'));
   }
   throw Error('結果尚未確認，請重新整理核對，暫勿重送。');
  }
  state.settle(reply.request);savePending(null);const saved='隔離測試已保存：'+(type==='返回'?'中途返回':type)+' '+reply.request.time;
  message(saved);
  try{await policy();}catch(_){message(saved+'。選班設定更新失敗，請稍後重新整理紀錄。');}
 });}
 $('login').onclick=()=>run(async()=>{await api.login();await policy();message(uncertain?'上一筆結果未確認，請重新整理核對。':'隔離登入及選班規則已確認。');});
 for(const [id,type] of punches)$(id).onclick=()=>clock(type);
 $('confirmMissingClock').onclick=()=>{if(missingConfirmation)clock(missingConfirmation.type,missingConfirmation.after);};
 $('refresh').onclick=()=>run(async()=>{
  if(uncertain){const r=await api.call('GPS_STATUS',{requestId:uncertain.requestId,type:uncertain.type});if(!r.ok||!r.request||r.request.requestId!==uncertain.requestId||r.request.type!==uncertain.type||uncertain.shiftCode&&r.request.shiftCode!==uncertain.shiftCode)throw Error('原筆仍未確認，保留編號，暫勿重送。');if(state.original())state.settle(r.request);savePending(null);}
  await policy();const r=await api.call('MY_CLOCKS',{});if(!r.ok)throw Error('紀錄查詢未完成。');$('records').replaceChildren();for(const day of r.days){const p=document.createElement('p');p.textContent=day.date+'｜'+(day.clockIn||'—')+'｜'+(day.clockOut||'—');$('records').append(p);
  (day.segments||[]).forEach((part,i)=>{const detail=document.createElement('div');detail.textContent='第 '+(i+1)+' 段 '+(part.start||'—')+'～'+(part.end||'—');$('records').append(detail);});}message(allowedPunches.length?'隔離當月紀錄已更新。':'今天已完成下班，當月紀錄已更新。');
 });
 if(!api||api.scope!=='TEST001/TEST_CO'||api.enabled!==true){message('隔離畫面已準備；登入與服務接線未啟用，所有送件關閉。');return;}
 ready=true;controls();
})();
