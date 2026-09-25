const KEY="tradegrid-fresh-v12";
const defaults={settings:{theme:"dark",currency:"INR",exchangeRate:83.5},accountBalance:{amount:0,lastUpdated:null,history:[]},transactions:[],sales:[],dailyChecklist:[],recurringTasks:[],notes:"",calcLog:[]};
let state=read(),rangeDays=7;
let undoStack=[],redoStack=[],lastSnapshot=JSON.stringify(state),restoring=false;

function read(){try{return Object.assign(structuredClone(defaults),JSON.parse(localStorage.getItem(KEY)||"{}"))}catch{return structuredClone(defaults)}}
function save(){
  const next=JSON.stringify(state);
  if(next===lastSnapshot)return;
  if(!restoring){
    undoStack.push(lastSnapshot);
    if(undoStack.length>30)undoStack.shift();
    redoStack=[];
  }
  localStorage.setItem(KEY,next);
  lastSnapshot=next;
  updateHistoryButtons();
}
function restoreSnapshot(snapshot){
  restoring=true;
  state=JSON.parse(snapshot);
  localStorage.setItem(KEY,snapshot);
  lastSnapshot=snapshot;
  restoring=false;
  render();drawAll();renderNotes();renderLog();updateHistoryButtons();updateHistoryButtons();
}
function undo(){if(!undoStack.length)return;const current=JSON.stringify(state);const previous=undoStack.pop();redoStack.push(current);restoreSnapshot(previous);toast("Undone")}
function redo(){if(!redoStack.length)return;const current=JSON.stringify(state);const next=redoStack.pop();undoStack.push(current);restoreSnapshot(next);toast("Redone")}
function updateHistoryButtons(){const u=$("#undoBtn"),r=$("#redoBtn");if(u)u.disabled=!undoStack.length;if(r)r.disabled=!redoStack.length}
const $=s=>document.querySelector(s);
const today=()=>new Date().toISOString().slice(0,10);
const id=p=>p+"_"+Date.now()+"_"+Math.random().toString(36).slice(2,7);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function money(v){
  const n=Number(v)||0;
  return new Intl.NumberFormat(state.settings.currency==="INR"?"en-IN":"en-US",{
    style:"currency",
    currency:state.settings.currency,
    maximumFractionDigits:2
  }).format(n);
}
function currencyMark(){return state.settings.currency==="INR"?"₹":"$"}
function currencyName(){return state.settings.currency==="INR"?"Rupees (₹)":"US Dollars ($)"}

function convertStoredAmounts(from,to){
  if(from===to)return;
  const rate=Number(state.settings.exchangeRate)||83.5;
  const factor=from==="INR"&&to==="USD" ? 1/rate : rate;
  const change=n=>Number(n||0)*factor;

  state.accountBalance.amount=change(state.accountBalance.amount);
  state.accountBalance.history.forEach(x=>x.change=change(x.change));

  state.transactions.forEach(x=>x.amount=change(x.amount));

  state.sales.forEach(x=>{
    x.costPrice=change(x.costPrice);
    x.sellingPrice=change(x.sellingPrice);
  });
}
function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()}
function toast(msg){const root=$("#toast-root")||document.body;const e=document.createElement("div");e.className="toast";e.textContent=msg;root.append(e);setTimeout(()=>e.remove(),2200)}

function applyTheme(){$("html").classList.toggle("light",state.settings.theme==="light");$("#themeBtn").textContent=state.settings.theme==="dark"?"☼":"☾"}
applyTheme();
$("#currency").value=state.settings.currency;
$("#today").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short"});
$("#themeBtn").onclick=()=>{state.settings.theme=state.settings.theme==="dark"?"light":"dark";const snap=JSON.stringify(state);localStorage.setItem(KEY,snap);lastSnapshot=snap;applyTheme();drawAll()};
$("#currency").onchange=e=>{
  const next=e.target.value;
  const previous=state.settings.currency||"INR";
  if(next!==previous){
    convertStoredAmounts(previous,next);
    state.settings.currency=next;
    save();
    render();
    drawAll();
    toast("All amounts switched to "+currencyName());
  }
};
$("#undoBtn").onclick=undo;$("#redoBtn").onclick=redo;
document.addEventListener("keydown",e=>{if(!(e.ctrlKey||e.metaKey))return;if(e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo()}else if(e.key.toLowerCase()==="y"){e.preventDefault();redo()}});

