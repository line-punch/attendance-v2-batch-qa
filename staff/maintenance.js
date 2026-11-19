/* Administrator attendance maintenance. Personal data comes only from authorized server reads. */
window.startAttendanceMaintenance=async function(){
 'use strict';
 const $=id=>document.getElementById(id),root=$('maintenancePage');
 document.title='YC/YT員工系統｜管理者出勤維護';document.body.classList.add('maintenanceMode');root.hidden=false;
 document.querySelectorAll('main > :not(#maintenancePage)').forEach(el=>el.hidden=true);
 let token='',access=null,base=null,draft=null,proof=null,busy=false,pending=null;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 $('maintDate').max=today;$('maintDate').value=today;
 try{pending=JSON.parse(sessionStorage.getItem('yc-maint-pending')||'null');}catch(_){}
 function tell(message,phase='info'){$('maintFeedback').textContent=message;$('maintFeedback').dataset.phase=phase;}
 function clearPreview(){proof=null;$('maintPreview').hidden=true;$('maintSave').hidden=true;}
 function id(){return 'V2_MTX_'+Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');}
 function el(tag,text,props={}){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;Object.assign(e,props);return e;}
 function typeSelect(value){const s=el('select',undefined);for(const v of ['上班','中途離開','返回','下班'])s.add(el('option',v==='返回'?'中途返回':v,{value:v}));s.value=value;return s;}
 function readPending(){try{sessionStorage.setItem('yc-maint-pending',JSON.stringify(pending));}catch(_){}$('maintCheck').hidden=!pending;}
 function forgetPending(){pending=null;try{sessionStorage.removeItem('yc-maint-pending');}catch(_){}$('maintCheck').hidden=true;}
 async function post(operation,args){
  if(!token)throw new Error('請先確認 LINE 登入。');
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(20)),b=>b.toString(16).padStart(2,'0')).join('');
  return new Promise((resolve,reject)=>{
   const frame=el('iframe',undefined,{name:'maint_'+nonce,hidden:true}),form=el('form',undefined,{method:'POST',action:window.V2_QA_ENDPOINT,target:frame.name,hidden:true});
   for(const [name,value] of Object.entries({candidateRoute:'staff-v1',nonce,operation,payload:JSON.stringify({idToken:token,args})}))form.append(el('input',undefined,{name,value}));
   let timer;
   const done=(err,data)=>{clearTimeout(timer);removeEventListener('message',receive);form.remove();frame.remove();err?reject(err):resolve(data);};
   const receive=event=>{if(!/^https:\/\/([a-z0-9-]+\.)?(script\.google\.com|googleusercontent\.com)$/.test(event.origin)||event.data?.bridge!=='YC_V2_STAFF_V1'||event.data.nonce!==nonce)return;
    if(event.data.ok&&event.data.result?.ok)done(null,event.data.result);else done(new Error(message(event.data.code,event.data.reason)));
   };
   addEventListener('message',receive);timer=setTimeout(()=>done(new Error(operation==='MAINT_COMMIT'?'保存結果尚未確認，請按「查核上次保存結果」，不要重新建立補登。':'連線逾時，請稍後再試。')),45000);
   document.body.append(frame,form);form.submit();
  });
 }
 function message(code,reason){return ({MAINT_ADMIN_REQUIRED:'目前這個 LINE 帳號尚未取得出勤維護權限。請由系統負責人設定專用管理者。',MAINT_AUTH:'無法核對登入身分，請重新登入。',MAINT_STALE:'原始資料已更新，請重新查詢並預覽。',MAINT_PREVIEW_REQUIRED:'預覽已失效，請重新預覽。',MAINT_REASON:'請填寫至少3字的更正原因。',MAINT_START_REQUIRED:'缺少上班紀錄，請先補齊上班時間。',MAINT_RETURN_ORDER:'沒有相對應的中途離開，不能補登中途返回。',MAINT_LEAVE_ORDER:'中途離開的前一筆必須是上班或中途返回。',MAINT_DUPLICATE_IN:'同一天只能有一筆有效上班。',MAINT_AFTER_END:'下班後不能再有當日出勤，請核對順序。',MAINT_SAME_TIME:'有兩筆出勤時間相同，請核對。',MAINT_FUTURE_TIME:'不能補登尚未發生的未來時間。',MAINT_DAY:'請選擇今天或以前的有效日期。',MAINT_EMPTY_DAY:'至少保留一筆有效出勤紀錄。',MAINT_DISABLED:'出勤維護尚未啟用。',MAINT_ID_CONFLICT:'這個保存編號已有不同內容，請先查核上次結果。',MAINT_SAVE_UNKNOWN:'保存結果尚未確認，請查核上次保存結果。'})[reason||code]||'目前無法完成操作，請稍後重試；保存後結果不明時請先查核。';}
 async function run(button,fn){if(busy)return;busy=true;const old=button.textContent;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='處理中…';root.querySelectorAll('input,select,textarea').forEach(e=>e.disabled=true);try{await fn();}catch(e){tell(e.message,'error');}finally{busy=false;button.disabled=false;button.removeAttribute('aria-busy');button.textContent=old;root.querySelectorAll('input,select,textarea').forEach(e=>e.disabled=!!pending);$('maintMakePreview').disabled=!!pending;}}
 function manualRow(m={type:'返回',time:''}){
  const row=el('div',undefined,{className:'maintManual'}),type=typeSelect(m.type),time=el('input',undefined,{type:'time',step:'60',value:m.time}),remove=el('button','移除',{type:'button'});
  type.setAttribute('aria-label','補登打卡類型');time.setAttribute('aria-label','補登時間');row.dataset.requestId=m.requestId||'';
  remove.onclick=()=>{if(busy||pending)return;row.remove();clearPreview();};row.append(type,time,el('span','管理者補登・精確至分鐘'),remove);$('maintManuals').append(row);
 }
 function render(day,suggest=false){
  base=day;draft=null;clearPreview();$('maintEditor').hidden=false;$('maintEmployee').value=day.employee.employeeId;$('maintDate').value=day.date;$('maintPerson').textContent=day.employee.company+'／'+day.employee.name+'／'+day.date;
  const tbody=$('maintOriginals');tbody.replaceChildren();
  for(const original of day.originals){
   const edit=day.edits.find(e=>e.requestId===original.requestId),value=edit||original,row=el('tr');row.dataset.requestId=original.requestId;
   const sel=typeSelect(value.type),time=el('input',undefined,{type:'time',step:'1',value:value.time}),voided=el('input',undefined,{type:'checkbox',checked:!!edit?.void});
   sel.setAttribute('aria-label','更正後打卡類型');time.setAttribute('aria-label','更正後時間');voided.setAttribute('aria-label','作廢此筆');
   if(suggest&&original.type==='下班')sel.value='中途離開';
   row.append(el('td',original.type+' '+original.time+'（'+original.source+'）'),el('td'),el('td'),el('td'));row.children[1].append(sel);row.children[2].append(time);row.children[3].append(voided);tbody.append(row);
  }
  if(!day.originals.length){const tr=el('tr');tr.append(el('td','當日沒有正常打卡紀錄。',{colSpan:4}));tbody.append(tr);}
  $('maintManuals').replaceChildren();for(const m of day.manuals)manualRow(m);
  $('maintReason').value='';
  if(suggest){for(const m of access.defaultCase.suggestion.manuals)manualRow(m);$('maintReason').value=access.defaultCase.suggestion.reason;}
  const apps=$('maintApplications');apps.replaceChildren();
  for(const a of day.applications){const b=a.body,status={APPROVED:'核准',PENDING:'待審核',REJECTED:'駁回'}[a.status]||a.status;apps.append(el('p',(a.kind==='LEAVE'?b.leaveType+' '+b.startDate+'～'+b.endDate+' '+(b.unit==='HOURS'?b.fromTime+'–'+b.toTime:'全天'):'員工補打卡 '+b.type+' '+b.time)+'｜'+status+'｜'+a.requestId));}
  if(!day.applications.length)apps.textContent='當日沒有查到請假或員工補打卡申請。';
  $('maintDuplicate').hidden=!day.duplicateLeave;
  $('maintMakePreview').disabled=!!pending;
  tell(suggest?'已帶入待更正內容，尚未保存。請核對原11點打卡秒數、補登時間及原因，再按預覽。':'已讀取當日紀錄，尚未修改。');
 }
 function form(){
  if(!base)throw new Error('請先查詢員工及日期。');
  if($('maintEmployee').value!==base.employee.employeeId||$('maintDate').value!==base.date)throw new Error('員工或日期已改變，請重新查詢。');
  return {employeeId:base.employee.employeeId,date:base.date,revision:base.revision,requestId:draft?.requestId||id(),reason:$('maintReason').value,edits:[...$('maintOriginals').querySelectorAll('tr[data-request-id]')].map(r=>({requestId:r.dataset.requestId,type:r.querySelector('select').value,time:(r.querySelector('input[type=time]').value.length===5?r.querySelector('input[type=time]').value+':00':r.querySelector('input[type=time]').value),void:r.querySelector('input[type=checkbox]').checked})),manuals:[...$('maintManuals').children].map(r=>({requestId:r.dataset.requestId,type:r.querySelector('select').value,time:r.querySelector('input[type=time]').value}))};
 }
 async function load(id,date,suggest=false){const result=await post('MAINT_QUERY',{employeeId:id,date});render(result.day,suggest&&result.day.version===0);}
 $('maintLogin').onclick=()=>run($('maintLogin'),async()=>{await login();});
 async function login(){
  tell('正在核對 LINE 登入與管理者權限…','busy');await liff.init({liffId:window.V2_QA_LIFF_ID});
  if(!liff.isLoggedIn()){liff.login({redirectUri:location.href});return;}
  token=liff.getIDToken()||'';access=await post('MAINT_ACCESS',{});$('maintIdentity').textContent='管理者：'+access.actor.name;$('maintControls').hidden=false;
  const select=$('maintEmployee');select.replaceChildren();for(const employee of access.employees)select.add(el('option',employee.company+'／'+employee.name,{value:employee.employeeId}));
  readPending();if(pending){tell('有一筆上次保存結果待查核，請先查核，不要重建補登。','error');return;}
  if(access.defaultCase)await load(access.defaultCase.employeeId,access.defaultCase.date,true);else tell('權限核對完成，請選擇員工與日期查詢。','success');
 }
 $('maintQuery').onclick=()=>run($('maintQuery'),async()=>{if(pending)throw new Error('請先查核上次保存結果。');await load($('maintEmployee').value,$('maintDate').value);});
 $('maintAdd').onclick=()=>{if(busy||pending)return;manualRow();clearPreview();};
 $('maintEditor').addEventListener('input',()=>{if(!busy)clearPreview();});
 $('maintEmployee').onchange=$('maintDate').onchange=()=>{clearPreview();$('maintEditor').hidden=true;base=null;};
 $('maintMakePreview').onclick=()=>run($('maintMakePreview'),async()=>{
  if(pending)throw new Error('請先查核上次保存結果。');draft=form();tell('正在核對更正後出勤順序…','busy');const result=await post('MAINT_PREVIEW',draft);proof=result.preview;
  const view=$('maintPreview');view.replaceChildren(el('h3','保存前核對'));
  for(const r of result.sequence)view.append(el('p',r.time+(r.origin==='ADMIN'?'（分鐘補登）':'')+'　'+(r.type==='返回'?'中途返回':r.type)+'　'+({NORMAL:'正常卡／更正結果',ADMIN:'管理者補登',APPROVED_MISSING:'已核准員工補卡'})[r.origin]));
  view.append(el('p','更正原因：'+draft.reason));for(const w of result.warnings)view.append(el('p',w,{className:'note'}));
  view.append(el('p','正常卡更正寫入「打卡紀錄」；補登寫入「補打卡申請」（核准）；請假單維持原狀。原卡及修改前後另留操作紀錄。'));
  view.hidden=false;$('maintSave').hidden=false;tell('預覽完成，尚未保存。請確認後再按「確認保存更正」。','success');
 });
 $('maintSave').onclick=()=>run($('maintSave'),async()=>{
  if(!draft||!proof)throw new Error('請先重新預覽。');
  pending={requestId:draft.requestId,employeeId:draft.employeeId,date:draft.date};readPending();$('maintMakePreview').disabled=true;
  tell('正在保存更正，請等待結果…','busy');const result=await post('MAINT_COMMIT',{...draft,preview:proof});
  if(result.saved&&result.exportProjection==='CURRENT'){forgetPending();clearPreview();await load(draft.employeeId,draft.date);tell('更正已保存，打卡紀錄與補打卡申請已同步。保存編號：'+result.receipt,'success');}
  else {clearPreview();tell('操作紀錄已保存，匯入表同步尚未完成。請按「查核上次保存結果」，完成同步後再下載資料。','error');}
 });
 $('maintCheck').onclick=()=>run($('maintCheck'),async()=>{
  if(!pending)return;const result=await post('MAINT_STATUS',pending);
  if(result.saved){forgetPending();clearPreview();render(result.day);tell('已確認保存成功，匯入表已同步。保存編號：'+result.receipt,'success');}
  else {tell('目前尚未查到這筆保存。請稍後再次查核；若要重送，請保留同一預覽與保存編號。','error');if(draft&&proof)$('maintSave').hidden=false;}
 });
 await run($('maintLogin'),login);
};
