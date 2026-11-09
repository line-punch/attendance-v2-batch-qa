'use strict';
// Transport is deliberately not configured: no accidental access to the live service.
// A separate authenticated QA adapter must expose login(), call(op,args), gps().
(function(){
 const $=id=>document.getElementById(id),api=window.YCShiftQAService;
 const state=window.YCShiftClientState.create();let busy=false,ready=false;
 const key='yc_isolated_shift_pending_v1';let uncertain=null;
 try{uncertain=JSON.parse(sessionStorage.getItem(key)||'null');}catch(_){uncertain={invalid:true};}
 function message(t){$('status').textContent=t;}
 function controls(){for(const id of ['login','clockIn','clockOut','refresh'])$(id).disabled=busy||!ready||!!uncertain&&id!=='refresh';$('shift').disabled=busy||!!uncertain;}
 function savePending(v){uncertain=v;try{if(v)sessionStorage.setItem(key,JSON.stringify(v));else sessionStorage.removeItem(key);}catch(_){if(v)throw Error('無法保存核對編號，尚未送出；請保留畫面，不要重送。');}controls();}
 async function policy(){const p=await api.call('CLOCK_POLICY',{});state.setPolicy(p);$('shiftBox').hidden=!p.choiceRequired||p.clockInRecorded; $('savedShift').textContent=p.clockInRecorded?'當日已保存班別：'+({EARLY:'早班',STANDARD:'正常班'}[p.todayShift]||'待核對'):'';}
 async function run(fn){if(busy)return;busy=true;controls();try{await fn();}catch(e){message(String(e.message||e));}finally{busy=false;controls();}}
 async function clock(type){await run(async()=>{
  if(uncertain)throw Error('上一筆結果不明，請先重新整理核對，不能再送出。');
  await policy();if(type==='上班'&&!$('shiftBox').hidden)state.select($('shift').value);
  const id='QA_SHIFT_'+Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  const original=state.prepare(type,id);message('正在定位，尚未送出…');
  let gps;try{gps=await api.gps();}catch(e){state.clearUnwritten(id);throw Error('定位未完成，尚未送出打卡。');}
  savePending(original);message('正在送出隔離測試，請勿重複點擊。');
  let reply;try{reply=await api.call('GPS_CLOCK',{...original,...gps});}catch(e){throw Error('結果尚未確認，請重新整理核對，暫勿重送。');}
  if(!reply.ok){if(reply.persisted===false){state.clearUnwritten(id);savePending(null);await policy();}throw Error('未確認成功：'+String(reply.code||'UNKNOWN')+'；請先核對原筆。');}
  state.settle(reply.request);savePending(null);message('隔離測試已保存：'+type+' '+reply.request.time);await policy();
 });}
 $('login').onclick=()=>run(async()=>{await api.login();await policy();message(uncertain?'上一筆結果未確認，請重新整理核對。':'隔離登入及選班規則已確認。');});
 $('clockIn').onclick=()=>clock('上班');$('clockOut').onclick=()=>clock('下班');
 $('refresh').onclick=()=>run(async()=>{
  if(uncertain){const r=await api.call('GPS_STATUS',{requestId:uncertain.requestId,type:uncertain.type});if(!r.ok||!r.request||r.request.requestId!==uncertain.requestId||r.request.type!==uncertain.type||uncertain.shiftCode&&r.request.shiftCode!==uncertain.shiftCode)throw Error('原筆仍未確認，保留編號，暫勿重送。');if(state.original())state.settle(r.request);savePending(null);}
  await policy();const r=await api.call('MY_CLOCKS',{});if(!r.ok)throw Error('紀錄查詢未完成。');$('records').replaceChildren();for(const day of r.days){const p=document.createElement('p');p.textContent=day.date+'｜'+(day.clockIn||'—')+'｜'+(day.clockOut||'—');$('records').append(p);}message('隔離當月紀錄已更新。');
 });
 if(!api||api.scope!=='TEST001/TEST_CO'||api.enabled!==true){message('隔離畫面已準備；登入與服務接線未啟用，所有送件關閉。');return;}
 ready=true;controls();
})();
