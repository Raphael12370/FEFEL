const COLORS=['#f0b429','#00d4ff','#a78bfa','#06d6a0','#ff6b6b','#fb923c','#f472b6','#34d399'];
const SK='painel_v2';
let NID=100,opType='compra',editId=null,toastTimer=null;

function loadState(){try{return JSON.parse(localStorage.getItem(SK));}catch{return null;}}
function saveState(){try{localStorage.setItem(SK,JSON.stringify(state));}catch{}}

let state=loadState()||{apiKey:'',claudeKey:'',stocks:[],setupDone:false};
if(!state.claudeKey)state.claudeKey='';

const f2=v=>(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fp=v=>(v>=0?'+':'')+((+v).toFixed(2))+'%';
const $=id=>document.getElementById(id);
const abs=Math.abs;

function showToast(msg){const el=$('toast');el.textContent=msg;el.style.display='block';if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.style.display='none',3500);}

/* ── INIT ── */
window.addEventListener('DOMContentLoaded',()=>{
if(!state.setupDone){
showSetup();
} else {
hideSetup();
if(state.apiKey){
$('api-key-input').placeholder='✅ Chave brapi salva';
$('api-banner').style.borderColor='var(--green)';
}
if(state.claudeKey){
$('claude-key-input').placeholder='✅ Chave Claude salva';
$('claude-banner').style.borderColor='var(--green)';
}
renderAll();
}
});

/* ── SETUP SCREEN ── */
function showSetup(){
$('setup-screen').style.display='flex';
$('main-content').style.display='none';
}
function hideSetup(){
$('setup-screen').style.display='none';
$('main-content').style.display='block';
}

let setupStocks=[];

function addSetupRow(){
const id=Date.now();
setupStocks.push({id});
const div=document.createElement('div');
div.id='row-'+id;
div.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center';
div.innerHTML=`<input type="text" placeholder="Ticker (ex: PETR4)" oninput="this.value=this.value.toUpperCase()" style="background:#07111f;border:1px solid #1a2840;border-radius:7px;color:#dde;padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;width:100%"/> <input type="number" step="1" placeholder="Quantidade" style="background:#07111f;border:1px solid #1a2840;border-radius:7px;color:#dde;padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;width:100%"/> <input type="number" step="0.01" placeholder="Preco Medio R$" style="background:#07111f;border:1px solid #1a2840;border-radius:7px;color:#dde;padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;width:100%"/> <button onclick="removeSetupRow(${id})" style="background:transparent;border:none;color:#ff6b6b88;font-size:18px;cursor:pointer;padding:4px 8px">x</button>`;
$('setup-rows').appendChild(div);
}

function removeSetupRow(id){
setupStocks=setupStocks.filter(s=>s.id!==id);
const el=$('row-'+id);
if(el)el.remove();
}

function finishSetup(){
const rows=$('setup-rows').children;
const stocks=[];
let hasError=false;
for(const row of rows){
const inputs=row.querySelectorAll('input');
const ticker=inputs[0].value.trim().toUpperCase();
const qty=parseFloat(inputs[1].value);
const pm=parseFloat(inputs[2].value.replace(',','.'));
if(!ticker||isNaN(qty)||isNaN(pm)||qty<=0||pm<=0){hasError=true;break;}
stocks.push({id:NID++,ticker,name:ticker,qty,pm,price:null,chg:null,target:null});
}
if(hasError){showToast('Preencha todos os campos corretamente.');return;}
if(stocks.length===0){showToast('Adicione pelo menos uma acao.');return;}
state.stocks=stocks;
state.setupDone=true;
saveState();
hideSetup();
renderAll();
showToast('Carteira criada! Bem-vindo ao Painel.');
}

