const KEY = "tradegrid-v1";
const today = () => new Date().toISOString().slice(0,10);
const uid = p => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const defaultState = {
  settings:{theme:"dark",currency:"USD",exchangeRate:83.5},
  accountBalance:{amount:0,lastUpdated:null,history:[]},
  transactions:[],
  sales:[],
  dailyChecklist:[],
  recurringTasks:[]
};
let state = load();

function load(){
  try { return {...defaultState,...JSON.parse(localStorage.getItem(KEY)||"{}")}; }
  catch { return structuredClone(defaultState); }
}
function save(){ localStorage.setItem(KEY,JSON.stringify(state)); }
function money(v){
  const n = Number(v)||0, x = state.settings.currency==="INR" ? n*state.settings.exchangeRate : n;
  return new Intl.NumberFormat(state.settings.currency==="INR"?"en-IN":"en-US",{style:"currency",currency:state.settings.currency,maximumFractionDigits:2}).format(x);
}
function rawMoney(v){ return state.settings.currency==="INR" ? (Number(v)*state.settings.exchangeRate) : Number(v); }
function toast(msg){const el=document.createElement("div");el.className="toast";el.textContent=msg;document.querySelector("#toast-root").append(el);setTimeout(()=>el.remove(),2400)}
function escape(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

const $ = s => document.querySelector(s);
$("#todayLabel").textContent = new Date().toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
$("#themeToggle").onclick=()=>{state.settings.theme=state.settings.theme==="dark"?"light":"dark";save();applyTheme();drawAll()};
$("#currencySelect").value=state.settings.currency;
$("#currencySelect").onchange=e=>{state.settings.currency=e.target.value;save();render();drawAll();toast("Currency updated")};

function applyTheme(){document.documentElement.classList.toggle("light",state.settings.theme==="light");$("#themeToggle").textContent=state.settings.theme==="dark"?"☀️":"🌙"}
applyTheme();

function todaySales(){return state.sales.filter(x=>x.date===today())}
function todayTx(){return state.transactions.filter(x=>x.date===today())}
function totals(){
  const salesIncome=todaySales().reduce((a,s)=>a+s.sellingPrice*s.quantity,0);
  const txIncome=todayTx().filter(x=>x.type==="income").reduce((a,x)=>a+Number(x.amount),0);
  const expenses=todayTx().filter(x=>x.type==="expense").reduce((a,x)=>a+Number(x.amount),0);
  const saleProfit=todaySales().reduce((a,s)=>a+(s.sellingPrice-s.costPrice)*s.quantity,0);
  return {income:salesIncome+txIncome,expenses,profit:saleProfit+txIncome-expenses};
}
function render(){
  const t=totals();
  $("#balanceValue").textContent=money(state.accountBalance.amount);
  $("#balanceUpdated").textContent=state.accountBalance.lastUpdated?`Updated ${new Date(state.accountBalance.lastUpdated).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:"Not updated yet";
  $("#incomeValue").textContent=money(t.income);
  $("#expenseValue").textContent=money(t.expenses);
  $("#profitValue").textContent=money(t.profit);
  const banner=$("#statusBanner");banner.classList.toggle("positive",t.profit>0);banner.classList.toggle("negative",t.profit<0);
  $("#profitStatus").textContent=t.profit>0?"✅ Positive Day!":t.profit<0?"❌ Needs Work":"⚪ Break Even";
  renderSales(); renderTasks(); renderRecurring(); renderTransactions();
}
function renderSales(){
  const body=$("#salesTable");body.innerHTML="";
  const rows=[...state.sales].sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  $("#salesEmpty").style.display=rows.length?"none":"block";
  rows.slice(0,20).forEach(s=>{
    const p=(s.sellingPrice-s.costPrice)*s.quantity, margin=s.sellingPrice?sellingMargin(s):0;
    body.insertAdjacentHTML("beforeend",`<tr>
      <td>${escape(s.date)}</td><td>${escape(s.itemName)}</td><td>${money(s.costPrice)}</td><td>${money(s.sellingPrice)}</td><td>${s.quantity}</td>
      <td class="profit-cell ${p>=0?"positive-text":"loss"}">${money(p)}</td><td>${margin.toFixed(1)}%</td>
      <td><button class="row-action" onclick="deleteSale('${s.id}')">×</button></td></tr>`);
  });
}
function sellingMargin(s){return ((s.sellingPrice-s.costPrice)/s.costPrice*100)}
window.deleteSale=id=>{state.sales=state.sales.filter(x=>x.id!==id);save();render();drawAll();toast("Sale deleted")};

function renderTasks(){
  const tasks=state.dailyChecklist.filter(x=>x.date===today());
  const done=tasks.filter(x=>x.completed).length;
  $("#taskCounter").textContent=`${done}/${tasks.length}`;$("#taskProgress").style.width=tasks.length?`${done/tasks.length*100}%`:"0%";
  const list=$("#taskList");list.innerHTML="";
  if(!tasks.length){list.innerHTML='<div class="empty">No tasks yet. Keep the day focused.</div>';return}
  tasks.forEach(t=>list.insertAdjacentHTML("beforeend",`<div class="task ${t.completed?"done":""}">
    <input type="checkbox" ${t.completed?"checked":""} onchange="toggleTask('${t.id}')"><span>${escape(t.task)}</span><button class="row-action" onclick="deleteTask('${t.id}')">×</button></div>`));
}
window.toggleTask=id=>{const t=state.dailyChecklist.find(x=>x.id===id);if(t)t.completed=!t.completed;save();renderTasks();toast("Task updated")};
window.deleteTask=id=>{state.dailyChecklist=state.dailyChecklist.filter(x=>x.id!==id);save();renderTasks();toast("Task deleted")};
function addTask(){const input=$("#taskInput"),task=input.value.trim();if(!task)return;state.dailyChecklist.push({id:uid("task"),date:today(),task,completed:false});input.value="";save();renderTasks();toast("Task added")}
$("#addTaskBtn").onclick=addTask;$("#taskInput").onkeydown=e=>{if(e.key==="Enter")addTask()};

function renderRecurring(){
  const el=$("#recurringList");el.innerHTML="";
  if(!state.recurringTasks.length){el.innerHTML='<div class="empty">No recurring tasks configured.</div>';return}
  state.recurringTasks.forEach(r=>el.insertAdjacentHTML("beforeend",`<div class="recurring"><div class="recurring-top"><span class="recurring-name">${escape(r.taskName)}</span><button class="row-action" onclick="deleteRecurring('${r.id}')">×</button></div><div class="recurring-meta">${r.frequency} · next ${r.nextDate}</div></div>`));
}
window.deleteRecurring=id=>{state.recurringTasks=state.recurringTasks.filter(x=>x.id!==id);save();renderRecurring();toast("Recurring task deleted")};

function renderTransactions(){
  const body=$("#transactionTable");body.innerHTML="";
  const rows=[...state.transactions].sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  $("#transactionsEmpty").style.display=rows.length?"none":"block";
  let balance=state.accountBalance.amount;
  [...rows].reverse().forEach(x=>balance += x.type==="income"?Number(x.amount):-Number(x.amount));
  rows.slice(0,10).forEach(x=>body.insertAdjacentHTML("beforeend",`<tr><td>${escape(x.time||"—")}</td><td><span class="type-badge ${x.type}">${x.type}</span></td><td>${escape(x.category)}</td><td>${escape(x.description||"")}</td><td>${money(x.amount)}</td><td>${money(balance)}</td><td><button class="row-action" onclick="deleteTx('${x.id}')">×</button></td></tr>`));
}
window.deleteTx=id=>{state.transactions=state.transactions.filter(x=>x.id!==id);save();render();drawAll();toast("Transaction deleted")};

const modal=$("#modal"),form=$("#modalForm");
function openModal(title,eyebrow,fields,onSave){
  $("#modalTitle").textContent=title;$("#modalEyebrow").textContent=eyebrow;
  form.innerHTML=`<div class="modal-body">${fields.map(f=>`<div class="field"><label>${f.label}</label>${f.html}</div>`).join("")}<div class="form-actions"><button type="button" class="secondary" id="cancelModal">Cancel</button><button class="primary">Save</button></div></div>`;
  $("#cancelModal").onclick=()=>modal.close();form.onsubmit=e=>{e.preventDefault();onSave(new FormData(form));modal.close()};
  modal.showModal();
}
$("#closeModal").onclick=()=>modal.close();
$("#balanceCard").onclick=()=>openModal("Update balance","ACCOUNT",[{label:"Current balance",html:`<input name="amount" type="number" min="0" step="0.01" value="${state.accountBalance.amount}" required>`}],fd=>{
  state.accountBalance.amount=Number(fd.get("amount"));state.accountBalance.lastUpdated=new Date().toISOString();state.accountBalance.history.push({amount:state.accountBalance.amount,date:state.accountBalance.lastUpdated});save();render();toast("Balance saved")
});
$("#addTransactionBtn").onclick=()=>openTransaction();
function openTransaction(){openModal("Add transaction","CASH LEDGER",[
 {label:"Type",html:'<select name="type"><option value="expense">Expense</option><option value="income">Income</option></select>'},
 {label:"Category",html:'<select name="category"><option>Inventory</option><option>Rent</option><option>Marketing</option><option>Utilities</option><option>Misc</option><option>Sales</option></select>'},
 {label:"Amount",html:'<input name="amount" type="number" min="0" step="0.01" required>'},
 {label:"Description",html:'<input name="description" placeholder="What was this for?">'}
],fd=>{const d=new Date();state.transactions.push({id:uid("tx"),date:today(),time:d.toTimeString().slice(0,5),type:fd.get("type"),category:fd.get("category"),amount:Number(fd.get("amount")),description:fd.get("description"),note:""});save();render();drawAll();toast("Transaction saved")})}
$("#addSaleBtn").onclick=()=>openModal("Add sale","SALES TRACKER",[
 {label:"Item",html:'<input name="itemName" required placeholder="Product name">'},
 {label:"Cost price (unit)",html:'<input name="costPrice" type="number" min="0" step="0.01" required>'},
 {label:"Selling price (unit)",html:'<input name="sellingPrice" type="number" min="0" step="0.01" required>'},
 {label:"Quantity",html:'<input name="quantity" type="number" min="1" step="1" value="1" required>'}
],fd=>{const d=new Date(),s={id:uid("sale"),date:today(),time:d.toTimeString().slice(0,5),itemName:fd.get("itemName"),costPrice:Number(fd.get("costPrice")),sellingPrice:Number(fd.get("sellingPrice")),quantity:Number(fd.get("quantity"))};s.profit=(s.sellingPrice-s.costPrice)*s.quantity;s.profitPercentage=s.costPrice?s.profit/(s.costPrice*s.quantity)*100:0;state.sales.push(s);save();render();drawAll();toast("Sale added")});
$("#addRecurringBtn").onclick=()=>openModal("Add recurring task","SCHEDULER",[
 {label:"Task name",html:'<input name="taskName" required placeholder="Restock">'},
 {label:"Frequency",html:'<select name="frequency"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>'},
 {label:"Next date",html:`<input name="nextDate" type="date" value="${today()}" required>`}
],fd=>{state.recurringTasks.push({id:uid("rt"),taskName:fd.get("taskName"),frequency:fd.get("frequency"),nextDate:fd.get("nextDate"),daysCompleted:[]});save();renderRecurring();toast("Recurring task added")});

let chartRange=7;
function lastDays(n){
  const out=[];for(let i=n-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);out.push(d.toISOString().slice(0,10))}return out
}
function rangeDates(){
  if(chartRange==="all"){
    const dates=[...new Set([...state.sales.map(x=>x.date),...state.transactions.map(x=>x.date)])].sort();
    return dates.length?dates:lastDays(7);
  }
  return lastDays(Number(chartRange));
}
function last7(){return lastDays(7)}
function dayProfit(date){
  const sales=state.sales.filter(x=>x.date===date).reduce((a,s)=>a+(s.sellingPrice-s.costPrice)*s.quantity,0);
  const inc=state.transactions.filter(x=>x.date===date&&x.type==="income").reduce((a,x)=>a+Number(x.amount),0);
  const exp=state.transactions.filter(x=>x.date===date&&x.type==="expense").reduce((a,x)=>a+Number(x.amount),0);
  return sales+inc-exp;
}
function setupCanvas(canvas){
  const dpr=devicePixelRatio||1,r=canvas.getBoundingClientRect();canvas.width=r.width*dpr;canvas.height=r.height*dpr;const c=canvas.getContext("2d");c.scale(dpr,dpr);return [c,r.width,r.height]
}
function drawLineChart(){
  const [c,w,h]=setupCanvas($("#profitChart")),ds=rangeDates(),vals=ds.map(dayProfit);
  const max=Math.max(...vals,1),min=Math.min(...vals,-1),range=max-min||1;
  c.clearRect(0,0,w,h);c.strokeStyle=getCss("--border");c.lineWidth=1;
  for(let i=0;i<5;i++){let y=15+i*(h-45)/4;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
  const pts=vals.map((v,i)=>({x:18+(i*(w-36)/Math.max(ds.length-1,1)),y:15+(max-v)/range*(h-45)}));
  if(pts.length){
    const grad=c.createLinearGradient(0,0,0,h);grad.addColorStop(0,"rgba(0,212,255,.22)");grad.addColorStop(1,"rgba(0,212,255,0)");
    c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.lineTo(pts.at(-1).x,h-25);c.lineTo(pts[0].x,h-25);c.closePath();c.fillStyle=grad;c.fill();
    c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=getCss("--accent");c.lineWidth=2.5;c.stroke();
    const stride=Math.max(1,Math.ceil(ds.length/7));
    pts.forEach((p,i)=>{if(i%stride===0||i===pts.length-1){c.beginPath();c.arc(p.x,p.y,3.5,0,Math.PI*2);c.fillStyle=vals[i]>=0?getCss("--success"):getCss("--danger");c.fill();c.fillStyle=getCss("--muted");c.font="9px Inter";c.fillText(ds[i].slice(5),p.x-13,h-7)}});
  }
}
function drawDonut(){
  const [c,w,h]=setupCanvas($("#expenseChart")),cx=w/2,cy=h/2,r=Math.min(w,h)/2-10;
  const cats=["Inventory","Rent","Marketing","Utilities","Misc"],vals=cats.map(k=>state.transactions.filter(x=>x.type==="expense"&&x.category===k).reduce((a,x)=>a+Number(x.amount),0)),sum=vals.reduce((a,b)=>a+b,0);
  c.clearRect(0,0,w,h);let a=-Math.PI/2;const accents=["--accent","--success","--warning","--danger","--muted"];
  vals.forEach((v,i)=>{const da=sum?v/sum*Math.PI*2:0;c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,r,a,a+da);c.closePath();c.fillStyle=getCss(accents[i]);c.fill();a+=da});
  c.globalCompositeOperation="destination-out";c.beginPath();c.arc(cx,cy,r*.58,0,Math.PI*2);c.fill();c.globalCompositeOperation="source-over";
  $("#expenseTotal").textContent=money(sum);
  $("#expenseLegend").innerHTML=cats.map((k,i)=>`<div class="legend-row"><span class="legend-dot" style="background:${getCss(accents[i])}"></span>${k}<span style="margin-left:auto;color:var(--muted)">${sum?(vals[i]/sum*100).toFixed(0):0}%</span></div>`).join("");
}
function drawBars(){
  const [c,w,h]=setupCanvas($("#salesChart")),ds=rangeDates();
  const qty=ds.map(d=>state.sales.filter(s=>s.date===d).reduce((a,s)=>a+s.quantity,0));
  const rev=ds.map(d=>state.sales.filter(s=>s.date===d).reduce((a,s)=>a+s.sellingPrice*s.quantity,0));
  const mx=Math.max(...qty,1),mr=Math.max(...rev,1);c.clearRect(0,0,w,h);
  const step=(w-40)/Math.max(ds.length,1),bw=Math.max(3,Math.min(14,step*.32));
  ds.forEach((d,i)=>{const x=20+i*step;const qh=(qty[i]/mx)*(h-42),rh=(rev[i]/mr)*(h-42);c.fillStyle=getCss("--accent");c.fillRect(x,h-22-qh,bw,qh);c.fillStyle=getCss("--success");c.fillRect(x+bw+2,h-22-rh,bw,rh);if(i%Math.max(1,Math.ceil(ds.length/7))===0){c.fillStyle=getCss("--muted");c.font="8px Inter";c.fillText(d.slice(5),x-2,h-6)}});
}
function historicalRows(){
  const ds=rangeDates();
  return ds.map(date=>{
    const income=state.sales.filter(s=>s.date===date).reduce((a,s)=>a+s.sellingPrice*s.quantity,0)+state.transactions.filter(x=>x.date===date&&x.type==="income").reduce((a,x)=>a+Number(x.amount),0);
    const expense=state.transactions.filter(x=>x.date===date&&x.type==="expense").reduce((a,x)=>a+Number(x.amount),0);
    const cost=state.sales.filter(s=>s.date===date).reduce((a,s)=>a+s.costPrice*s.quantity,0);
    return {date,income,expense,profit:income-cost-expense,cost};
  });
}
function drawHistoricalLine(canvasId, values, positiveColor=getCss("--accent")){
  const [c,w,h]=setupCanvas($("#"+canvasId));const vals=values.map(x=>x.v),max=Math.max(...vals,1),min=Math.min(...vals,0),range=max-min||1;c.clearRect(0,0,w,h);
  c.strokeStyle=getCss("--border");for(let i=0;i<4;i++){const y=15+i*(h-40)/3;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
  const pts=vals.map((v,i)=>({x:16+i*(w-32)/Math.max(vals.length-1,1),y:15+(max-v)/range*(h-40)}));
  if(!pts.length)return;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=positiveColor;c.lineWidth=2.5;c.stroke();
  pts.forEach((p,i)=>{if(i%Math.max(1,Math.ceil(vals.length/8))===0||i===pts.length-1){c.beginPath();c.arc(p.x,p.y,3,0,Math.PI*2);c.fillStyle=positiveColor;c.fill();c.fillStyle=getCss("--muted");c.font="8px Inter";c.fillText(values[i].label,p.x-12,h-5)}});
}
function drawBalanceChart(){
  const rows=historicalRows();let bal=state.accountBalance.amount;
  const txImpact=rows.slice().reverse().map(r=>r.income-r.expense-r.cost);
  // Reconstruct a useful historical curve from current balance backwards.
  const curves=[];let cur=bal;
  for(let i=rows.length-1;i>=0;i--){cur-=txImpact[i]||0;curves.unshift(cur+txImpact[i]||cur); }
  drawHistoricalLine("balanceChart",rows.map((r,i)=>({v:curves[i]??bal,label:r.date.slice(5)})),getCss("--accent"));
}
function drawCashflowChart(){
  const rows=historicalRows(), canvas=$("#cashflowChart"),[c,w,h]=setupCanvas(canvas);c.clearRect(0,0,w,h);
  const mx=Math.max(...rows.map(r=>Math.max(r.income,r.expense)),1),step=(w-30)/Math.max(rows.length,1),bw=Math.max(3,Math.min(12,step*.32));
  rows.forEach((r,i)=>{const x=15+i*step,ih=r.income/mx*(h-40),eh=r.expense/mx*(h-40);c.fillStyle=getCss("--success");c.fillRect(x,h-25-ih,bw,ih);c.fillStyle=getCss("--danger");c.fillRect(x+bw+2,h-25-eh,bw,eh);if(i%Math.max(1,Math.ceil(rows.length/8))===0){c.fillStyle=getCss("--muted");c.font="8px Inter";c.fillText(r.date.slice(5),x-2,h-7)}});
}
function drawMarginChart(){
  const rows=historicalRows().map(r=>({v:r.income?Math.max(-100,Math.min(100,r.profit/r.income*100)):0,label:r.date.slice(5)}));
  drawHistoricalLine("marginChart",rows,getCss("--warning"));
}
function drawActivityChart(){
  const ds=rangeDates(),vals=ds.map(d=>({v:state.transactions.filter(x=>x.date===d).length+state.sales.filter(x=>x.date===d).length,label:d.slice(5)}));
  drawHistoricalLine("activityChart",vals,getCss("--success"));
}
function getCss(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()}
function drawAll(){drawLineChart();drawDonut();drawBars();drawBalanceChart();drawCashflowChart();drawMarginChart();drawActivityChart()}
window.addEventListener("resize",drawAll);

function updateClock(){
  const now=new Date();
  $("#liveClock").textContent=now.toLocaleTimeString("en-IN",{hour12:false});
  $("#liveDate").textContent=now.toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
}
updateClock();setInterval(updateClock,1000);

document.querySelectorAll("#rangeTabs button").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll("#rangeTabs button").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");chartRange=btn.dataset.range;drawAll();toast(`Showing ${btn.textContent} history`);
});

$("#exportCsvBtn").onclick=()=>{
  const rows=[["Date","Time","Type","Category","Description","Amount"],...state.transactions.map(x=>[x.date,x.time,x.type,x.category,x.description,x.amount])];
  const csv=rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`kharchatrack-${today()}.csv`;a.click();URL.revokeObjectURL(a.href);toast("CSV exported")
};
$("#reportBtn").onclick=()=>{
  const t=totals(), sales=todaySales(), tx=todayTx();
  const w=window.open("","_blank");if(!w){toast("Allow pop-ups to generate the report");return}
  w.document.write(`<html><head><title>KharchaTRACK Daily Report</title><style>body{font:14px Arial;padding:40px;color:#172033}h1{margin-bottom:4px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.box{padding:16px;border:1px solid #ddd;border-radius:10px}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{padding:9px;border-bottom:1px solid #ddd;text-align:left}@media print{button{display:none}}</style></head><body><h1>KharchaTRACK</h1><p>Daily report · ${today()}</p><div class="grid"><div class="box"><b>Income</b><h2>${money(t.income)}</h2></div><div class="box"><b>Expense</b><h2>${money(t.expenses)}</h2></div><div class="box"><b>Net Profit</b><h2>${money(t.profit)}</h2></div></div><h2>Sales (${sales.length})</h2><table><tr><th>Item</th><th>Qty</th><th>Revenue</th><th>Profit</th></tr>${sales.map(s=>`<tr><td>${escape(s.itemName)}</td><td>${s.quantity}</td><td>${money(s.sellingPrice*s.quantity)}</td><td>${money((s.sellingPrice-s.costPrice)*s.quantity)}</td></tr>`).join("")}</table><h2>Transactions (${tx.length})</h2><table><tr><th>Type</th><th>Category</th><th>Description</th><th>Amount</th></tr>${tx.map(x=>`<tr><td>${x.type}</td><td>${escape(x.category)}</td><td>${escape(x.description)}</td><td>${money(x.amount)}</td></tr>`).join("")}</table><br><button onclick="print()">Print / Save as PDF</button></body></html>`);w.document.close()
};
$("#clearBtn").onclick=()=>{if(confirm("Clear all KharchaTRACK data? This cannot be undone.")){localStorage.removeItem(KEY);state=load();render();drawAll();toast("All data cleared")}};
render();drawAll();

let calcExpr="";
state.notes=state.notes||"";state.calcLog=state.calcLog||[];
function renderNotes(){const n=document.querySelector("#notesPad");if(n&&document.activeElement!==n)n.value=state.notes||""}
function renderCalcLog(){const e=document.querySelector("#calcLog");if(!e)return;e.innerHTML=(state.calcLog||[]).slice(-20).reverse().map(x=>`<div class="calc-log-row"><span>${escape(x.expression)}</span><b>${escape(x.result)}</b></div>`).join("")||'<div class="empty">Calculations will appear here.</div>'}
function safeCalc(s){if(!/^[0-9+\-*/%.()\s]+$/.test(s))return null;try{const v=Function('"use strict";return ('+s+')')();return Number.isFinite(v)?String(Math.round(v*100000000)/100000000):null}catch{return null}}
function calcRefresh(){const r=safeCalc(calcExpr);document.querySelector("#calcExpression").textContent=calcExpr||"0";document.querySelector("#calcResult").textContent=r??"—"}
function addCalcLog(expr,result){state.calcLog.push({expression:expr,result,date:new Date().toISOString()});state.notes=(state.notes||"")+`\n[${new Date().toLocaleTimeString()}] ${expr} = ${result}`;save();renderNotes();renderCalcLog()}
document.querySelector("#notesPad")?.addEventListener("input",e=>{state.notes=e.target.value;save()});
document.querySelector("#clearCalcLog")?.addEventListener("click",()=>{state.calcLog=[];save();renderCalcLog()});
document.querySelectorAll("[data-calc]").forEach(b=>b.addEventListener("click",()=>{const v=b.dataset.calc;if(v==="clear"){calcExpr=""}else if(v==="back"){calcExpr=calcExpr.slice(0,-1)}else if(v==="="){const r=safeCalc(calcExpr);if(r!==null){addCalcLog(calcExpr,r);calcExpr=r}}else if(v==="%"){calcExpr+="/100"}else calcExpr+=v;calcRefresh()}));
renderNotes();renderCalcLog();
