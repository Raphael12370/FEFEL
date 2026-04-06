const COLORS=['#f0b429','#00d4ff','#a78bfa','#06d6a0','#ff6b6b','#fb923c','#f472b6','#34d399'];
const SK='painel_v2';
let NID=100,opType='compra',editId=null,toastTimer=null;

function loadState(){try{return JSON.parse(localStorage.getItem(SK));}catch{return null;}}
function saveState(){try{localStorage.setItem(SK,JSON.stringify(state));}catch{}}

let state=loadState()||{stocks:[],setupDone:false};

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
const inp='background:#000;border:1px solid #38383a;border-radius:10px;color:#fff;padding:11px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:13px;outline:none;width:100%;transition:border-color .15s';
div.innerHTML=`<input type="text" placeholder="Ticker (ex: PETR4)" oninput="this.value=this.value.toUpperCase()" style="${inp}"/> <input type="number" step="1" placeholder="Quantidade" style="${inp}"/> <input type="number" step="0.01" placeholder="Preco Medio R$" style="${inp}"/> <button onclick="removeSetupRow(${id})" style="background:transparent;border:none;color:#ff453a88;font-size:20px;cursor:pointer;padding:4px 10px;line-height:1">×</button>`;
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


/* ── TABS ── */
function switchTab(name){
['carteira','jornal','noticias','operacao'].forEach((t,i)=>{
$('tab-'+t).style.display=t===name?'block':'none';
document.querySelectorAll('.tab')[i].classList.toggle('active',t===name);
});
if(name==='operacao')renderOpPositions();
}

/* ── FETCH PRICES ── */
async function fetchAllPrices(){
const btn=$('btn-update');btn.disabled=true;btn.innerHTML='<span class="spin">⟳</span> Buscando...';
for(const s of state.stocks)await fetchOne(s);
btn.disabled=false;btn.textContent='Atualizar Cotacoes';
$('last-update').textContent='Atualizado as '+new Date().toLocaleTimeString('pt-BR');
saveState();renderAll();
}