function dayRows(){
  const dates=rangeDays==="all"
    ? [...new Set([...state.sales.map(x=>x.date),...state.transactions.map(x=>x.date)])].sort()
    : days(Number(rangeDays));
  return dates.length?dates.map(day):days(7).map(day);
}
function days(n){const out=[];for(let i=n-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);out.push(d.toISOString().slice(0,10))}return out}
function day(date){
  const sales=state.sales.filter(x=>x.date===date);
  const tx=state.transactions.filter(x=>x.date===date);
  const revenue=sales.reduce((a,s)=>a+s.sellingPrice*s.quantity,0);
  const cost=sales.reduce((a,s)=>a+s.costPrice*s.quantity,0);
  const incoming=tx.filter(x=>x.type==="income").reduce((a,x)=>a+Number(x.amount),0);
  const expense=tx.filter(x=>x.type==="expense").reduce((a,x)=>a+Number(x.amount),0);
  const profit=revenue+incoming-cost-expense;
  return {date,revenue,cost,incoming,expense,profit,margin:revenue+incoming?profit/(revenue+incoming)*100:0,activity:sales.length+tx.length};
}
function todayTotals(){const d=day(today());return {income:d.revenue+d.incoming,expense:d.expense,profit:d.profit}}

function render(){
  const t=todayTotals();
  const currencyLabel=$("#balanceCurrency");
  if(currencyLabel)currencyLabel.textContent=currencyMark();
  $("#balance").textContent=money(state.accountBalance.amount);
  $("#balanceHint").textContent=state.accountBalance.lastUpdated?"Tap to add money":"Set starting balance";
  $("#income").textContent=money(t.income);$("#expense").textContent=money(t.expense);$("#profit").textContent=money(t.profit);
  $("#profitStatus").textContent=t.profit>0?"● Positive Day":t.profit<0?"● Needs Work":"○ Break Even";
  $("#profitBar").classList.toggle("positive",t.profit>0);$("#profitBar").classList.toggle("negative",t.profit<0);
  renderTasks();renderSales();renderTransactions();renderRecurring();renderNotes();renderLog();
}
function renderTasks(){
  const list=state.dailyChecklist.filter(x=>x.date===today()),done=list.filter(x=>x.completed).length;
  $("#taskCount").textContent=done+"/"+list.length;$("#taskProgress").style.width=list.length?(done/list.length*100)+"%":"0%";
  $("#tasks").innerHTML=list.length?list.map(t=>`<div class="task ${t.completed?"done":""}"><input type="checkbox" ${t.completed?"checked":""} data-task="${t.id}"><span>${esc(t.task)}</span><button data-del-task="${t.id}">×</button></div>`).join(""):'<div class="empty">No tasks yet.</div>';
}
$("#tasks").onclick=e=>{const check=e.target.closest("[data-task]"),del=e.target.closest("[data-del-task]");if(check){const t=state.dailyChecklist.find(x=>x.id===check.dataset.task);if(t)t.completed=check.checked;save();renderTasks()}if(del){state.dailyChecklist=state.dailyChecklist.filter(x=>x.id!==del.dataset.delTask);save();renderTasks()}};
function addTask(){const input=$("#taskInput"),v=input.value.trim();if(!v)return;state.dailyChecklist.push({id:id("task"),date:today(),task:v,completed:false});input.value="";save();renderTasks()}
$("#addTask").onclick=addTask;$("#taskInput").onkeydown=e=>{if(e.key==="Enter")addTask()};

function renderSales(){
  const rows=[...state.sales].sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  $("#salesTable").innerHTML=rows.slice(0,8).map(s=>{const p=(s.sellingPrice-s.costPrice)*s.quantity,m=s.costPrice?p/(s.costPrice*s.quantity)*100:0;return `<tr><td>${s.date.slice(5)}</td><td>${esc(s.itemName)}</td><td>${money(s.costPrice)}</td><td>${money(s.sellingPrice)}</td><td>${s.quantity}</td><td class="${p>=0?"green-text":"red-text"}">${money(p)}</td><td>${m.toFixed(1)}%</td><td><button class="row-btn" data-sale="${s.id}">×</button></td></tr>`}).join("");
  $("#salesEmpty").style.display=rows.length?"none":"block";
}
$("#salesTable").onclick=e=>{const b=e.target.closest("[data-sale]");if(!b)return;state.sales=state.sales.filter(x=>x.id!==b.dataset.sale);save();render();drawAll();toast("Sale deleted")};

