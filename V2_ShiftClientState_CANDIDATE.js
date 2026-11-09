'use strict';
// UI state only: policy MUST originate from an authenticated server reply.
// Server still rechecks identity and shift policy under the write lock.
function create(){
 let policy=null,choice=null,pending=null;
 function setPolicy(value){
  if(!value||value.ok!==true||value.readOnly!==true||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||typeof value.choiceRequired!=='boolean'||
    JSON.stringify(value.shifts)!==JSON.stringify(value.choiceRequired?['STANDARD','EARLY']:['STANDARD']))throw Error('POLICY_INVALID');
  policy={...value,shifts:value.shifts.slice()};choice=null;
 }
 function select(code){
  if(pending)throw Error('ORIGINAL_REQUEST_PENDING');
  if(!policy||!policy.choiceRequired||!policy.shifts.includes(code))throw Error('SHIFT_NOT_ALLOWED');
  choice=code;
 }
 function prepare(type,requestId){
  if(pending)throw Error('ORIGINAL_REQUEST_PENDING');
  if(!policy)throw Error('POLICY_REQUIRED');
  if(!['上班','下班'].includes(type)||!/^[A-Za-z0-9_-]{12,80}$/.test(requestId))throw Error('INPUT_INVALID');
  if(type==='上班'&&policy.choiceRequired&&!choice)throw Error('SHIFT_REQUIRED');
  if(type==='下班'&&policy.choiceRequired&&!['STANDARD','EARLY'].includes(policy.todayShift))throw Error('SHIFT_IN_NOT_CONFIRMED');
  pending={requestId,type,...(type==='上班'&&policy.choiceRequired?{shiftCode:choice}:{})};
  return {...pending};
 }
 function original(){return pending?{...pending}:null;}
 function clearUnwritten(requestId){
  if(!pending||pending.requestId!==requestId)throw Error('ORIGINAL_NOT_CONFIRMED');
  pending=null;
 }
 function settle(request){
  if(!pending||!request||request.requestId!==pending.requestId||request.type!==pending.type||
    !['STANDARD','EARLY'].includes(request.shiftCode)||pending.shiftCode&&request.shiftCode!==pending.shiftCode)throw Error('ORIGINAL_NOT_CONFIRMED');
  if(pending.type==='上班')policy={...policy,todayShift:request.shiftCode,clockInRecorded:true};
  pending=null;choice=null;
 }
 return {setPolicy,select,prepare,original,settle,clearUnwritten};
}
if(typeof module==='object'&&module.exports)module.exports={create};
else window.YCShiftClientState={create};