async function fetchOne(stock){
try{
const res=await fetch(`/api/quotes?ticker=${encodeURIComponent(stock.ticker)}`);const data=await res.json();
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
const J_TABS=['global','relatorios','empresas','macro'];
let jActiveTab='global';

const TICKER_DOMAINS={
PETR4:'petrobras.com.br',PETR3:'petrobras.com.br',
VALE3:'vale.com',VALE5:'vale.com',
MGLU3:'magazineluiza.com.br',
ITUB4:'itau.com.br',ITUB3:'itau.com.br',ITSA4:'itausa.com.br',ITSA3:'itausa.com.br',
BBDC4:'bradesco.com.br',BBDC3:'bradesco.com.br',
ABEV3:'ambev.com.br',
WEGE3:'weg.net',
RENT3:'localiza.com',
LREN3:'lojasrenner.com.br',
JBSS3:'jbs.com.br',
GGBR4:'gerdau.com',GGBR3:'gerdau.com',
BPAC11:'btgpactual.com',
RADL3:'raia.com.br',
BRFS3:'brf-global.com',
MRVE3:'mrv.com.br',
BBAS3:'bb.com.br',
SANB11:'santander.com.br',
SUZB3:'suzano.com.br',
EMBR3:'embraer.com',
TOTS3:'totvs.com',
PRIO3:'prioil.com.br',
DIRR3:'direcional.com.br',
KLBN11:'klabin.com.br',
CMIG4:'cemig.com.br',
ELET3:'eletrobras.com.br',ELET6:'eletrobras.com.br',
VIVT3:'vivo.com.br',
TIMS3:'tim.com.br',
COGN3:'cogna.com.br',
FLRY3:'fleury.com.br',
AZUL4:'voeazul.com.br',
GOLL4:'voegol.com.br',
CYRE3:'cyrela.com.br',
BEEF3:'minervafoods.com',
HAPV3:'hapvida.com.br',
};

function getLogoUrl(ticker,name){
const domain=TICKER_DOMAINS[ticker];
if(domain)return`https://logo.clearbit.com/${domain}`;
const first=(name||ticker).split(' ')[0].toLowerCase().replace(/[^a-z]/g,'');
return`https://logo.clearbit.com/${first}.com.br`;
}

const J_SEC_META={
global:{
'GEOPOLITICA':{tag:'Geopolitica',color:'#ff9f0a',hero:'j-hero-global'},
'BANCOS CENTRAIS':{tag:'Bancos Centrais',color:'#5ac8fa',hero:'j-hero-global'},
'COMMODITIES':{tag:'Commodities',color:'#30d158',hero:'j-hero-global'},
'CHINA':{tag:'China',color:'#ff453a',hero:'j-hero-global'},
'IMPACTOS NO BRASIL':{tag:'Impactos no Brasil',color:'#bf5af2',hero:'j-hero-global'},
},
macro:{
'IBOVESPA':{tag:'Ibovespa',color:'#ff9f0a',hero:'j-hero-macro'},
'SELIC E JUROS':{tag:'Juros & SELIC',color:'#5ac8fa',hero:'j-hero-macro'},
'INFLACAO':{tag:'Inflacao',color:'#ff453a',hero:'j-hero-macro'},
'CAMBIO':{tag:'Cambio',color:'#30d158',hero:'j-hero-macro'},
'POLITICA FISCAL':{tag:'Politica Fiscal',color:'#bf5af2',hero:'j-hero-macro'},
'DADOS DO DIA':{tag:'Indicadores',color:'#ff9f0a',hero:'j-hero-macro'},
}
};

function switchJournalTab(type){
jActiveTab=type;
J_TABS.forEach(t=>{
$('jc-'+t).style.display=t===type?'block':'none';
$('jt-'+t).classList.toggle('active',t===type);
});
}

async function fetchJournal(){
const btn=$('btn-journal');
btn.disabled=true;
btn.innerHTML='<span class="spin">&#8635;</span> Gerando...';
$('journal-date').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
J_TABS.forEach(t=>setJLoading(t));
await Promise.all(J_TABS.map(t=>fetchJSection(t)));
btn.disabled=false;
btn.textContent='Gerar / Atualizar Jornal';
}

function setJLoading(type){
$('jc-'+type).innerHTML=`<div class="spinning-wrap"><div class="spin" style="font-size:28px">&#8635;</div><div style="color:var(--muted);margin-top:14px;font-size:12px;line-height:2">Buscando dados...<br>Aguarde ~30 segundos.</div></div>`;
}

async function fetchJSection(type){
try{
const res=await fetch('/api/journal',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({type,stocks:state.stocks.map(s=>({ticker:s.ticker,name:s.name})),date:new Date().toLocaleDateString('pt-BR')})
});
const data=await res.json();
if(data.error){
$('jc-'+type).innerHTML=`<div class="j-error"><div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--red);margin-bottom:10px">Erro</div><p class="j-text">${data.error.message||data.error}</p></div>`;
}else{
const text=(data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
if(text&&text.length>50)renderJSection(type,text);
else $('jc-'+type).innerHTML=`<div class="j-error" style="border-color:#ff9f0a44"><p class="j-text">Nenhum conteudo retornado. Tente novamente.</p></div>`;
}
}catch(e){
$('jc-'+type).innerHTML=`<div class="j-error"><div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--red);margin-bottom:10px">Erro de Conexao</div><p class="j-text">${e.message}</p></div>`;
}
}

function renderJSection(type,text){
const isCompany=type==='relatorios'||type==='empresas';
const subtitle=type==='relatorios'?'Relatorios Trimestrais':'Noticias do Dia';
const heroClass=type==='empresas'?'j-hero-empresas':'j-hero-relatorios';
const meta=J_SEC_META[type]||{};
const defs=isCompany
?state.stocks.map((s,i)=>({key:s.ticker,color:COLORS[i%COLORS.length],stock:s}))
:Object.entries(meta).map(([key,m])=>({key,...m}));

const lines=text.split('\n');
const sections=[];
let cur=null;
for(const line of lines){
const up=line.trim().toUpperCase();
const def=defs.find(d=>up.startsWith(d.key));
if(def){if(cur)sections.push(cur);cur={def,title:line.trim(),body:[]};}
else if(cur)cur.body.push(line);
}
if(cur)sections.push(cur);

const date=$('journal-date').textContent||new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'});

if(!sections.length){
$('jc-'+type).innerHTML=`<div class="j-article"><div class="j-article-body"><p class="j-text">${text.replace(/\n/g,'<br>')}</p></div></div>`;
return;
}

$('jc-'+type).innerHTML=sections.map(sec=>{
const body=sec.body.join('\n').trim().replace(/\n/g,'<br>');

if(sec.def.stock){
const s=sec.def.stock,c=sec.def.color;
const logoUrl=getLogoUrl(s.ticker,s.name);
const fbId='fb-'+s.ticker+'-'+type;
return`<div class="j-article">
<div class="j-company-header" style="border-left:4px solid ${c}">
<div class="j-company-logo-wrap">
<img class="j-company-logo" src="${logoUrl}" alt="${s.ticker}" onerror="this.style.display='none';document.getElementById('${fbId}').style.display='flex'"/>
<div class="j-company-logo-fallback" id="${fbId}" style="background:${c}22;color:${c}">${s.ticker.slice(0,4)}</div>
</div>
<div class="j-company-info">
<div class="j-company-ticker" style="color:${c}">${s.ticker}</div>
<div class="j-company-fullname">${s.name}</div>
<div class="j-company-badge" style="background:${c}15;color:${c}">${subtitle}</div>
</div>
</div>
<div class="j-article-body">
<div class="j-divider" style="background:${c}"></div>
<p class="j-text">${body}</p>
</div>
</div>`;
}

const c=sec.def.color||'#ff9f0a';
const tag=sec.def.tag||sec.title;
const hero=sec.def.hero||heroClass;
return`<div class="j-article">
<div class="j-article-hero ${hero}">
<span class="j-article-tag" style="background:${c}20;color:${c};border:1px solid ${c}40">${tag}</span>
<div class="j-article-headline">${sec.title}</div>
<div class="j-article-meta">${date} &nbsp;·&nbsp; Briefing Diario</div>
</div>
<div class="j-article-body">
<div class="j-divider" style="background:${c}"></div>
<p class="j-text">${body}</p>
</div>
</div>`;
}).join('');
}

/* ── NEWS ── */
const SECTORS_LIST=['bancos','energia','mineracao','varejo','utilities'];
const SECTOR_META={
bancos:{label:'Bancos & Financas',color:'#0a84ff'},
energia:{label:'Energia & Petroleo',color:'#ff9f0a'},
mineracao:{label:'Mineracao & Agro',color:'#30d158'},
varejo:{label:'Varejo & Consumo',color:'#ff453a'},
utilities:{label:'Utilities',color:'#bf5af2'}
};

let newsExpanded={global:true,setores:true,carteira:true};
let newsAutoTimer=null;

function toggleNSec(key){
newsExpanded[key]=!newsExpanded[key];
$('nsb-'+key).style.display=newsExpanded[key]?'block':'none';
$('nchev-'+key).innerHTML=newsExpanded[key]?'&#9650;':'&#9660;';
}

function toggleNewsAuto(){
if(newsAutoTimer){
clearInterval(newsAutoTimer);newsAutoTimer=null;
$('btn-news-auto').textContent='Auto 30min';
$('btn-news-auto').className='btn btn-ghost';
}else{
newsAutoTimer=setInterval(fetchAllNews,30*60*1000);
$('btn-news-auto').textContent='Auto: Ativo';
$('btn-news-auto').className='btn btn-outline';
}
}

function setNLoading(id){
$('nsb-'+id).innerHTML=[1,2,3].map(()=>`<div class="news-skeleton"><div class="sk-line" style="width:55%"></div><div class="sk-line" style="width:100%"></div><div class="sk-line" style="width:75%"></div><div class="sk-line" style="width:90%"></div></div>`).join('');
}

async function fetchAllNews(){
const btn=$('btn-news-update');
btn.disabled=true;btn.innerHTML='<span class="spin">&#8635;</span> Buscando...';
setNLoading('global');setNLoading('setores');setNLoading('carteira');
await Promise.all([fetchNewsGlobal(),fetchNewsSetores(),fetchNewsCarteira()]);
btn.disabled=false;btn.textContent='Atualizar Noticias';
$('news-last-update').textContent='Atualizado as '+new Date().toLocaleTimeString('pt-BR');
}

async function fetchNewsGlobal(){
try{
const res=await fetch('/api/news',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'global'})});
const data=await res.json();
if(data.error){$('nsb-global').innerHTML=newsErr(data.error);return;}
$('nsb-global').innerHTML=newsCardsHTML(data.articles);
$('nc-global').textContent=data.articles.length+' noticias';
}catch(e){$('nsb-global').innerHTML=newsErr(e.message);}
}