function renderTransactions(){
  const rows=[...state.transactions].sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  $("#txTable").innerHTML=rows.slice(0,8).map(x=>`<tr><td>${esc(x.time)}</td><td><span class="type ${x.type}">${x.type}</span></td><td>${esc(x.category)}</td><td>${esc(x.description||"")}</td><td>${money(x.amount)}</td><td><button class="row-btn" data-tx="${x.id}">×</button></td></tr>`).join("");
  $("#txEmpty").style.display=rows.length?"none":"block";
}
$("#txTable").onclick=e=>{
 const b=e.target.closest("[data-tx]");if(!b)return;
 const tx=state.transactions.find(x=>x.id===b.dataset.tx);if(!tx)return;
 state.transactions=state.transactions.filter(x=>x.id!==b.dataset.tx);
 state.accountBalance.amount+=tx.type==="income"?-Number(tx.amount):Number(tx.amount);
 state.accountBalance.lastUpdated=new Date().toISOString();
 save();render();drawAll();toast("Transaction deleted and balance restored");
};

function renderRecurring(){
  const el=$("#recurring");
  el.innerHTML=state.recurringTasks.length?state.recurringTasks.map(r=>`<div class="recurring-item"><div class="recurring-name">${esc(r.taskName)}</div><div class="recurring-meta">${r.frequency} · next ${r.nextDate} <button class="row-btn" data-rec="${r.id}">×</button></div></div>`).join(""):'<div class="empty">No recurring tasks.</div>';
}
$("#recurring").onclick=e=>{const b=e.target.closest("[data-rec]");if(!b)return;state.recurringTasks=state.recurringTasks.filter(x=>x.id!==b.dataset.rec);save();renderRecurring()};

const modal=$("#modal");
function formModal(title,eyebrow,fields,done){
  $("#modalTitle").textContent=title;
  $("#modalEyebrow").textContent=eyebrow;
  $("#form").innerHTML=`<div class="modal-body">${fields.map(f=>`<div class="field"><label>${f.label}</label>${f.input}</div>`).join("")}<div class="form-actions"><button type="button" class="btn" id="cancel">Cancel</button><button class="btn btn-solid">Save</button></div></div>`;
  $("#form").querySelectorAll("[data-money-label]").forEach(el=>el.textContent=el.dataset.moneyLabel+" ("+currencyMark()+")");
  $("#cancel").onclick=()=>modal.close();$("#form").onsubmit=e=>{e.preventDefault();done(new FormData(e.currentTarget));modal.close()};modal.showModal();
}
$("#closeModal").onclick=()=>modal.close();

$("#balanceCard").onclick=()=>{
  if(!state.accountBalance.lastUpdated){
    formModal("Set starting balance","ACCOUNT",[
      {label:'<span data-money-label="Starting balance">Starting balance</span>',input:'<input name="amount" type="number" min="0" step=".01" required>'},
      {label:"Note",input:'<input name="note" placeholder="e.g. Cash + bank balance">'}],fd=>{
        const a=Number(fd.get("amount"));state.accountBalance.amount=a;state.accountBalance.lastUpdated=new Date().toISOString();state.accountBalance.history.push({date:state.accountBalance.lastUpdated,type:"starting",change:a,note:fd.get("note")});save();render();drawAll();toast("Balance saved");
      });
  }else{
    formModal("Add money","BALANCE · ADD ONLY",[
      {label:'<span data-money-label="Amount received">Amount received</span>',input:'<input name="amount" type="number" min=".01" step=".01" required>'},
      {label:"Source",input:'<input name="note" placeholder="e.g. Money from family">'}],fd=>{
        const a=Number(fd.get("amount"));state.accountBalance.amount+=a;state.accountBalance.lastUpdated=new Date().toISOString();state.accountBalance.history.push({date:state.accountBalance.lastUpdated,type:"add",change:a,note:fd.get("note")});save();render();drawAll();toast("Money added");
      });
  }
};