/* ── API KEY brapi.dev ── */
function saveApiKey(){
const k=$('api-key-input').value.trim();
if(!k){showToast('Digite sua chave brapi.dev');return;}
state.apiKey=k;saveState();
$('api-key-input').value='';
$('api-key-input').placeholder='Chave salva!';
$('api-banner').style.borderColor='var(--green)';
showToast('Chave brapi salva! Clique em Atualizar Cotacoes.');
}

/* ── CLAUDE API KEY ── */
function saveClaudeKey(){
const k=$('claude-key-input').value.trim();
if(!k){showToast('Digite sua chave Claude API');return;}
state.claudeKey=k;saveState();
$('claude-key-input').value='';
$('claude-key-input').placeholder='Chave Claude salva!';
$('claude-banner').style.borderColor='var(--green)';
showToast('Chave Claude salva! Agora voce pode usar o Jornal.');
}

/* ── TABS ── */
function switchTab(name){
['carteira','jornal','operacao'].forEach((t,i)=>{
$('tab-'+t).style.display=t===name?'block':'none';
document.querySelectorAll('.tab')[i].classList.toggle('active',t===name);
});
if(name==='operacao')renderOpPositions();
}

/* ── FETCH PRICES ── */
async function fetchAllPrices(){
if(!state.apiKey){showToast('Configure sua chave brapi.dev!');return;}
const btn=$('btn-update');btn.disabled=true;btn.innerHTML='<span class="spin">⟳</span> Buscando...';
for(const s of state.stocks)await fetchOne(s);
btn.disabled=false;btn.textContent='Atualizar Cotacoes';
$('last-update').textContent='Atualizado as '+new Date().toLocaleTimeString('pt-BR');
saveState();renderAll();
}

async function fetchOne(stock){
try{
const url=`https://brapi.dev/api/quote/${stock.ticker}?token=${state.apiKey}&fundamental=true`;
const res=await fetch(url);const data=await res.json();
const q=data.results&&data.results[0];
if(q&&q.regularMarketPrice!=null){
stock.price=q.regularMarketPrice;
stock.chg=q.regularMarketChangePercent??null;
if(q.targetMeanPrice)stock.target=q.targetMeanPrice;
if(q.shortName&&!stock.nameEdited)stock.name=q.shortName;
}else showToast('Sem dados para '+stock.ticker);
}catch(e){showToast('Erro: '+stock.ticker);}
}

async function refreshOne(id){
if(!state.apiKey){showToast('Configure sua chave!');return;}
const s=state.stocks.find(x=>x.id===id);if(!s)return;
await fetchOne(s);saveState();renderAll();showToast(s.ticker+' atualizado!');
}

/* ── RENDER ── */
function renderAll(){renderCards();renderPie();renderTable();}

function totals(){
const inv=state.stocks.reduce((a,s)=>a+s.pm*s.qty,0);
const atual=state.stocks.reduce((a,s)=>a+(s.price||s.pm)*s.qty,0);
const rBRL=atual-inv;const rPct=inv>0?rBRL/inv*100:0;
return{inv,atual,rBRL,rPct};
}

function renderCards(){
const t=totals();const anyP=state.stocks.some(s=>s.price!=null);
$('c-inv').textContent='R$ '+f2(t.inv);
$('c-atual').textContent=anyP?'R$ '+f2(t.atual):'--';
$('c-atual').className='card-value '+(anyP?'gold':'muted');
const rb=$('c-rbrl'),rp=$('c-rpct');
rb.textContent=anyP?(t.rBRL>=0?'+':'-')+'R$ '+f2(abs(t.rBRL)):'--';
rp.textContent=anyP?fp(t.rPct):'--';
rb.className='card-value '+(anyP?(t.rBRL>=0?'green':'red'):'muted');
rp.className='card-value '+(anyP?(t.rPct>=0?'green':'red'):'muted');
}

function pol(r,d){const rad=d*Math.PI/180;return[(100+r*Math.cos(rad)).toFixed(2),(100+r*Math.sin(rad)).toFixed(2)];}