async function fetchNewsSetores(){
try{
const results=await Promise.all(SECTORS_LIST.map(s=>
fetch('/api/news',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'sector',query:s})})
.then(r=>r.json()).catch(e=>({error:e.message}))
));
let total=0;
$('nsb-setores').innerHTML=results.map((data,i)=>{
const s=SECTORS_LIST[i],m=SECTOR_META[s];
if(data.error)return`<div class="news-sub-hdr" style="color:${m.color}">${m.label}</div>${newsErr(data.error)}`;
total+=data.articles.length;
return`<div class="news-sub-hdr" style="color:${m.color}">${m.label}</div>${newsCardsHTML(data.articles)}`;
}).join('');
$('nc-setores').textContent=total+' noticias';
}catch(e){$('nsb-setores').innerHTML=newsErr(e.message);}
}

async function fetchNewsCarteira(){
if(!state.stocks.length){$('nsb-carteira').innerHTML='<div class="empty-state" style="padding:40px">Nenhuma acao na carteira.</div>';return;}
try{
const results=await Promise.all(state.stocks.map(s=>
fetch('/api/news',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'stock',query:`"${s.ticker}" OR "${s.name.split(' ')[0]}"`})})
.then(r=>r.json()).catch(e=>({error:e.message}))
));
let total=0;
$('nsb-carteira').innerHTML=results.map((data,i)=>{
const s=state.stocks[i],c=COLORS[i%COLORS.length];
if(data.error)return`<div class="news-sub-hdr" style="color:${c}">${s.ticker} — ${s.name}</div>${newsErr(data.error)}`;
total+=data.articles.length;
return`<div class="news-sub-hdr" style="color:${c}">${s.ticker} — ${s.name}</div>${newsCardsHTML(data.articles)}`;
}).join('');
$('nc-carteira').textContent=total+' noticias';
}catch(e){$('nsb-carteira').innerHTML=newsErr(e.message);}
}