$("#newTx").onclick=()=>formModal("Add transaction","CASH",[
 {label:"Type",input:'<select name="type"><option value="expense">Expense</option><option value="income">Income</option></select>'},
 {label:"Category",input:'<select name="category"><option>Daily Use</option><option>Food</option><option>Travel</option><option>Inventory</option><option>Rent</option><option>Marketing</option><option>Utilities</option><option>Misc</option></select>'},
 {label:'<span data-money-label="Amount">Amount</span>',input:'<input name="amount" type="number" min=".01" step=".01" required>'},
 {label:"Description",input:'<input name="description" placeholder="What happened?">'}],fd=>{
  const amount=Number(fd.get("amount")),type=fd.get("type");
  if(type==="expense"&&amount>state.accountBalance.amount){toast("Not enough balance");return}
  const d=new Date();state.transactions.push({id:id("tx"),date:today(),time:d.toTimeString().slice(0,5),type,category:fd.get("category"),amount,description:fd.get("description"),note:""});
  state.accountBalance.amount+=type==="income"?amount:-amount;state.accountBalance.lastUpdated=new Date().toISOString();state.accountBalance.history.push({date:state.accountBalance.lastUpdated,type,change:type==="income"?amount:-amount,note:fd.get("description")});save();render();drawAll();toast(type==="expense"?"Expense deducted":"Income added");
});

$("#newSale").onclick=()=>formModal("Add sale","SALES",[
 {label:"Item",input:'<input name="item" required>'},{label:'<span data-money-label="Cost / unit">Cost / unit</span>',input:'<input name="cost" type="number" min="0" step=".01" required>'},{label:'<span data-money-label="Sell / unit">Sell / unit</span>',input:'<input name="sell" type="number" min="0" step=".01" required>'},{label:"Quantity",input:'<input name="qty" type="number" min="1" step="1" value="1" required>'}],fd=>{
 const d=new Date(),s={id:id("sale"),date:today(),time:d.toTimeString().slice(0,5),itemName:fd.get("item"),costPrice:Number(fd.get("cost")),sellingPrice:Number(fd.get("sell")),quantity:Number(fd.get("qty"))};state.sales.push(s);save();render();drawAll();toast("Sale added");
});
$("#newRecurring").onclick=()=>formModal("Add recurring task","SCHEDULE",[
 {label:"Task",input:'<input name="name" required>'},{label:"Frequency",input:'<select name="frequency"><option>daily</option><option>weekly</option><option>monthly</option></select>'},{label:"Next date",input:`<input name="date" type="date" value="${today()}" required>`}],fd=>{state.recurringTasks.push({id:id("rec"),taskName:fd.get("name"),frequency:fd.get("frequency"),nextDate:fd.get("date"),daysCompleted:[]});save();renderRecurring();toast("Task scheduled")});