function renderPie(){
const total=state.stocks.reduce((a,s)=>a+(s.price||s.pm)*s.qty,0);
const svg=$('pie-svg');const leg=$('pie-legend');
svg.innerHTML='';leg.innerHTML='';if(!total)return;
let a=-90;
state.stocks.forEach((s,i)=>{
const val=(s.price||s.pm)*s.qty,pct=val/total,sa=a,ea=a+pct*360;a=ea;
const c=COLORS[i%COLORS.length];
if(pct>=0.9999){svg.innerHTML+=`<circle cx="100" cy="100" r="70" fill="${c}"/>`;}
else{const lg=ea-sa>180?1:0;const[x1,y1]=pol(70,sa),[x2,y2]=pol(70,ea);svg.innerHTML+=`<path d="M100 100L${x1} ${y1}A70 70 0 ${lg} 1 ${x2} ${y2}Z" fill="${c}" stroke="#07111f" stroke-width="3"/>`;}
leg.innerHTML+=`<div class="pie-leg"><div class="pie-dot" style="background:${c}"></div><span style="color:${c};font-weight:700">${s.ticker}</span><span class="muted">${(pct*100).toFixed(1)}%</span><span style="color:#2a3a50;font-size:10px">R$${(val/1000).toFixed(1)}k</span></div>`;
});
svg.innerHTML+=`<circle cx="100" cy="100" r="40" fill="#07111f"/><text x="100" y="94" text-anchor="middle" fill="#445" font-size="9" font-family="monospace">TOTAL</text><text x="100" y="113" text-anchor="middle" fill="#f0b429" font-size="12" font-family="monospace" font-weight="bold">R$${(total/1000).toFixed(0)}k</text>`;
}

function renderTable(){
const tbody=$('stocks-body');
if(!state.stocks.length){tbody.innerHTML=`<tr><td colspan="12" style="text-align:center;padding:36px;color:var(--muted)">Nenhuma acao cadastrada.</td></tr>`;return;}
tbody.innerHTML=state.stocks.map((s,i)=>{
const cur=s.price||s.pm,inv=s.pm*s.qty,atual=cur*s.qty,rBRL=atual-inv,rPct=(rBRL/inv)*100;
const up=(s.target&&s.price)?(s.target-s.price)/s.price*100:null;
const hasP=s.price!=null,c=COLORS[i%COLORS.length];
return`<tr> <td><span style="color:${c};font-weight:700;font-size:13px">${s.ticker}</span><br><span class="muted" style="font-size:10px">${s.name}</span></td> <td>${s.qty.toLocaleString('pt-BR')}</td> <td>R$ ${f2(s.pm)}</td> <td class="bold ${hasP?(s.price>=s.pm?'green':'red'):'muted'}" style="font-size:13px">${hasP?'R$ '+f2(s.price):'--'}</td> <td class="bold ${s.chg!=null?(s.chg>=0?'green':'red'):'muted'}">${s.chg!=null?fp(s.chg):'--'}</td> <td class="muted">${s.target?'R$ '+f2(s.target):'--'}</td> <td class="bold ${up!=null?(up>=0?'green':'red'):'muted'}">${up!=null?fp(up):'--'}</td> <td class="muted">R$ ${f2(inv)}</td> <td class="bold">${hasP?'R$ '+f2(atual):'--'}</td> <td class="bold ${hasP?(rBRL>=0?'green':'red'):'muted'}">${hasP?(rBRL>=0?'+':'-')+'R$ '+f2(abs(rBRL)):'--'}</td> <td class="bold ${hasP?(rPct>=0?'green':'red'):'muted'}">${hasP?fp(rPct):'--'}</td> <td style="white-space:nowrap"> <button class="icon-btn gold" onclick="refreshOne(${s.id})" title="Atualizar">&#8635;</button> <button class="icon-btn muted" onclick="openEditModal(${s.id})" title="Editar">&#9998;</button> <button class="icon-btn" style="color:#ff6b6b55" onclick="removeStock(${s.id})" title="Remover">x</button> </td> </tr>`;
}).join('');
}

