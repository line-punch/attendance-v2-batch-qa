/* Administrator attendance maintenance. Personal data comes only from authorized server reads. */
window.startAttendanceMaintenance=async function(){
 'use strict';
 const $=id=>document.getElementById(id),root=$('maintenancePage');
 document.title='YC/YT員工系統｜管理者維護';document.body.classList.add('maintenanceMode');root.hidden=false;
 document.querySelectorAll('main > :not(#maintenancePage)').forEach(el=>el.hidden=true);
 let token='',access=null,base=null,draft=null,proof=null,busy=false,pending=null,completed=false,savedMark=null,newEditSession=false,mode='CLOCK',leaveBase=null,leaveDraft=null,leaveProof=null,needsLoginRefresh=false,liffReady=null,addBase=null,addDraft=null,addProof=null;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 $('maintDate').max=today;$('maintDate').value=today;
 try{pending=JSON.parse(sessionStorage.getItem('yc-maint-live-pending')||'null');savedMark=JSON.parse(sessionStorage.getItem('yc-maint-live-completed')||'null');}catch(_){}
 if(savedMark&&(!/^[A-Za-z0-9_-]{2,40}$/.test(savedMark.employeeId||'')||!/^\d{4}-\d{2}-\d{2}$/.test(savedMark.date||'')))savedMark=null;
 function tell(message,phase='info'){$('maintFeedback').textContent=message;$('maintFeedback').dataset.phase=phase;$('maintFeedback').hidden=!message.trim();}
 function clearPreview(){proof=null;leaveProof=null;addProof=null;$('maintAddPreview').hidden=true;$('maintAddSave').hidden=true;$('maintLeavePreview').hidden=true;$('maintLeaveSave').hidden=true;$('maintPreview').hidden=true;$('maintSave').hidden=true;}
 function id(prefix='V2_MTX_'){return prefix+Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');}
 function el(tag,text,props={}){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;Object.assign(e,props);return e;}
 function typeSelect(value){const s=el('select',undefined);for(const v of ['上班','中途離開','返回','下班'])s.add(el('option',v==='返回'?'中途返回':v,{value:v}));s.value=value;return s;}
 function readPending(){try{sessionStorage.setItem('yc-maint-live-pending',JSON.stringify(pending));}catch(_){}$('maintCheck').hidden=!pending;}
 function forgetPending(){pending=null;try{sessionStorage.removeItem('yc-maint-live-pending');}catch(_){}$('maintCheck').hidden=true;}
 async function post(operation,args){
  if(!token)throw new Error('請先確認 LINE 登入。');
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(20)),b=>b.toString(16).padStart(2,'0')).join('');
  return new Promise((resolve,reject)=>{
   const frame=el('iframe',undefined,{name:'maint_'+nonce,hidden:true}),form=el('form',undefined,{method:'POST',action:window.V2_MAINT_ENDPOINT||'https://script.google.com/macros/s/AKfycbyIzGPyg4jLlVz0B8mKALa6wiuMHwkq022YuRw1WzzQspFBsOhUEfOV2sgONhIB4Ig/exec',target:frame.name,hidden:true});
   for(const [name,value] of Object.entries({candidateRoute:'staff-v1',nonce,operation,payload:JSON.stringify({idToken:token,args})}))form.append(el('input',undefined,{name,value}));
   let timer;
   const done=(err,data)=>{clearTimeout(timer);removeEventListener('message',receive);form.remove();frame.remove();err?reject(err):resolve(data);};
   const receive=event=>{if(!/^https:\/\/([a-z0-9-]+\.)?(script\.google\.com|googleusercontent\.com)$/.test(event.origin)||event.data?.bridge!=='YC_V2_STAFF_V1'||event.data.nonce!==nonce)return;
    if(event.data.ok&&event.data.result?.ok)done(null,event.data.result);else {const error=new Error(message(event.data.code,event.data.reason,operation));error.code=event.data.reason||event.data.code;error.operation=operation;done(error);}
   };
   addEventListener('message',receive);timer=setTimeout(()=>done(new Error(['MAINT_COMMIT','MAINT_LEAVE_COMMIT','MAINT_ADD_COMMIT'].includes(operation)?'保存結果尚未確認，請按「查核上次保存結果」，不要重新建立補登。':'連線逾時，請稍後再試。')),45000);
   document.body.append(frame,form);form.submit();
  });
 }
 function message(code,reason,operation){const errorCode=reason||code;const label=operation==='MAINT_ACCESS'?'登入與管理者權限核對':operation.endsWith('_QUERY')?'紀錄查詢':operation.endsWith('_PREVIEW')?'預覽核對':operation.endsWith('_STATUS')?'保存結果查核':'保存';const known=({MAINT_ADD_DISABLED:'請假補登尚未開放。',MAINT_ADD_FORM:'請核對員工、日期、假別及紙本核准確認。',MAINT_ADD_REASON:'請填至少3字的實際原因，系統會自動附加管理者補登。',MAINT_ADD_FUTURE:'管理者補登僅可填今天或以前的日期。',MAINT_ADD_HOURS:'請選08:30～17:30之間的整點或半點，指定時數限單日且結束須晚於開始。',MAINT_ADD_CONFLICT:'此時段已有待審或核准假單，請先核對既有假單，不可重複補登。',MAINT_ADD_STALE:'既有假單或員工資料已更新，請重新預覽。',MAINT_ADD_PREVIEW_REQUIRED:'補登預覽已失效，請重新預覽。',MAINT_ADD_ID_CONFLICT:'這筆補登編號已有不同內容，請先查核原保存結果。',MAINT_ADD_AUDIT_INVALID:'請假補登操作紀錄無法核對，請聯絡系統負責人。',MAINT_ADD_EMPLOYEE:'查不到這位員工，請重新登入後選擇。',MAINT_READ_ONLY:'維護保存尚未啟用，目前可先查詢及預覽。',MAINT_BINDING:'LINE 驗證已通過，但這個帳號沒有對應到有效員工綁定。請確認目前使用的是已授權管理者所綁定的 LINE 帳號；重新登入不會自動新增綁定。',MAINT_AUTH_SERVICE:'LINE 驗證服務未完成回應，請稍後重試；目前未確認為憑證過期。',MAINT_AUTH_CONFIG:'LINE 憑證與服務設定無法核對，請交由系統負責人檢查，暫時不要反覆重新登入。',MAINT_ADMIN_REQUIRED:'目前這個 LINE 帳號尚未取得出勤維護權限。請由系統負責人設定專用管理者。',MAINT_LEAVE_FORM:'請核對保留單、作廢單與至少3字的作廢原因。',MAINT_LEAVE_STALE:'假單已更新，請重新查詢後預覽。',MAINT_LEAVE_PAIR:'請選擇同一員工的兩張不同假單。',MAINT_LEAVE_STATUS:'只可作廢待審或核准的重複單，保留單必須已核准。',MAINT_LEAVE_NOT_DUPLICATE:'兩張假單的假別、日期或時段不同，不能視為重複單作廢。',MAINT_LEAVE_ALREADY_VOIDED:'此張假單已作廢，請重新查詢。',MAINT_LEAVE_PREVIEW_REQUIRED:'作廢預覽已失效，請重新預覽。',MAINT_LEAVE_ID_CONFLICT:'這筆保存編號已有不同內容，請先查核上次結果。',MAINT_LEAVE_AUDIT_INVALID:'作廢紀錄無法核對，請聯絡系統負責人。',MAINT_LEAVE_DISABLED:'請假作廢功能尚未開放。',MAINT_AUTH:'LINE 登入驗證未通過。請再按「確認 LINE 登入」更新登入；若顯示需要關閉視窗，請按提示重新開啟。尚未進行任何維護保存。',MAINT_STALE:'原始資料已更新，請重新查詢並預覽。',MAINT_PREVIEW_REQUIRED:'預覽已失效，請重新預覽。',MAINT_REASON:'請填寫至少3字的更正原因。',MAINT_START_REQUIRED:'缺少上班紀錄，請先補齊上班時間。',MAINT_RETURN_REQUIRED:'中途離開後缺少返回，請先核對並補齊，才能保存下班。',MAINT_RETURN_ORDER:'沒有相對應的中途離開，不能補登中途返回。',MAINT_LEAVE_ORDER:'中途離開的前一筆必須是上班或中途返回。',MAINT_DUPLICATE_IN:'同一天只能有一筆有效上班。',MAINT_AFTER_END:'下班後不能再有當日出勤，請核對順序。',MAINT_SAME_TIME:'有兩筆出勤時間相同，請核對。',MAINT_FUTURE_TIME:'不能補登尚未發生的未來時間。',MAINT_DAY:'請選擇今天或以前的有效日期。',MAINT_EMPTY_DAY:'至少保留一筆有效出勤紀錄。',MAINT_DISABLED:'出勤維護尚未啟用。',MAINT_ID_CONFLICT:'這個保存編號已有不同內容，請先查核上次結果。',MAINT_SAVE_UNKNOWN:'保存結果尚未確認，請查核上次保存結果。'})[errorCode];if(known)return known;const reference=/^[A-Z][A-Z0-9_]{1,60}$/.test(errorCode||'')?'（'+errorCode+'）':'';return label+'未完成'+reference+'。'+(operation==='MAINT_ACCESS'?'請重新確認 LINE 登入；尚未進行任何維護保存。':['MAINT_COMMIT','MAINT_LEAVE_COMMIT','MAINT_ADD_COMMIT'].includes(operation)?'結果尚未確認，請先查核上次保存結果，不要重新送出。':'請稍後重新操作；尚未進行新的保存。');}
 function applyControls(){
  const locked=busy||!!pending||completed;
  root.querySelectorAll('input,select,textarea').forEach(e=>e.disabled=locked||e.dataset.ineligible==='true');
  root.querySelectorAll('button').forEach(e=>e.disabled=locked);
  $('maintLogin').disabled=busy||completed;
  $('maintCheck').disabled=busy||completed||!pending||!token;
  $('maintNew').hidden=!completed;$('maintNew').disabled=busy||!!pending||!completed;
  if(!locked){$('maintQuery').disabled=!access;$('maintAdd').disabled=!base;$('maintMakePreview').disabled=!base;$('maintLeaveMakePreview').disabled=!leaveBase;}
  if(access?.readOnly){$('maintSave').disabled=true;$('maintLeaveSave').disabled=true;$('maintAddSave').disabled=true;}
  if(completed){const saved=$(mode==='ADD'?'maintAddSave':mode==='LEAVE'?'maintLeaveSave':'maintSave');saved.hidden=false;saved.textContent='已保存';}
 }
 function completeSaved(reference,text){
  completed=true;newEditSession=false;proof=null;draft=null;savedMark=reference;
  try{sessionStorage.setItem('yc-maint-live-completed',JSON.stringify(reference));}catch(_){}
  clearPreview();tell(text,'success');applyControls();
 }
 function startAnother(){
  if(busy||pending||!completed)return;
  completed=false;newEditSession=true;savedMark=null;addBase=null;addDraft=null;addProof=null;initAddFields();$('maintAddEditor').hidden=true;$('maintAddHistory').replaceChildren();$('maintAddSaved').textContent='';$('maintAddSave').textContent='確認保存請假補登';base=null;draft=null;proof=null;leaveBase=null;leaveDraft=null;leaveProof=null;
  try{sessionStorage.removeItem('yc-maint-live-completed');}catch(_){}
  $('maintEditor').hidden=true;$('maintOriginals').replaceChildren();$('maintManuals').replaceChildren();$('maintApplications').replaceChildren();$('maintReason').value='';$('maintPerson').textContent='';
  $('maintLeaveEditor').hidden=true;$('maintLeaveRows').replaceChildren();$('maintLeaveReason').value='';$('maintLeaveSave').textContent='確認作廢重複申請';$('maintEmployee').selectedIndex=-1;$('maintDate').value='';clearPreview();$('maintSave').textContent='確認保存更正';tell('');applyControls();
 }
 async function run(button,fn){
  if(busy||completed)return;
  busy=true;const old=button.textContent;button.setAttribute('aria-busy','true');button.textContent='處理中…';applyControls();
  try{await fn();}catch(e){if(e.code==='MAINT_AUTH'||e.code==='STAFF_AUTH'){needsLoginRefresh=true;token='';access=null;$('maintIdentity').textContent='';$('maintControls').hidden=true;}tell(e.message,'error');}
  finally{busy=false;button.removeAttribute('aria-busy');button.textContent=old;applyControls();}
 }
 $('maintNew').onclick=startAnother;

 function manualRow(m={type:'返回',time:''}){
  const row=el('div',undefined,{className:'maintManual'}),type=typeSelect(m.type),time=el('input',undefined,{type:'time',step:'60',value:m.time}),remove=el('button','移除',{type:'button'});
  type.setAttribute('aria-label','補登打卡類型');time.setAttribute('aria-label','補登時間');row.dataset.requestId=m.requestId||'';
  remove.onclick=()=>{if(busy||pending||completed)return;row.remove();clearPreview();};row.append(type,time,el('span','管理者補登・精確至分鐘'),remove);$('maintManuals').append(row);
 }
 function render(day,suggest=false){
  base=day;draft=null;clearPreview();$('maintEditor').hidden=false;$('maintEmployee').value=day.employee.employeeId;$('maintDate').value=day.date;$('maintPerson').textContent=day.employee.company+'／'+day.employee.name+'／'+day.date;
  const tbody=$('maintOriginals');tbody.replaceChildren();
  for(const original of day.originals){
   const edit=day.edits.find(e=>e.requestId===original.requestId),value=edit||original,row=el('tr');row.dataset.requestId=original.requestId;
   const sel=typeSelect(value.type),time=el('input',undefined,{type:'time',step:'1',value:value.time}),voided=el('input',undefined,{type:'checkbox',checked:!!edit?.void});
   sel.setAttribute('aria-label','更正後打卡類型');time.setAttribute('aria-label','更正後時間');voided.setAttribute('aria-label','作廢此筆');
   if(suggest&&access.defaultCase.suggestion.outToLeave&&original.type==='下班')sel.value='中途離開';if(suggest&&access.defaultCase.suggestion.voidRequestIds?.includes(original.requestId))voided.checked=true;
   row.append(el('td',original.type+' '+original.time+'（'+original.source+'）'),el('td'),el('td'),el('td'));row.children[1].append(sel);row.children[2].append(time);row.children[3].append(voided);tbody.append(row);
  }
  if(!day.originals.length){const tr=el('tr');tr.append(el('td','當日沒有正常打卡紀錄。',{colSpan:4}));tbody.append(tr);}
  $('maintManuals').replaceChildren();for(const m of day.manuals)manualRow(m);
  $('maintReason').value='';
  if(suggest){for(const m of access.defaultCase.suggestion.manuals)manualRow(m);$('maintReason').value=access.defaultCase.suggestion.reason;}
  const apps=$('maintApplications');apps.replaceChildren();
  for(const a of day.applications){const b=a.body,status={APPROVED:'核准',PENDING:'待審核',REJECTED:'駁回',VOIDED:'作廢'}[a.status]||a.status;apps.append(el('p',(a.kind==='LEAVE'?b.leaveType+' '+b.startDate+'～'+b.endDate+' '+(b.unit==='HOURS'?b.fromTime+'–'+b.toTime:'全天'):'員工補打卡 '+b.type+' '+b.time)+'｜'+status+'｜'+a.requestId));}
  if(!day.applications.length)apps.textContent='當日沒有查到請假或員工補打卡申請。';
  $('maintDuplicate').hidden=!day.duplicateLeave;
  $('maintMakePreview').disabled=!!pending;
  tell(suggest?'已帶入待更正內容，尚未保存。請核對打卡、補登時間及更正原因，再按預覽。':'已讀取當日紀錄，尚未修改。');
 }
 function form(){
  if(!base)throw new Error('請先查詢員工及日期。');
  if($('maintEmployee').value!==base.employee.employeeId||$('maintDate').value!==base.date)throw new Error('員工或日期已改變，請重新查詢。');
  return {employeeId:base.employee.employeeId,date:base.date,revision:base.revision,requestId:draft?.requestId||id(),reason:$('maintReason').value,edits:[...$('maintOriginals').querySelectorAll('tr[data-request-id]')].map(r=>({requestId:r.dataset.requestId,type:r.querySelector('select').value,time:(r.querySelector('input[type=time]').value.length===5?r.querySelector('input[type=time]').value+':00':r.querySelector('input[type=time]').value),void:r.querySelector('input[type=checkbox]').checked})),manuals:[...$('maintManuals').children].map(r=>({requestId:r.dataset.requestId,type:r.querySelector('select').value,time:r.querySelector('input[type=time]').value}))};
 }
 async function load(id,date,suggest=false){
  const result=await post('MAINT_QUERY',{employeeId:id,date});render(result.day,suggest&&result.day.version===0);
  if(result.day.version>0&&!newEditSession)completeSaved({employeeId:id,date,requestId:savedMark?.requestId||''},'此日期的更正已保存，畫面已鎖定。若要開始新的維護，請按「開始另一筆維護」。');
  return result.day;
 }
 $('maintLogin').onclick=()=>run($('maintLogin'),async()=>{await login(true);});
 async function login(interactive=false){
  tell('正在核對 LINE 登入與管理者權限…','busy');await ensureLiff();
  const inClient=typeof liff.isInClient==='function'&&liff.isInClient();
  const logged=liff.isLoggedIn(),candidate=logged?liff.getIDToken()||'':'';
  let decoded=null;try{decoded=logged&&typeof liff.getDecodedIDToken==='function'?liff.getDecodedIDToken():null;}catch(_){}
  // Local expiration is a renewal hint only. The server still verifies the raw ID token.
  const exp=decoded&&Number(decoded.exp),expired=Number.isFinite(exp)&&exp<=Date.now()/1000+30;
  if(needsLoginRefresh||!logged||!candidate||expired){
   token='';access=null;$('maintControls').hidden=true;
   if(inClient){needsLoginRefresh=true;tell('目前 LINE 視窗的登入憑證無法使用。請按右上角「×」關閉整個視窗，再重新開啟管理者維護並按「確認 LINE 登入」。重新整理或重複按登入無法更新這個視窗的憑證；尚未保存任何維護資料。','error');return;}
   if(logged)liff.logout();needsLoginRefresh=false;
   tell('正在重新取得 LINE 登入憑證，請完成 LINE 登入後再按「確認 LINE 登入」。','busy');liff.login({redirectUri:location.href});return;
  }
  token=candidate;access=await post('MAINT_ACCESS',{});$('maintIdentity').textContent='管理者：'+access.actor.name;$('maintControls').hidden=false;
  const select=$('maintEmployee');select.replaceChildren();for(const employee of access.employees)select.add(el('option',employee.company+'／'+employee.name,{value:employee.employeeId}));
  $('maintCases').replaceChildren();$('maintLeaveMode').hidden=!access.leaveMaintenance;$('maintAddMode').hidden=!access.leaveSupplement;
  readPending();if(pending){tell('有一筆上次保存結果待查核，請先查核，不要重建補登。','error');return;}
  if(savedMark&&savedMark.kind==='ADD'){setMode('ADD');await loadAdd(true);}
  else if(savedMark){setMode(savedMark.kind==='LEAVE'?'LEAVE':'CLOCK');if(mode==='LEAVE')await loadLeave(savedMark.employeeId,savedMark.date,null,true);else await load(savedMark.employeeId,savedMark.date);}
  else if(access.leaveCase){setMode('LEAVE');await loadLeave(access.leaveCase.employeeId,access.leaveCase.date,access.leaveCase);}
  else tell('權限核對完成，請選擇維護項目、員工與日期查詢。','success');
 }
 $('maintQuery').onclick=()=>run($('maintQuery'),async()=>{if(pending)throw new Error('請先查核上次保存結果。');if(mode==='ADD')await loadAdd();else if(mode==='LEAVE')await loadLeave($('maintEmployee').value,$('maintDate').value);else await load($('maintEmployee').value,$('maintDate').value);});
 $('maintAdd').onclick=()=>{if(busy||pending||completed)return;manualRow();clearPreview();};
 $('maintEditor').addEventListener('input',()=>{if(!busy&&!completed&&!pending)clearPreview();});
 $('maintEmployee').onchange=$('maintDate').onchange=()=>{addBase=null;clearPreview();$('maintEditor').hidden=true;$('maintLeaveEditor').hidden=true;base=null;leaveBase=null;};
 $('maintMakePreview').onclick=()=>run($('maintMakePreview'),async()=>{
  if(pending)throw new Error('請先查核上次保存結果。');draft=form();tell('正在核對更正後出勤順序…','busy');const result=await post('MAINT_PREVIEW',draft);proof=result.preview;
  const view=$('maintPreview');view.replaceChildren(el('h3','保存前核對'));
  for(const r of result.sequence)view.append(el('p',(r.origin==='NORMAL'?r.time:r.time.slice(0,5))+(r.origin==='ADMIN'?'（分鐘補登）':'')+'　'+(r.type==='返回'?'中途返回':r.type)+'　'+({NORMAL:'正常卡／更正結果',ADMIN:'管理者補登',APPROVED_MISSING:'已核准員工補卡'})[r.origin]));
  view.append(el('p','更正原因：'+draft.reason));for(const w of result.warnings)view.append(el('p',w,{className:'note'}));
  view.append(el('p','正常卡更正寫入「打卡紀錄」；補登寫入「補打卡申請」（核准）；請假單維持原狀。原卡及修改前後另留操作紀錄。'));
  view.hidden=false;$('maintSave').hidden=false;tell('預覽完成，尚未保存。請確認後再按「確認保存更正」。','success');
 });
 $('maintSave').onclick=()=>run($('maintSave'),async()=>{
  if(access?.readOnly)throw Error('維護保存目前尚未開放。');if(completed||!draft||!proof)throw new Error('請先重新預覽。');
  pending={requestId:draft.requestId,employeeId:draft.employeeId,date:draft.date};readPending();$('maintMakePreview').disabled=true;
  tell('正在保存更正，請等待結果…','busy');const result=await post('MAINT_COMMIT',{...draft,preview:proof});
  if(result.saved&&result.exportProjection==='CURRENT'){const reference={...pending,requestId:result.receipt};forgetPending();completeSaved(reference,'更正已保存，打卡紀錄與補打卡申請已同步。畫面已鎖定。保存編號：'+result.receipt);}
  else {clearPreview();tell('操作紀錄已保存，匯入表同步尚未完成。請按「查核上次保存結果」，完成同步後再下載資料。','error');}
 });
 $('maintCheck').onclick=()=>run($('maintCheck'),async()=>{
  if(!pending)return;if(pending.kind==='ADD'){await checkAdd();return;}const leave=pending.kind==='LEAVE';const args=leave?{requestId:pending.requestId}:{requestId:pending.requestId,employeeId:pending.employeeId,date:pending.date};const result=await post(leave?'MAINT_LEAVE_STATUS':'MAINT_STATUS',args);
  if(result.saved&&result.exportProjection==='CURRENT'){const reference={...pending,requestId:result.receipt};forgetPending();if(leave){setMode('LEAVE');renderLeave(result.day);}else render(result.day);completeSaved(reference,'已確認保存成功，匯入表已同步。畫面已鎖定。保存編號：'+result.receipt);}
  else if(result.saved){tell('操作紀錄已保存，匯入表仍待同步。請稍後再查核，完成前先不要下載。','error');}
  else {forgetPending();clearPreview();tell('目前未查到保存紀錄。可重新預覽後再送出；本頁會沿用原保存編號。','info');}
 });

 function setMode(next){
  mode=next;$('maintAddEditor').hidden=mode!=='ADD';$('maintDateLabel').hidden=mode==='ADD';$('maintQuery').textContent=mode==='ADD'?'查詢既有假單':'查詢當日紀錄';$('maintAddMode').setAttribute('aria-pressed',String(mode==='ADD'));$('maintDate').max=mode==='LEAVE'?'':today;
  $('maintClockMode').setAttribute('aria-pressed',String(mode==='CLOCK'));$('maintLeaveMode').setAttribute('aria-pressed',String(mode==='LEAVE'));
  $('maintScope').textContent=mode==='ADD'?'請假補登：核對紙本假單及核准結果後補登，立即更新請假申請，操作軌跡另外保存。':mode==='LEAVE'?'請假申請維護：目前提供重複申請作廢。保留同員工、同假別、同日期及時段的有效核准單，原申請及主管審核軌跡保留。':'出勤維護：更正正常卡及管理者補登。員工補打卡申請的個別維護，後續另行擴充。';
 }
 for(const [button,next] of [['maintClockMode','CLOCK'],['maintLeaveMode','LEAVE'],['maintAddMode','ADD']])$(button).onclick=()=>{
  if(busy||pending||completed)return;setMode(next);addBase=null;addDraft=null;base=null;leaveBase=null;draft=null;leaveDraft=null;clearPreview();$('maintEditor').hidden=true;$('maintLeaveEditor').hidden=true;tell('請選擇員工與日期，再按查詢。');applyControls();
 };
 const statusText=s=>({APPROVED:'核准',PENDING:'待審核',REJECTED:'駁回',VOIDED:'作廢'})[s]||s;
 function period(row){const b=row.body;return b.leaveType+'｜'+b.startDate+'～'+b.endDate+'｜'+(b.unit==='HOURS'?b.fromTime+'–'+b.toTime:'全天');}
 function renderLeave(day,preset=null){
  leaveBase=day;leaveDraft=null;clearPreview();$('maintEditor').hidden=true;$('maintLeaveEditor').hidden=false;$('maintEmployee').value=day.employee.employeeId;$('maintDate').value=day.date;
  $('maintLeavePerson').textContent=day.employee.company+'／'+day.employee.name+'／'+day.date;
  const rows=$('maintLeaveRows');rows.replaceChildren();
  for(const item of day.rows){
   const row=el('tr'),keep=el('input',undefined,{type:'radio',name:'leaveKeep',value:item.requestId,checked:preset?.keepId===item.requestId}),target=el('input',undefined,{type:'radio',name:'leaveTarget',value:item.requestId,checked:preset?.targetId===item.requestId});
   keep.dataset.ineligible=String(!item.voidable||item.status!=='APPROVED');target.dataset.ineligible=String(!item.voidable||!['PENDING','APPROVED'].includes(item.status));keep.disabled=keep.dataset.ineligible==='true';target.disabled=target.dataset.ineligible==='true';
   keep.setAttribute('aria-label','保留 '+item.requestId);target.setAttribute('aria-label','作廢 '+item.requestId);
   const detail=el('td');detail.append(el('strong',period(item)),el('p','送件：'+item.submittedAt),el('p',item.requestId,{className:'small'}));
   const state=el('td',statusText(item.status));if(item.originalReviewerName)state.append(el('p','原審核：'+item.originalReviewerName+'／'+item.originalReviewedAt,{className:'small'}));
   if(item.status==='VOIDED')state.append(el('p','作廢原因：'+item.voidReason),el('p','保留：'+item.retainedRequestId,{className:'small'}));
   row.append(detail,state,el('td'),el('td'));row.children[2].append(keep);row.children[3].append(target);rows.append(row);
  }
  if(!day.rows.length){const row=el('tr');row.append(el('td','這一天沒有查到新系統的請假申請。',{colSpan:4}));rows.append(row);}
  $('maintLeaveReason').value=preset?.reason||'';
  tell(preset?'已帶入重複請假單供核對，尚未作廢。請確認保留單、作廢單及原因，再按預覽。':'已讀取請假申請，尚未修改。');applyControls();
 }
 async function loadLeave(employeeId,date,preset=null,restore=false){
  const result=await post('MAINT_LEAVE_QUERY',{employeeId,date});renderLeave(result.day,preset);
  if(restore)completeSaved({...savedMark,kind:'LEAVE'},'此筆維護已保存，畫面已鎖定。若要處理另一筆，請按「開始另一筆維護」。');
  return result.day;
 }
 function leaveForm(){
  if(!leaveBase||$('maintEmployee').value!==leaveBase.employee.employeeId||$('maintDate').value!==leaveBase.date)throw Error('員工或日期已改變，請重新查詢。');
  const radios=[...$('maintLeaveRows').querySelectorAll('input')],keep=radios.find(r=>r.name==='leaveKeep'&&r.checked),target=radios.find(r=>r.name==='leaveTarget'&&r.checked);
  if(!keep||!target)throw Error('請選擇要保留的核准單，以及要作廢的重複單。');
  if(keep.value===target.value)throw Error('保留單與作廢單必須是不同申請。');
  return {requestId:leaveDraft?.requestId||id('V2_AVOID_'),employeeId:leaveBase.employee.employeeId,date:leaveBase.date,revision:leaveBase.revision,keepId:keep.value,targetId:target.value,reason:$('maintLeaveReason').value};
 }
 $('maintLeaveEditor').addEventListener('input',()=>{if(!busy&&!pending&&!completed)clearPreview();});
 $('maintLeaveMakePreview').onclick=()=>run($('maintLeaveMakePreview'),async()=>{
  leaveDraft=leaveForm();tell('正在核對重複請假單，尚未作廢…','busy');const result=await post('MAINT_LEAVE_PREVIEW',leaveDraft);leaveProof=result.preview;
  const view=$('maintLeavePreview');view.replaceChildren(el('h3','作廢前核對'),el('p','保留：'+period(result.keep)),el('p',result.keep.requestId),el('p','作廢：'+period(result.target)+'（原狀態：'+statusText(result.target.status)+'）'),el('p',result.target.requestId),el('p','原因：'+leaveDraft.reason),el('p','確認後，「請假申請」會標示作廢並保留原主管審核資料，另新增一筆「請假作廢紀錄」。不會傳送新的請假或主管通知。'));
  view.hidden=false;$('maintLeaveSave').hidden=false;tell('預覽完成，尚未作廢。請確認後再按「確認作廢重複申請」。','success');
 });
 $('maintLeaveSave').onclick=()=>run($('maintLeaveSave'),async()=>{
  if(access?.readOnly)throw Error('維護保存目前尚未開放。');if(!leaveDraft||!leaveProof)throw Error('請先重新預覽。');pending={kind:'LEAVE',requestId:leaveDraft.requestId,employeeId:leaveDraft.employeeId,date:leaveDraft.date};readPending();tell('正在保存作廢紀錄，請等待結果…','busy');
  const result=await post('MAINT_LEAVE_COMMIT',{...leaveDraft,preview:leaveProof});
  if(result.saved&&result.exportProjection==='CURRENT'){const reference={...pending,requestId:result.receipt};forgetPending();renderLeave(result.day);completeSaved(reference,'重複假單已作廢，「請假申請」已同步。原申請及審核紀錄保留，畫面已鎖定。保存編號：'+result.receipt);}
  else {clearPreview();tell('作廢紀錄已保存，匯入表同步尚未完成。請按「查核上次保存結果」，完成同步後再下載。','error');}
 });
 // Administrator-entered, paper-approved leave. Uses the same login and save lock.
 function initAddFields(){
  $('maintAddStart').value=today;$('maintAddEnd').value=today;$('maintAddStart').max=today;$('maintAddEnd').max=today;
  $('maintAddUnit').value='DAY';$('maintAddType').selectedIndex=0;$('maintAddReason').value='';$('maintAddApproved').checked=false;
  for(const name of ['maintAddFrom','maintAddTo']){const field=$(name);field.replaceChildren();for(let slot=17;slot<=35;slot++){const value=String(Math.floor(slot/2)).padStart(2,'0')+':'+(slot%2?'30':'00');field.add(el('option',value,{value}));}}
  $('maintAddFrom').value='08:30';$('maintAddTo').value='17:30';updateAddUnit();
 }
 function updateAddUnit(){const hours=$('maintAddUnit').value==='HOURS';$('maintAddHours').hidden=!hours;}
 $('maintAddUnit').onchange=updateAddUnit;
 function addArgs(){
  if(!$('maintEmployee').value)throw Error('請先選擇員工。');
  if(!$('maintAddStart').value||!$('maintAddEnd').value||$('maintAddEnd').value<$('maintAddStart').value)throw Error('請核對請假起訖日期。');
  if($('maintAddEnd').value>today)throw Error('管理者補登請填今天或以前的請假日期。');
  if(!$('maintAddApproved').checked)throw Error('請先核對紙本假單及核准結果，再勾選確認。');
  if($('maintAddReason').value.trim().replace(/(?:[；;，,\s]*管理者補登)+$/,'').trim().length<3)throw Error('請填寫至少3字的實際請假原因，系統會自動加上管理者補登。');
  return {requestId:addDraft?.requestId||id('V2_ALEAVE_'),employeeId:$('maintEmployee').value,startDate:$('maintAddStart').value,endDate:$('maintAddEnd').value,leaveType:$('maintAddType').value,unit:$('maintAddUnit').value,fromTime:$('maintAddFrom').value,toTime:$('maintAddTo').value,reason:$('maintAddReason').value,paperApproved:true};
 }
 async function loadAdd(restore=false){
  if(restore){$('maintEmployee').value=savedMark.employeeId;$('maintAddStart').value=savedMark.date;$('maintAddEnd').value=savedMark.endDate||savedMark.date;}
  if(!$('maintEmployee').value||!$('maintAddStart').value||!$('maintAddEnd').value)throw Error('請選擇員工並填寫請假起訖日期。');
  const result=await post('MAINT_ADD_QUERY',{employeeId:$('maintEmployee').value,startDate:$('maintAddStart').value,endDate:$('maintAddEnd').value});addBase=result.day;
  $('maintAddEditor').hidden=false;const list=$('maintAddHistory');list.replaceChildren();
  for(const row of addBase.rows)list.append(el('p',period(row)+'｜'+statusText(row.status)+'｜'+(row.sourceLabel||'員工申請')+'｜'+row.body.reason+'｜'+row.requestId));
  if(!addBase.rows.length)list.textContent='這個日期範圍沒有查到請假申請。';
  if(restore)completeSaved({...savedMark,kind:'ADD'},'這筆請假補登已保存，畫面已鎖定。若要開始另一筆，請按「開始另一筆維護」。');
  else tell('已查詢既有假單，尚未補登。核對紙本假單後可預覽。');
  return result.day;
 }
 $('maintAddEditor').addEventListener('input',()=>{if(!busy&&!pending&&!completed){addBase=null;clearPreview();}});
 $('maintAddMakePreview').onclick=()=>run($('maintAddMakePreview'),async()=>{
  if(pending)throw Error('請先查核上次保存結果。');const form=addArgs();await loadAdd();addDraft={...form,revision:addBase.revision};tell('正在核對日期、時段及既有假單…','busy');
  const result=await post('MAINT_ADD_PREVIEW',addDraft);addProof=result.preview;
  $('maintAddPreview').replaceChildren(el('h3','請假補登：保存前核對'),el('p',result.employee.company+'／'+result.employee.name),el('p',period({body:result.body})),el('p','請假原因：'+result.body.reason),el('p','狀態：核准（依已核對的紙本假單及核准結果補登）'),el('p','保存後立即寫入「請假申請」，操作軌跡另存「請假補登紀錄」。人工勸導單由你另外開立。'));
  $('maintAddPreview').hidden=false;$('maintAddSave').hidden=false;tell('預覽完成，尚未保存。請核對後按「確認保存請假補登」。','success');
 });
 function completeAdd(result){
  const reference={kind:'ADD',employeeId:result.entry.employeeId,date:result.entry.body.startDate,endDate:result.entry.body.endDate,requestId:result.receipt};
  if(result.saved&&result.exportProjection==='CURRENT'){forgetPending();$('maintAddSaved').textContent=period(result.entry)+'｜'+result.entry.body.reason+'｜保存編號：'+result.receipt;completeSaved(reference,'請假補登已保存，「請假申請」已同步。畫面已鎖定，人工勸導單請另外開立。');}
  else {clearPreview();tell('補登紀錄已保存，請假申請同步尚未完成。請按「查核上次保存結果」，不要重複補登。','error');}
 }
 $('maintAddSave').onclick=()=>run($('maintAddSave'),async()=>{
  if(access?.readOnly||!access?.leaveSupplement)throw Error('請假補登尚未開放。');if(!addDraft||!addProof)throw Error('請先重新預覽。');
  pending={kind:'ADD',employeeId:addDraft.employeeId,date:addDraft.startDate,endDate:addDraft.endDate,requestId:addDraft.requestId};readPending();tell('正在保存請假補登，請等待結果…','busy');const result=await post('MAINT_ADD_COMMIT',{...addDraft,preview:addProof});completeAdd(result);
 });
 async function checkAdd(){
  const result=await post('MAINT_ADD_STATUS',{requestId:pending.requestId});
  if(result.saved){setMode('ADD');$('maintAddEditor').hidden=false;completeAdd(result);}
  else {forgetPending();clearPreview();tell('目前未查到這筆補登保存紀錄，可重新預覽；會沿用原保存編號。');}
 }
 initAddFields();

 setMode('CLOCK');
 function ensureLiff(){if(!liffReady)liffReady=liff.init({liffId:window.V2_QA_LIFF_ID}).catch(error=>{liffReady=null;throw new Error('LINE 登入元件載入失敗，請檢查網路後再按「確認 LINE 登入」。');});return liffReady;}
 tell('請按「確認 LINE 登入」，核對管理者權限後再操作。');applyControls();
};