function setupCanvas(c){
  const r=c.getBoundingClientRect();
  const d=Math.max(1,window.devicePixelRatio||1);
  const w=Math.max(1,Math.floor(r.width));
  const h=Math.max(1,Math.floor(r.height));
  c.width=w*d;
  c.height=h*d;
  c.style.width=w+"px";
  c.style.height=h+"px";
  const ctx=c.getContext("2d");
  ctx.setTransform(d,0,0,d,0,0);
  return[ctx,w,h];
}
function grid(ctx,w,h){ctx.strokeStyle=css("--line");ctx.lineWidth=1;for(let i=0;i<4;i++){const y=12+i*(h-38)/3;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}}
function plot(canvasId,vals,color){
  const [c,w,h]=setupCanvas($("#"+canvasId));
  c.clearRect(0,0,w,h);
  grid(c,w,h);
  if(!vals.length)return;
  let max=Math.max(...vals.map(x=>x.v),0);
  let min=Math.min(...vals.map(x=>x.v),0);
  if(max===min){max+=1;min-=1}
  const span=max-min;
  const pts=vals.map((x,i)=>({x:16+i*(w-32)/Math.max(vals.length-1,1),y:12+(max-x.v)/span*(h-38)}));
  c.beginPath();
  pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));
  c.strokeStyle=color;c.lineWidth=1.7;c.lineJoin="round";c.lineCap="round";c.stroke();
  pts.forEach((p,i)=>{
    if(i%Math.max(1,Math.ceil(vals.length/7))===0||i===pts.length-1){
      c.beginPath();c.arc(p.x,p.y,2.5,0,Math.PI*2);c.fillStyle=color;c.fill();
      c.fillStyle=css("--muted");c.font="7px Inter";c.textAlign="center";c.fillText(vals[i].label,p.x,h-4);
    }
  });
}
function drawProfit(){const ds=days(7),vals=ds.map(x=>day(x).profit),max=Math.max(...vals,1),min=Math.min(...vals,-1),span=max-min||1,[c,w,h]=setupCanvas($("#profitChart"));c.clearRect(0,0,w,h);grid(c,w,h);const pts=vals.map((v,i)=>({x:16+i*(w-32)/6,y:12+(max-v)/span*(h-38)}));c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=css("--white");c.lineWidth=1.7;c.stroke();pts.forEach((p,i)=>{c.beginPath();c.arc(p.x,p.y,4,0,7);c.fillStyle=vals[i]>=0?css("--green"):css("--red");c.fill();c.fillStyle=css("--muted");c.font="8px Inter";c.fillText(ds[i].slice(5),p.x-11,h-6)})}
function drawBalance(){
  const rows=days(7).map(day);
  let cur=Number(state.accountBalance.amount)||0;
  const changes=rows.reduce((sum,r)=>sum+r.incoming-r.expense,0);
  cur-=changes;
  const vals=[];
  rows.forEach(r=>{
    cur+=r.incoming-r.expense;
    vals.push({v:cur,label:r.date.slice(5)});
  });
  plot("balanceChart",vals,css("--white"));
}
function drawCash(){
  const rows=days(7).map(day),[c,w,h]=setupCanvas($("#cashChart"));
  c.clearRect(0,0,w,h);grid(c,w,h);
  const max=Math.max(...rows.map(r=>Math.max(r.incoming+r.revenue,r.expense)),1);
  const step=(w-24)/Math.max(rows.length,1);
  const bw=Math.max(3,Math.min(9,step*.25));
  rows.forEach((r,i)=>{
    const x=12+i*step;
    const inc=(r.incoming+r.revenue)/max*(h-34);
    const exp=r.expense/max*(h-34);
    c.fillStyle=css("--green");c.fillRect(x,h-23-inc,bw,inc);
    c.fillStyle=css("--red");c.fillRect(x+bw+2,h-23-exp,bw,exp);
    if(i%Math.max(1,Math.ceil(rows.length/7))===0||i===rows.length-1){
      c.fillStyle=css("--muted");c.font="7px Inter";c.textAlign="center";c.fillText(r.date.slice(5),x+bw,h-3);
    }
  });
}
function drawCharts(){
  drawProfit();
  const rows=days(7).map(day);
  plot("balanceChart",rows.map(r=>({v:r.balance??0,label:r.date.slice(5)})),css("--white"));
  drawBalance();
  drawCash();
  plot("marginChart",rows.map(r=>({v:r.margin,label:r.date.slice(5)})),css("--green"));
  plot("activityChart",rows.map(r=>({v:r.activity,label:r.date.slice(5)})),css("--white"));
}
function drawAll(){drawCharts()}

$("#range").onclick=e=>{const b=e.target.closest("button");if(!b)return;document.querySelectorAll("#range button").forEach(x=>x.classList.remove("active"));b.classList.add("active");rangeDays=b.dataset.days==="all"?"all":Number(b.dataset.days);drawAll()};