function removeStock(id){
if(!confirm('Remover esta acao?'))return;
state.stocks=state.stocks.filter(s=>s.id!==id);
saveState();renderAll();showToast('Removido.');
}

/* ── MODAL ADD/EDIT ── */
function openAddModal(){editId=null;$('modal-title').textContent='Nova Acao';['m-ticker','m-name','m-qty','m-pm'].forEach(id=>$(id).value='');$('modal').style.display='flex';}
function openEditModal(id){
editId=id;const s=state.stocks.find(x=>x.id===id);
$('modal-title').textContent='Editar Acao';
$('m-ticker').value=s.ticker;$('m-name').value=s.name;$('m-qty').value=s.qty;$('m-pm').value=s.pm;
$('modal').style.display='flex';
}
function closeModal(){$('modal').style.display='none';}
function saveModal(){
const ticker=$('m-ticker').value.trim().toUpperCase(),name=$('m-name').value.trim();
const qty=parseFloat($('m-qty').value),pm=parseFloat($('m-pm').value.replace(',','.'));
if(!ticker||isNaN(qty)||isNaN(pm)||qty<=0||pm<=0){showToast('Preencha todos os campos.');return;}
if(editId){
const s=state.stocks.find(x=>x.id===editId);
Object.assign(s,{ticker,name:name||ticker,qty,pm,nameEdited:!!name,price:null,chg:null});
showToast('Atualizado!');
}else{
state.stocks.push({id:NID++,ticker,name:name||ticker,qty,pm,price:null,chg:null,target:null});
showToast('Adicionado!');
}
saveState();renderAll();closeModal();
}

/* ── OPERACAO ── */
function setOpType(t){
opType=t;
const gc=$('tog-compra'),rv=$('tog-venda');
gc.style.background=t==='compra'?'var(--green)':'var(--bg3)';
gc.style.color=t==='compra'?'#07111f':'var(--muted)';
gc.style.border=t==='compra'?'none':'1px solid #06d6a055';
rv.style.background=t==='venda'?'var(--red)':'var(--bg3)';
rv.style.color=t==='venda'?'#07111f':'var(--muted)';
rv.style.border=t==='venda'?'none':'1px solid #ff6b6b55';
const btn=$('btn-confirm-op');
btn.style.background=t==='compra'?'var(--green)':'var(--red)';
btn.textContent=t==='compra'?'Confirmar Compra':'Confirmar Venda';
updatePreview();
}

function renderOpPositions(){
const el=$('op-positions'),chips=$('op-chips');el.innerHTML='';chips.innerHTML='';
state.stocks.forEach((s,i)=>{
const c=COLORS[i%COLORS.length];
el.innerHTML+=`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:${i<state.stocks.length-1?'1px solid var(--border)':'none'}"><span style="color:${c};font-weight:700;font-family:'IBM Plex Mono',monospace">${s.ticker}</span><span class="muted" style="font-family:'IBM Plex Mono',monospace;font-size:11px">${s.qty.toLocaleString('pt-BR')} acoes · PM R$${f2(s.pm)}</span></div>`;
chips.innerHTML+=`<button class="chip" style="background:${c}22;color:${c};border:1px solid ${c}44" onclick="$('op-ticker').value='${s.ticker}';updatePreview()">${s.ticker}</button>`;
});
}

function updatePreview(){
const ticker=$('op-ticker').value.trim().toUpperCase(),qty=parseFloat($('op-qty').value),price=parseFloat($('op-price').value),el=$('op-preview');
if(!ticker||isNaN(qty)||isNaN(price)||qty<=0||price<=0){el.style.display='none';return;}
const exist=state.stocks.find(s=>s.ticker===ticker);
let html=`${opType==='compra'?'[+]':'[-]'} <strong style="color:#fff">${qty} ${ticker}</strong> @ <span class="gold">R$${f2(price)}</span><br>Total: <strong style="color:#fff">R$${f2(qty*price)}</strong>`;
if(opType==='compra'&&exist){const nq=exist.qty+qty,np=(exist.pm*exist.qty+price*qty)/nq;html+=`<br>Novo PM: <span class="gold">R$${f2(np)}</span> | Total: <span style="color:var(--text)">${nq.toLocaleString('pt-BR')} acoes</span>`;}
el.innerHTML=html;el.style.display='block';
}