function newsCardsHTML(articles){
if(!articles||!articles.length)return'<div class="empty-state" style="padding:30px 20px;font-size:13px">Nenhuma noticia encontrada.</div>';
return articles.map((a,i)=>{
const uid='na'+Date.now()+i+Math.random().toString(36).slice(2,6);
const sentMap={POSITIVO:{bg:'#30d15820',c:'#30d158',b:'#30d15840',l:'POSITIVO ↑'},NEGATIVO:{bg:'#ff453a20',c:'#ff453a',b:'#ff453a40',l:'NEGATIVO ↓'},NEUTRO:{bg:'#8e8e9320',c:'#8e8e93',b:'#8e8e9340',l:'NEUTRO →'}};
const sm=sentMap[a.sentimento]||sentMap.NEUTRO;
const urgC=a.urgencia==='ALTO'?'#ff453a':a.urgencia==='MEDIO'?'#ff9f0a':'#48484a';
const domain=((u)=>{try{return new URL(u).hostname.replace('www.','');}catch{return '';}})(a.url||'');
const logoSrc=domain?`https://logo.clearbit.com/${domain}`:'';
const fbId='nlfb'+uid;
const ago=((d)=>{if(!d)return'';const s=Math.floor((Date.now()-new Date(d))/1000);if(s<60)return s+'s atras';if(s<3600)return Math.floor(s/60)+'min atras';if(s<86400)return Math.floor(s/3600)+'h atras';return Math.floor(s/86400)+'d atras';})(a.publishedAt);
return`<div class="news-card">
${a.image?`<img class="news-card-img" src="${a.image}" alt="" onerror="this.style.display='none'" loading="lazy"/>`:''}
<div class="news-card-body">
<div class="news-card-top">
<div class="news-src-wrap">
${logoSrc?`<img class="news-src-logo" src="${logoSrc}" alt="" onerror="this.style.display='none'" loading="lazy"/>`:''}
<span class="news-src-name">${a.source?.name||domain||'Fonte'}</span>
</div>
<div style="display:flex;align-items:center;gap:10px">
<span class="news-urgency" style="color:${urgC}">${a.urgencia||''}</span>
<span class="news-time">${ago}</span>
</div>
</div>
<a class="news-headline" href="${a.url||'#'}" target="_blank" rel="noopener">${a.title||'Sem titulo'}</a>
${a.description?`<p class="news-desc">${a.description}</p>`:''}
<div class="news-card-footer">
<span class="news-sentiment-badge" style="background:${sm.bg};color:${sm.c};border:1px solid ${sm.b}">${sm.l}</span>
${a.analise?`<button class="news-analysis-btn" onclick="toggleNAnalysis('${uid}',this)">Ver analise ▾</button>`:''}
</div>
${a.analise?`<div class="news-analysis" id="${uid}" style="display:none"><p class="news-analysis-text">${a.analise}</p></div>`:''}
</div>
</div>`;
}).join('');}

function toggleNAnalysis(id,btn){
const el=$(id);const show=el.style.display==='none';
el.style.display=show?'block':'none';
btn.textContent=show?'Fechar analise ▴':'Ver analise ▾';
}

function newsErr(msg){return`<div class="j-error" style="margin:4px 0 12px"><p class="j-text" style="font-size:13px">${msg}</p></div>`;}

/* ── RESET ── */
function resetApp(){
if(!confirm('Apagar todos os seus dados e comecar do zero?'))return;
localStorage.removeItem(SK);
location.reload();
}