let expression="";
function safeCalculate(s){if(!/^[0-9+\-*/().\s]+$/.test(s))return null;try{const n=Function('"use strict";return ('+s+')')();return Number.isFinite(n)?String(Math.round(n*1e10)/1e10):null}catch{return null}}
function showCalc(){const result=safeCalculate(expression);$("#calcExpression").textContent=expression||"0";$("#calcResult").textContent=result??"—"}
function logCalc(exp,result){state.calcLog.push({expression:exp,result,date:new Date().toISOString()});state.notes=(state.notes||"")+(state.notes?"\n":"")+`[${new Date().toLocaleTimeString()}] ${exp} = ${result}`;save();renderNotes();renderLog()}
function press(key){
 if(key==="clear"){expression="";showCalc();return}
 if(key==="back"){expression=expression.slice(0,-1);showCalc();return}
 if(key==="percent"){expression+=" / 100";showCalc();return}
 if(key==="equals"){const result=safeCalculate(expression);if(result!==null){logCalc(expression,result);expression=result;showCalc()}return}
 expression+=key;showCalc()
}
$("#keys").onclick=e=>{const b=e.target.closest("[data-key]");if(b)press(b.dataset.key)};
document.addEventListener("keydown",e=>{if(e.target.matches("input,textarea,select"))return;const k=e.key;if(/[0-9+\-*/().]/.test(k))press(k);else if(k==="Enter")press("equals");else if(k==="Backspace")press("back");else if(k==="%")press("percent");else if(k==="Escape")press("clear")});
function renderNotes(){const n=$("#notes");if(n&&document.activeElement!==n)n.value=state.notes||""}
function renderLog(){$("#calcLog").innerHTML=state.calcLog.length?state.calcLog.slice(-20).reverse().map(x=>`<div class="calc-line"><span>${esc(x.expression)}</span><b>${esc(x.result)}</b></div>`).join(""):'<div class="empty">No calculations yet.</div>'}
$("#notes").oninput=e=>{state.notes=e.target.value;save()};$("#clearLog").onclick=()=>{state.calcLog=[];save();renderLog()};

$("#csv").onclick=()=>{const rows=[["Date","Time","Type","Category","Description","Amount"],...state.transactions.map(x=>[x.date,x.time,x.type,x.category,x.description,x.amount])];const text=rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/csv"}));a.download=`tradegrid-${today()}.csv`;a.click();URL.revokeObjectURL(a.href)};
$("#print").onclick=()=>window.print();$("#reportAgain").onclick=()=>window.print();$("#csvAgain").onclick=()=>$("#csv").click();
$("#clear").onclick=()=>{if(confirm("Clear all TradeGrid data? This cannot be undone.")){localStorage.removeItem(KEY);state=read();undoStack=[];redoStack=[];lastSnapshot=JSON.stringify(state);render();drawAll();updateHistoryButtons();toast("Fresh workspace created")}};

function tick(){const d=new Date();$("#clock").textContent=d.toLocaleTimeString("en-IN",{hour12:false});$("#date").textContent=d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}
setInterval(tick,1000);tick();
render();drawAll();renderNotes();renderLog();

const legal={
 license:["MIT License",`<h3>Copyright</h3><p>Copyright © 2026 <b>Deep Lambhade</b>.</p><h3>Permission</h3><p>TradeGrid is open-source software under the MIT License. You may use, copy, modify, publish, distribute, sublicense and sell copies, subject to the license conditions.</p><h3>Requirement</h3><p>Keep the copyright and permission notice with copies or substantial portions of the software.</p><h3>Disclaimer</h3><p>The software is provided “AS IS”, without warranty. See the included LICENSE file for the complete text.`],
 terms:["Terms & Conditions",`<h3>Use</h3><p>Anyone may use TradeGrid for personal, educational, testing or commercial work subject to the MIT License.</p><h3>Local records</h3><p>Core dashboard records are stored in your browser. You are responsible for backups and device security.</p><h3>Financial use</h3><p>TradeGrid is a record-keeping and calculation tool, not financial, tax, accounting, investment or legal advice.</p>`],
 privacy:["Privacy",`<h3>Local-first</h3><p>TradeGrid does not require an account or backend for its core features. Records are saved in browser local storage.</p><h3>Backups</h3><p>Clearing browser data or changing devices can remove local records. Export important information regularly.</p>`]
};
$("#closeLegal").onclick=()=>$("#legal").close();document.querySelectorAll("[data-legal]").forEach(b=>b.onclick=()=>{$("#legalTitle").textContent=legal[b.dataset.legal][0];$("#legalBody").innerHTML=legal[b.dataset.legal][1];$("#legal").showModal()});