function confirmOp(){
const ticker=$('op-ticker').value.trim().toUpperCase(),qty=parseFloat($('op-qty').value),price=parseFloat($('op-price').value.replace(',','.')),msgEl=$('op-msg');
if(!ticker||isNaN(qty)||isNaN(price)||qty<=0||price<=0){msgEl.innerHTML=msg_(false,'Preencha todos os campos.');return;}
const exist=state.stocks.find(s=>s.ticker===ticker);
let ok=true,txt='';
if(opType==='compra'){
if(exist){const nq=exist.qty+qty,np=(exist.pm*exist.qty+price*qty)/nq;exist.qty=nq;exist.pm=+np.toFixed(4);exist.price=null;exist.chg=null;txt=`+${qty} ${ticker} @ R$${f2(price)} | Novo PM: R$${f2(np)} | Total: ${nq.toLocaleString('pt-BR')} acoes`;}
else{state.stocks.push({id:NID++,ticker,name:ticker,qty,pm:price,price:null,chg:null,target:null});txt=`${ticker} adicionado! ${qty} acoes @ R$${f2(price)}`;}
}else{
if(!exist){ok=false;txt=`Voce nao tem ${ticker}.`;}
else if(qty>exist.qty){ok=false;txt=`Voce so tem ${exist.qty} acoes.`;}
else{const gain=(price-exist.pm)*qty,rem=exist.qty-qty;if(rem===0)state.stocks=state.stocks.filter(s=>s.ticker!==ticker);else{exist.qty=rem;exist.price=null;exist.chg=null;}txt=`Venda: ${qty} ${ticker} @ R$${f2(price)} | Resultado: ${gain>=0?'+':''}R$${f2(gain)} | Restam ${rem}`;}
}
msgEl.innerHTML=msg_(ok,txt);
if(ok){saveState();renderAll();renderOpPositions();$('op-ticker').value='';$('op-qty').value='';$('op-price').value='';$('op-preview').style.display='none';}
}

function msg_(ok,txt){return`<div class="msg-box" style="background:${ok?'#06d6a011':'#ff6b6b11'};border:1px solid ${ok?'#06d6a044':'#ff6b6b44'};color:${ok?'var(--green)':'var(--red)'}">${txt}</div>`;}

/* ── JOURNAL ── */
async function fetchJournal(){
if(!state.claudeKey){
showToast('Configure sua chave Claude API primeiro!');
switchTab('carteira');
setTimeout(()=>$('claude-key-input').focus(),100);
return;
}
const btn=$('btn-journal');
btn.disabled=true;
btn.innerHTML='<span class="spin">&#8635;</span> Gerando...';
$('journal-date').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
$('journal-content').innerHTML=`<div class="spinning-wrap"><div class="spin" style="font-size:30px">&#8635;</div><div style="color:var(--muted);margin-top:16px;font-size:12px;line-height:2">Buscando noticias e relatorios...<br>Aguarde ~30 segundos.</div></div>`;
const stocksPrompt=state.stocks.map(s=>`${s.ticker} - ${s.name.toUpperCase()}\nNoticias recentes, resultados financeiros com numeros, recomendacao de analistas e preco-alvo.`).join('\n\n');
try{
const res=await fetch('https://api.anthropic.com/v1/messages',{
method:'POST',
headers:{
'Content-Type':'application/json',
'x-api-key':state.claudeKey,
'anthropic-version':'2023-06-01',
'anthropic-dangerous-direct-browser-access':'true'
},
body:JSON.stringify({
model:'claude-sonnet-4-20250514',
max_tokens:4000,
tools:[{type:'web_search_20250305',name:'web_search'}],
messages:[{role:'user',content:`Voce e um analista financeiro senior. Pesquise noticias de hoje e gere um briefing em portugues com estas secoes (use os titulos exatos em maiusculas):\n\nMERCADO HOJE\nResumo do Ibovespa: pontuacao, variacao, destaques do dia.\n\nCENARIO BRASIL\nSELIC, inflacao, cambio, politica fiscal.\n\nCENARIO GLOBAL\nFed, China, commodities, impactos no Brasil.\n\n${stocksPrompt}\n\nData atual: ${new Date().toLocaleDateString('pt-BR')}. Seja especifico com numeros e cite fontes.`}]
})
});
const data=await res.json();
if(data.error){
$('journal-content').innerHTML=`<div class="j-section" style="border-left:3px solid var(--red)"><div class="j-title" style="color:var(--red)">Erro da API</div><p class="j-text">${data.error.message||'Erro desconhecido. Verifique sua chave Claude.'}</p></div>`;
}else{
const text=(data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
if(text&&text.length>100){
renderJournal(text);
}else{
$('journal-content').innerHTML=`<div class="j-section" style="border-left:3px solid var(--red)"><div class="j-title" style="color:var(--red)">Resposta vazia</div><p class="j-text">A API retornou uma resposta inesperada. Tente novamente.</p></div>`;
}
}
}catch(e){
$('journal-content').innerHTML=`<div class="j-section" style="border-left:3px solid var(--red)"><div class="j-title" style="color:var(--red)">Erro de conexao</div><p class="j-text">${e.message}</p></div>`;
}
btn.disabled=false;
btn.textContent='Gerar / Atualizar Jornal';
}

function renderJournal(text){
const SEC_DEFS=[
{key:'MERCADO HOJE',color:'#f0b429',icon:'[M]'},
{key:'CENARIO BRASIL',color:'#00d4ff',icon:'[BR]'},
{key:'CENARIO GLOBAL',color:'#a78bfa',icon:'[GL]'},
...state.stocks.map((s,i)=>({key:s.ticker,color:COLORS[i%COLORS.length],icon:'[A]',stock:s}))
];
const lines=text.split('\n');
const sections=[];
let cur=null;
for(const line of lines){
const up=line.trim().toUpperCase();
const def=SEC_DEFS.find(d=>up.startsWith(d.key));
if(def){if(cur)sections.push(cur);cur={def,title:line.trim(),body:[]};}
else if(cur)cur.body.push(line);
}
if(cur)sections.push(cur);
if(!sections.length){
$('journal-content').innerHTML=`<div class="j-section"><p class="j-text">${text.replace(/\n/g,'<br>')}</p></div>`;
return;
}
$('journal-content').innerHTML=sections.map(sec=>{
const bodyText=sec.body.join('\n').trim().replace(/\n/g,'<br>');
if(sec.def.stock){
const s=sec.def.stock,c=sec.def.color;
return`<div class="j-company"><div class="j-company-head"><div class="j-chip" style="background:${c}22;border:1px solid ${c}44;color:${c}">${s.ticker}</div><div><div style="font-weight:700;color:#fff;font-size:14px">${s.name}</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Analise detalhada</div></div></div><div class="j-company-body"><p class="j-text">${bodyText}</p></div></div>`;
}
return`<div class="j-section" style="border-left:3px solid ${sec.def.color}"><div class="j-title" style="color:${sec.def.color}">${sec.def.icon} ${sec.title}</div><p class="j-text">${bodyText}</p></div>`;
}).join('');
}

/* ── RESET ── */
function resetApp(){
if(!confirm('Apagar todos os seus dados e comecar do zero?'))return;
localStorage.removeItem(SK);
location.reload();
}
