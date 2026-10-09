/* Сборка для открытия index.html напрямую через file://. Исходники остаются в отдельных модулях. */
/* model.mjs */
// Все значения, продажи и условия акций синтетические. Это не формула исходной рабочей книги.
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const validPrice = n => Number.isFinite(n) && n > 0 && n <= 1e8 && Math.abs(n*100-Math.round(n*100)) < 1e-5;
const cabinetNames = {dbs1:'Основной кабинет · DBS',dbs2:'Второй кабинет · DBS'};
const categories = {revenue:'Выручка',unit:'Себестоимость',commission:'Комиссия',logistics:'Логистика',tariff:'Тариф',reviews:'Отзывы',ads:'Реклама',payroll:'ФОТ'};
const presets = {a:{start:'2026-09-01',end:'2026-09-30'},b:{start:'2026-10-01',end:'2026-10-07'},c:{start:'2026-09-01',end:'2026-10-31'}};
function validPeriod(start,end) {
  const valid = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10)===d;
  return valid(start)&&valid(end)&&start<=end;
}
function economy(p,price=p.proposed) {
  if(!p.sourceReady || !validPrice(price) || !Number.isFinite(p.commission) || p.commission<0 || p.commission>=1 || Object.values(p.costs).some(v=>!Number.isFinite(v)||v<0))return null;
  const fixed=Object.values(p.costs).reduce((a,b)=>a+b,0), fee=round(price*p.commission), result=round(price-fixed-fee);
  return {price,commission:fee,threshold:Math.ceil(fixed/(1-p.commission)*100-1e-7)/100,profit:result,margin:round(result/price*100),targetPrice:round((fixed+p.costs.unit*p.markup)/(1-p.commission))};
}
const profit = (p,price=p.proposed) => economy(p,price)?.profit ?? null;
function refreshThreshold(p) {p.threshold=economy(p,Math.max(1,p.proposed||p.regularPrice))?.threshold ?? null;}
function promotionAssessment(p,price=p.participation?p.promoEntry:p.entryDraft) {
  const e=economy(p,price);
  if(!e||!p.ozonReady)return {code:'missing',label:'Нет данных для решения',level:null};
  const level=price<=p.boostLimits[2]?3:price<=p.boostLimits[1]?2:price<=p.boostLimits[0]?1:null;
  if(p.participation&&e.profit<0)return {code:'exit',label:`К выходу: убыток ${Math.abs(e.profit).toLocaleString('ru-RU',{maximumFractionDigits:2})} ₽`,level};
  if(p.participation&&e.profit===0)return {code:'zero',label:'К выходу: продажа в ноль',level};
  if(p.participation)return {code:'keep',label:'Можно оставить в акции',level};
  if(!level)return {code:'ineligible',label:'Не проходит по цене акции',level};
  if(e.profit<0)return {code:'risk',label:'Вход ниже экономического порога',level};
  return {code:'enter',label:`Можно войти · бустинг ${level}`,level};
}
function snapshot(p,price) {return {price,costs:{...p.costs},commission:p.commission,markup:p.markup,threshold:p.threshold,profit:profit(p,price),capturedAt:null};}
function version(p,date,price,id) {return {...snapshot(p,price),id,validFrom:date,sourceBatch:null,complete:p.sourceReady};}
function createCatalog(count=3600) {
  const names=['Смеситель для кухни','Душевая лейка','Полотенцедержатель','Смеситель для ванной','Набор аксессуаров','Сифон для раковины','Дозатор для мыла','Душевой шланг','Полка для ванной','Держатель для душа','Донный клапан','Крючок для полотенца'];
  const finishes=['Хром','Матовый чёрный','Белый','Графит','Сатин'];
  const featured=[[1290,1290,1250,1270,false],[890,930,850,870,false],[1490,1410,1380,1390,true],[2390,1890,2110,1990,false],[1190,1180,1120,1140,false],[790,760,720,720,true]];
  return Array.from({length:count},(_,i)=>{
    const threshold=380+(i*137)%5100;
    const [regular,proposed,t,entry,participation]=featured[i]||[threshold+230,threshold+(i%11===0?-120:180+i%170),threshold,threshold+(i===8?-60:90),i%3===0||i===8];
    const ads=45+i%55,logistics=70+i%80,reviews=20,tariff=25,payroll=30;
    const p={id:`SKU-DEMO-${String(i+1).padStart(4,'0')}`,cabinet:i<1800?'dbs1':'dbs2',productId:String(900001+i),promotionId:i<1800?'PROMO-DEMO-01':'PROMO-DEMO-02',
      name:i<12?names[i]:`${names[i%12]} · ${finishes[Math.floor(i/12)%5]} ${Math.floor(i/60)+1}`,glyph:['↗','◉','⊏','↗','▦','∪','▥','∿','⊟','⌁','⊙','⌐'][i%12],
      regularPrice:regular,current:participation?entry:regular,proposed,threshold:t,promoEntry:entry,entryDraft:entry,participation,commission:.18,markup:.2,sourceReady:true,ozonReady:true,
      costs:{unit:round(t*.82-ads-logistics-reviews-tariff-payroll),ads,logistics,reviews,tariff,payroll},boostLimits:[t+160,t+60,t-30],plans:[],sales:[],expenses:[]};
    p.plans=[version(p,i===4?'2026-09-10T00:00:00Z':'2026-09-01T00:00:00Z',regular-30,`${p.id}-V1`),version(p,'2026-09-18T00:00:00Z',p.current,`${p.id}-V2`)];
    const dates=['2026-09-06T10:00:00Z','2026-09-21T10:00:00Z',...(i%3===0?[]:['2026-10-05T10:00:00Z'])];
    dates.forEach((date,n)=>{
      const qty=n===2?4:4+i%6,price=n===0?regular-30:p.current;
      p.sales.push({id:`${p.id}-S${n}`,at:date,quantity:qty,revenue:round(price*qty),cost: i===9&&n===0?null:round(p.costs.unit*qty)});
      for(const key of Object.keys(p.costs).filter(k=>k!=='unit').concat('commission')){
        const base=key==='commission'?price*.18:p.costs[key];
        p.expenses.push({id:`${p.id}-E${n}-${key}`,at:date,type:key,amount:round(base*qty+(key==='ads'?(i%4===1?-20:35):0))});
      }
    });
    if(i%3===0)p.expenses.push({id:`${p.id}-E-oct-ad`,at:'2026-10-04T09:00:00Z',type:'ads',amount:180});
    if(i===6){p.sourceReady=false;p.threshold=null;}
    return p;
  });
}
function filterCatalog(products,{query='',filter='all',selected=new Set(),cabinet=null}={}) {
  const terms=query.toLocaleLowerCase('ru').trim().split(/\s+/).filter(Boolean);
  return products.filter(p=> (!cabinet||p.cabinet===cabinet) && terms.every(term=>`${p.id} ${p.name}`.toLocaleLowerCase('ru').includes(term)) &&
    (filter==='all'||filter==='risk'&&profit(p)!==null&&profit(p)<0||filter==='promo'&&p.participation||filter==='outside'&&!p.participation||filter==='selected'&&selected.has(p.id)||filter==='exit'&&['exit','zero'].includes(promotionAssessment(p).code)||filter==='missing'&&(!p.sourceReady||!p.ozonReady)));
}
function prepareItems(products,selected,action='price') {
  const list=products.filter(p=>selected.has(p.id)).map(p=>({id:p.id,name:p.name,price:action==='remove'?null:action==='add'?p.entryDraft:p.proposed,threshold:p.threshold}));
  return {invalid:list.filter(i=>action!=='remove'&&(!validPrice(i.price)||i.threshold===null)),safe:list.filter(i=>action==='remove'||validPrice(i.price)&&i.threshold!==null&&i.price>=i.threshold),below:list.filter(i=>action!=='remove'&&validPrice(i.price)&&i.threshold!==null&&i.price<i.threshold)};
}
const confirmItems=(safe,below,overrides)=>[...safe.map(i=>({...i,override:false})),...below.filter(i=>overrides.has(i.id)).map(i=>({...i,override:true}))];
function planAt(p,date) {return p.plans.filter(v=>v.validFrom<=date).sort((a,b)=>b.validFrom.localeCompare(a.validFrom))[0]||null;}
function planFact(p,period='a') {
  const {start,end}=typeof period==='string'?presets[period]:period;
  if(!validPeriod(start,end))throw new Error('Некорректный период');
  const included=date=>date.slice(0,10)>=start&&date.slice(0,10)<=end;
  const sales=p.sales.filter(s=>included(s.at)),expenses=p.expenses.filter(e=>included(e.at));
  const units=sales.reduce((sum,s)=>sum+s.quantity,0),planned=Object.fromEntries(Object.keys(categories).map(k=>[k,0])),actual={...planned};
  let missingUnits=0;const used=new Set();
  const rows=sales.map(s=>{
    const candidate=planAt(p,s.at),v=candidate?.complete===false?null:candidate;actual.revenue+=s.revenue;
    if(s.cost===null)actual.unit=null;else if(actual.unit!==null)actual.unit+=s.cost;
    if(v){used.add(v.id);planned.revenue+=v.price*s.quantity;planned.commission+=round(v.price*v.commission)*s.quantity;for(const key of Object.keys(v.costs))planned[key]+=v.costs[key]*s.quantity;}
    else missingUnits+=s.quantity;
    return {...s,planId:v?.id??null,plannedProfit:v?round(v.profit*s.quantity):null};
  });
  expenses.forEach(e=>{actual[e.type]+=e.amount;});
  for(const key of Object.keys(categories)){planned[key]=missingUnits?null:round(planned[key]);actual[key]=actual[key]===null?null:round(actual[key]);}
  const total=values=>Object.values(values).some(v=>v===null)?null:round(values.revenue-Object.entries(values).filter(([k])=>k!=='revenue').reduce((s,[,v])=>s+v,0));
  const plan=total(planned),fact=total(actual),delta=plan===null||fact===null?null:round(fact-plan);
  return {units,plan,fact,delta,ads:actual.ads,versions:used.size,missingUnits,coverage:units?round((units-missingUnits)/units*100):100,
    perUnit:units&&fact!==null?round(fact/units):null,plannedPerUnit:units&&plan!==null?round(plan/units):null,deltaPerUnit:units&&delta!==null?round(delta/units):null,planned,actual,sales:rows,expenses};
}
function applyVerified(p,action,price,{at=null,batchId=null}={}) {
  if(action==='price'){p.regularPrice=price;p.proposed=price;if(!p.participation)p.current=price;}
  else if(action==='add'){if(p.participation)return;p.promoEntry=price;p.entryDraft=price;p.current=price;p.participation=true;}
  else if(action==='remove'){p.current=p.regularPrice;p.participation=false;}
  // Версия описывает фактическую цену продажи. Обычная цена не подменяет цену действующей акции.
  if(at)p.plans.push({...version(p,at,p.current,`${p.id}-V${p.plans.length+1}`),sourceBatch:batchId});
}


/* engine.mjs */
const managers=['Анна · демо','Михаил · демо','Ирина · демо'];
class DemoError extends Error {constructor(code,message){super(message);this.code=code;}}
const fail=(code,message)=>{throw new DemoError(code,message);};
const terminal=b=>['confirmed','partial'].includes(b.status);
class DemoEngine {
  constructor(saved=null,count=3600){
    this.products=createCatalog(count);this.byId=new Map(this.products.map(p=>[p.id,p]));this.changed=new Set();
    this.batches=[];this.audit=[];this.clock='2026-10-09T09:00:00.000Z';this.manager=managers[0];this.loggedIn=true;this.cabinet='dbs1';
    this.sources={};for(const cabinet of ['dbs1','dbs2'])this.sources[cabinet]=Object.fromEntries(['one_c','ozon','performance'].map(k=>[k,{status:'ready',at:'2026-10-09T08:55:00.000Z'}]));
    if(saved?.version===3){
      for(const [id,p] of Object.entries(saved.products||{}))if(this.byId.has(id)){Object.assign(this.byId.get(id),p);this.changed.add(id);}
      for(const k of ['batches','audit','clock','manager','loggedIn','cabinet','sources'])if(saved[k]!==undefined)this[k]=saved[k];
    }
  }
  now(){this.clock=new Date(Date.parse(this.clock)+1000).toISOString();return this.clock;}
  requireSession(){if(!this.loggedIn)fail('UNAUTHORIZED','Сначала войдите под демо-менеджером.');}
  login(manager){if(!managers.includes(manager))fail('VALIDATION_ERROR','Выберите демо-менеджера.');this.manager=manager;this.loggedIn=true;}
  logout(){this.loggedIn=false;}
  product(id){const p=this.byId.get(id);if(!p)fail('SKU_NOT_FOUND','Товар не найден.');return p;}
  touch(id){this.changed.add(id);}
  locked(id){return this.batches.some(b=>!terminal(b)&&b.items.some(i=>i.id===id&&i.verification==='pending'));}
  editPrice(id,price){this.requireSession();if(this.locked(id))fail('ACTION_IN_PROGRESS','Сначала дождитесь результата по этому SKU.');this.product(id).proposed=price;this.touch(id);}
  updateCalculation(id,values){
    this.requireSession();const p=this.product(id);if(this.locked(id))fail('ACTION_IN_PROGRESS','Расчёт зафиксирован для текущего пакета. Дождитесь сверки.');
    if(Object.values(values.costs).some(v=>!Number.isFinite(v)||v<0||v>1e8)||!Number.isFinite(values.commission)||values.commission<0||values.commission>=1||!Number.isFinite(values.markup)||values.markup<0||values.markup>10)fail('VALIDATION_ERROR','Затраты неотрицательны; комиссия — от 0 до 100% (не включая 100%).');
    if(!p.sourceReady)fail('SOURCE_DATA_MISSING','Сначала обновите данные 1С.');
    p.costs={...values.costs};p.commission=values.commission;p.markup=values.markup;refreshThreshold(p);this.touch(id);
  }
  send(items,action,{key,options={},cabinet=this.cabinet}={}){
    this.requireSession();
    if(!key)fail('IDEMPOTENCY_KEY_REQUIRED','Нет ключа команды.');
    if(!['price','add','remove'].includes(action)||!items.length)fail('EMPTY_BATCH','SKU не выбраны.');
    const fingerprint=JSON.stringify({cabinet,action,items:items.map(i=>({id:i.id,price:action==='remove'?null:i.price,override:!!i.override})).sort((a,b)=>a.id.localeCompare(b.id))});
    const existing=this.batches.find(b=>b.key===key);
    if(existing){if(existing.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT','Этот ключ уже использован для другого состава пакета.');return {batch:existing,replayed:true};}
    if(new Set(items.map(i=>i.id)).size!==items.length)fail('DUPLICATE_SKU','Один SKU не должен повторяться в пакете.');
    for(const item of items){
      const p=this.product(item.id);
      if(p.cabinet!==cabinet)fail('CABINET_MISMATCH','SKU разных кабинетов нельзя отправлять одним пакетом.');
      if(this.locked(p.id))fail('ACTION_IN_PROGRESS',`${p.id}: предыдущий результат ещё не выяснен.`);
      if(!p.ozonReady||action!=='remove'&&!p.sourceReady)fail('SOURCE_DATA_MISSING',`${p.id}: не хватает данных для решения.`);
      if(action==='add'&&p.participation||action==='remove'&&!p.participation)fail('TARGET_ALREADY_REACHED',`${p.id}: целевой статус уже установлен.`);
      if(action!=='remove'&&!validPrice(item.price))fail('INVALID_PRICE',`${p.id}: укажите положительную цену с точностью до копеек.`);
      if(action!=='remove'&&item.price<p.threshold&&!item.override)fail('BELOW_THRESHOLD_NOT_CONFIRMED',`${p.id}: требуется подтверждение цены ниже порога.`);
    }
    // До фиксации пакета никакой внешней отправки, даже симулированной, не происходит.
    if(options.saveError)fail('BATCH_SAVE_FAILED','Не удалось сохранить пакет. В Ozon ничего не отправлено.');
    const at=this.now();
    this.audit=this.audit.filter(record=>Date.parse(record.at)>=Date.parse(at)-365*24*60*60*1000);
    const b={id:`MP-DEMO-${String(this.batches.length+1).padStart(3,'0')}`,cabinet,manager:this.manager,at,action,key,fingerprint,options:{...options},status:'accepted',writes:0,reads:0,events:[{at,text:'Пакет сохранён; ожидает отправки'}],items:items.map(item=>{
      const p=this.product(item.id);return {...item,name:p.name,price:action==='remove'?null:item.price,override:!!item.override,productId:p.productId,promotionId:p.promotionId,submission:'pending',verification:'pending',error:null,actualPrice:null,actualParticipation:null,
        snapshot:{...snapshot(p,action==='remove'?p.regularPrice:item.price),capturedAt:at,currentPrice:p.current,regularPrice:p.regularPrice,participation:p.participation},planSaved:false};
    })};
    this.batches.push(b);
    for(const item of b.items)if(item.override)this.audit.push({id:`LOG-${this.audit.length+1}`,batchId:b.id,cabinet,manager:b.manager,at,sku:item.id,decision:`${action==='add'?'Вход в акцию':'Изменение цены'} ниже порога: ${item.price} ₽; порог ${item.snapshot.threshold} ₽`});
    return {batch:b,replayed:false};
  }
  receive(id){
    const b=this.batches.find(b=>b.id===id);if(!b||b.writes)return b;
    b.writes=1;b.status='verifying';const o=b.options;
    b.items.forEach((item,index)=>{
      const p=this.product(item.id),promoRefusal=b.action==='add'&&promotionAssessment(p,item.price).code==='ineligible';
      item.remoteApplied=!o.apiDown&&!(o.rejectFirst&&index===0)&&!promoRefusal&&!(o.mismatchFirst&&index===0);
      item.submission=o.timeout?'unknown':o.apiDown||o.rejectFirst&&index===0||promoRefusal?'rejected':'reported_success';
      if(item.submission==='rejected')item.error=o.apiDown?'Ozon API недоступен':promoRefusal?'Цена не соответствует условию акции':'Ozon отклонил изменение: тестовая ошибка позиции';
    });
    if(o.apiDown)this.sources[b.cabinet].ozon.status='error';
    b.events.push({at:this.now(),text:o.apiDown?'Ozon API недоступен; применение не подтверждено':o.timeout?'Таймаут: ответа на отправку нет. Запускается чтение состояния':'Ответ Ozon получен. Запускается отдельная сверка'});
    if(o.timeout)b.status='unconfirmed';return b;
  }
  verify(id){
    const b=this.batches.find(b=>b.id===id);if(!b||!b.writes||terminal(b))return b;
    b.reads++;const at=this.now();
    b.items.forEach((item,index)=>{
      if(item.verification!=='pending')return;
      if((b.options.readLater&&index===0||b.options.apiDown)&&b.reads<3){item.readError='Не удалось прочитать состояние. Следующая сверка автоматически.';return;}
      const p=this.product(item.id);
      if(item.remoteApplied){
        if(!item.planSaved){applyVerified(p,b.action,item.price,{at,batchId:b.id});item.planSaved=true;this.touch(p.id);}
        item.verification='matched';
      }else{
        const target=b.action==='price'?p.regularPrice===item.price:b.action==='add'?p.participation&&p.promoEntry===item.price:!p.participation;
        item.verification=target?'matched':'mismatch';
      }
      item.actualPrice=b.action==='price'?p.regularPrice:p.current;item.actualParticipation=p.participation;item.verifiedAt=at;item.readError=null;
    });
    if(b.options.apiDown&&b.reads>=3)this.sources[b.cabinet].ozon={status:'ready',at};
    b.status=b.items.some(i=>i.verification==='pending')?'unconfirmed':b.items.every(i=>i.verification==='matched')?'confirmed':'partial';
    b.events.push({at,text:`Сверка ${b.reads}: ${b.items.filter(i=>i.verification==='matched').length} совпадений, ${b.items.filter(i=>i.verification==='mismatch').length} расхождений, ${b.items.filter(i=>i.verification==='pending').length} непроверенных`});
    return b;
  }
  retryItems(id){const b=this.batches.find(b=>b.id===id);return b.items.filter(i=>i.verification==='mismatch'&&!this.locked(i.id)).map(i=>({id:i.id,name:i.name,price:i.price,threshold:this.product(i.id).threshold,override:false}));}
  sync(cabinet,source,failed=false){
    this.requireSession();const s=this.sources[cabinet][source];s.status=failed?'error':'ready';if(failed)return s;s.at=this.now();
    for(const p of this.products.filter(p=>p.cabinet===cabinet)){
      if(source==='one_c'&&!p.sourceReady&&!this.locked(p.id)){p.sourceReady=true;refreshThreshold(p);this.touch(p.id);}
      if(source==='ozon'&&!p.ozonReady){p.ozonReady=true;this.touch(p.id);}
    }
    return s;
  }
  simulateSale(id){
    this.requireSession();const p=this.product(id);if(this.locked(id)||!p.sourceReady)fail('SOURCE_DATA_MISSING','Сначала дождитесь сверки и загрузите исходные данные.');
    const at=this.now(),sale={id:`${id}-DEMO-S${p.sales.length+1}`,at,quantity:1,revenue:p.current,cost:p.costs.unit};p.sales.push(sale);
    for(const key of Object.keys(p.costs).filter(k=>k!=='unit').concat('commission'))p.expenses.push({id:`${sale.id}-${key}`,at,type:key,amount:key==='commission'?round(p.current*p.commission):p.costs[key]});
    this.touch(id);return sale;
  }
  toJSON(){
    // Исходный каталог воспроизводится из seed; сохраняем только изменяемые поля, а не 3600 копий продаж.
    const keys=['regularPrice','current','proposed','promoEntry','entryDraft','participation','commission','markup','costs','threshold','sourceReady','ozonReady'];
    const products=Object.fromEntries([...this.changed].map(id=>{const p=this.product(id),record=Object.fromEntries(keys.map(k=>[k,p[k]]));if(p.plans.length>2)record.plans=p.plans;if(p.sales.some(s=>s.id.includes('-DEMO-S'))){record.sales=p.sales;record.expenses=p.expenses;}return [id,record];}));
    return {version:3,products,batches:this.batches,audit:this.audit,clock:this.clock,manager:this.manager,loggedIn:this.loggedIn,cabinet:this.cabinet,sources:this.sources};
  }
}


/* views.mjs */
const num=n=>n===null||!Number.isFinite(n)?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
const money=n=>n===null||!Number.isFinite(n)?'—':`${num(n)} ₽`;
const signed=n=>n===null?'—':`${n>0?'+':''}${num(n)}`;
const tone=n=>n<0?'negative':n>0?'positive':'';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=at=>new Date(at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const actionNames={price:'Изменение обычных цен',add:'Вход в акцию',remove:'Выход из акции'};
const statuses={accepted:['Принят в обработку','wait'],verifying:['Автоматическая сверка','wait'],unconfirmed:['Есть непроверенные SKU','wait'],confirmed:['Подтверждено','good'],partial:['Есть расхождения','bad']};
function profitHTML(value){return `<span class="table-profit ${tone(value)}">${signed(value)}</span><span class="price-unit-hint">${value===null?'нет расчёта':value<0?'ниже порога':value===0?'продажа в ноль':'после расходов'}</span>`;}
function promoButton(p,locked){return `<button type="button" class="row-action ${p.participation?'exit':''}" data-promo="${p.id}" aria-label="${p.participation?'Вывести из акции':'Добавить в акцию'} ${p.id}" ${locked?'disabled':''}>${locked?'Проверяется':p.participation?'Вывести ↗':'В акцию +'}</button>`;}
function rowHTML(p,{selected,expanded,period,locked}){
  const v=profit(p),pf=planFact(p,period),open=expanded===p.id,recommendation=promotionAssessment(p);
  return `<tr class="product-row ${selected.has(p.id)?'selected':''} ${open?'expanded':''}" data-id="${p.id}"><td class="checkbox-cell"><input type="checkbox" data-select="${p.id}" aria-label="Выбрать ${p.id}" ${selected.has(p.id)?'checked':''} ${locked?'disabled':''}></td><td><button class="product-toggle" data-expand="${p.id}" aria-expanded="${open}" aria-controls="detail-${p.id}" aria-label="Расчёт и план-факт: ${esc(p.name)} ${p.id}"><span class="product-tile" aria-hidden="true">${p.glyph}</span><span class="product-copy"><strong>${esc(p.name)}</strong><small>${p.id}${locked?' · в обработке':''}</small></span><span class="chevron">${open?'−':'+'}</span></button></td><td class="numeric current-price">${p.ozonReady?num(p.regularPrice):'—'}${p.participation?`<small>в акции ${num(p.promoEntry)}</small>`:''}</td><td class="numeric"><input class="price-input ${v<0?'below':''}" data-price="${p.id}" aria-label="Новая цена ${p.id}" type="number" min="0.01" max="100000000" step="0.01" value="${Number.isFinite(p.proposed)?p.proposed:''}" ${locked?'disabled':''}></td><td class="numeric">${num(p.threshold)}</td><td class="numeric" data-profit="${p.id}">${profitHTML(v)}</td><td><div class="promo-cell"><span class="promo-status ${p.participation?'active':''}">${p.participation?'В акции':'Вне акции'}</span>${promoButton(p,locked)}</div><span class="recommendation ${['exit','zero','risk'].includes(recommendation.code)?'negative':''}">${esc(recommendation.label)}</span></td><td class="numeric"><button class="plan-link ${tone(pf.delta)}" data-expand="${p.id}" aria-label="План-факт ${p.id}">${signed(pf.delta)}</button><span class="price-unit-hint">${pf.units?`${pf.units} продано`:'нет продаж'}${pf.missingUnits?' · план неполный':''}</span></td></tr><tr class="detail-row" id="detail-${p.id}" ${open?'':'hidden'}><td colspan="8">${open?detailHTML(p,period,locked):''}</td></tr>`;
}
function detailHTML(p,period,locked){
  const e=economy(p),pf=planFact(p,period),r=promotionAssessment(p),c=p.costs;
  const values=(label,plan,fact,isExpense=false)=>{
    const delta=plan===null||fact===null?null:round(fact-plan),per=n=>pf.units&&n!==null?round(n/pf.units):null;
    return `<tr><td>${label}</td><td>${money(plan)}</td><td>${money(fact)}</td><td class="${tone(isExpense?-delta:delta)}">${signed(delta)}</td><td>${money(per(plan))}</td><td>${money(per(fact))}</td><td>${signed(per(delta))}</td></tr>`;
  };
  return `<div class="sku-detail"><div class="detail-economy"><p class="detail-heading">Экономика будущей продажи</p>${!e?'<p class="data-warning">Нет исходных данных. Расчёт не заменяется нулём.</p>':`<dl><dt>Себестоимость · 1С</dt><dd>${money(c.unit)}</dd><dt>Комиссия · ${num(p.commission*100)}%</dt><dd>${money(e.commission)}</dd><dt>Логистика / тариф</dt><dd>${money(c.logistics)} / ${money(c.tariff)}</dd><dt>Реклама / отзывы</dt><dd>${money(c.ads)} / ${money(c.reviews)}</dd><dt>ФОТ на единицу</dt><dd>${money(c.payroll)}</dd></dl><div class="detail-bottom"><span>Прибыль / маржа</span><strong class="${tone(e.profit)}">${money(e.profit)} / ${num(e.margin)}%</strong></div><p class="plan-note">Целевая цена при надбавке ${num(p.markup*100)}% к себестоимости: ${money(e.targetPrice)}. Это не прогноз спроса.</p>`}<button type="button" class="row-action" data-editcalc="${p.id}" ${locked||!p.sourceReady?'disabled':''}>Параметры расчёта</button></div>
    <div class="detail-promo"><p class="detail-heading">${p.promotionId} · Осенние предложения</p><h4 class="${['exit','zero','risk'].includes(r.code)?'negative':''}">${esc(r.label)}</h4><div class="mini-prices"><div><small>${p.participation?'Обычная цена':'Цена сейчас'}</small>${p.participation?`<s>${money(p.regularPrice)}</s>`:`<strong>${money(p.regularPrice)}</strong>`}</div><div><small>${p.participation?'В акции':'Предлагаемый вход'}</small><strong>${money(p.participation?p.promoEntry:p.entryDraft)}</strong></div></div><p>Уровни бустинга (демо): 1 — до ${money(p.boostLimits[0])}; 2 — до ${money(p.boostLimits[1])}; 3 — до ${money(p.boostLimits[2])}.</p><p>Доступный уровень: ${r.level??'не проходит'}. ${p.participation?'При выходе обычную цену восстанавливает Ozon.':'Цена акции задаётся отдельно в окне входа.'}</p>${promoButton(p,locked)}</div>
    <div class="detail-plan"><p class="detail-heading">План-факт прибыли · выбранный период</p><div class="plan-values"><div><span>План</span><strong>${num(pf.plan)}</strong></div><div><span>Факт</span><strong>${num(pf.fact)}</strong></div><div><span>Отклонение</span><strong class="${tone(pf.delta)}">${signed(pf.delta)}</strong></div></div><div class="per-unit"><span>План / факт на единицу</span><strong>${money(pf.plannedPerUnit)} / ${money(pf.perUnit)}</strong></div><div class="per-unit"><span>Отклонение на единицу</span><strong class="${tone(pf.deltaPerUnit)}">${money(pf.deltaPerUnit)}</strong></div><p class="plan-note">${pf.units?`${pf.units} продано; ${pf.versions} верс. плана. Покрытие планом: ${pf.coverage}%.`:'Продаж нет. Деление на количество не выполняется.'} Реклама по факту: ${money(pf.ads)}.</p>${pf.missingUnits?`<p class="data-warning">Нет плана для ${pf.missingUnits} ед. Итоговый план и отклонение неизвестны; более поздняя версия не подставляется.</p>`:''}${pf.fact===null?'<p class="data-warning">Не хватает себестоимости продажи. Фактическая прибыль не определена.</p>':''}</div></div>
    <div class="detail-tables"><details><summary>Статьи план-факта · суммы и показатели на единицу</summary><table class="mini-table"><thead><tr><th>Показатель</th><th>План, ₽</th><th>Факт, ₽</th><th>Δ, ₽</th><th>План/ед.</th><th>Факт/ед.</th><th>Δ/ед.</th></tr></thead><tbody>${Object.entries(categories).map(([k,label])=>values(label,pf.planned[k],pf.actual[k],k!=='revenue')).join('')}${values('Прибыль',pf.plan,pf.fact)}</tbody></table><p class="panel-note">Δ = факт − план. Рост расходов — перерасход; рост прибыли — улучшение. «—» означает отсутствие данных или невозможность расчёта, а не ноль.</p></details>
    <details><summary>Продажи и выбранные версии плана · ${pf.sales.length}</summary><table class="mini-table"><thead><tr><th>Дата (МСК)</th><th>Количество</th><th>Выручка</th><th>Версия плана</th><th>Плановая прибыль</th></tr></thead><tbody>${pf.sales.map(s=>`<tr><td>${date(s.at)}</td><td>${s.quantity}</td><td>${money(s.revenue)}</td><td>${s.planId??'Нет действовавшего плана'}</td><td>${money(s.plannedProfit)}</td></tr>`).join('')||'<tr><td colspan="5">Нет продаж за выбранный период</td></tr>'}</tbody></table></details>
    <details><summary>История расчётов и проверка новой продажи · ${p.plans.length} верс.</summary><table class="mini-table"><thead><tr><th>Версия</th><th>Действует с (МСК)</th><th>Цена продажи</th><th>План прибыли/ед.</th><th>Источник</th></tr></thead><tbody>${[...p.plans].reverse().map(v=>`<tr><td>${v.id}</td><td>${date(v.validFrom)}</td><td>${money(v.price)}</td><td>${money(v.profit)}</td><td>${v.sourceBatch??'Исходные демо-данные'}</td></tr>`).join('')}</tbody></table><div class="demo-sale"><p>Можно добавить одну вымышленную продажу 9 октября, чтобы проверить использование новой версии. Старые продажи останутся без изменений.</p><button class="row-action" type="button" data-sale="${p.id}" ${locked||!p.sourceReady?'disabled':''}>Добавить демо-продажу</button></div></details></div>`;
}
function promotionItemHTML(p){return `<div class="promo-entry" data-entry-row="${p.id}"><div><strong>${esc(p.name)}</strong><small>${p.id}</small><span>Прежняя цена <s>${money(p.regularPrice)}</s></span></div><label>Цена входа, ₽<input type="number" min="0.01" step="0.01" data-entry-price="${p.id}" aria-label="Цена входа ${p.id}" value="${p.entryDraft}"></label><div class="entry-assessment" data-entry-assessment="${p.id}">${entryAssessment(p,p.entryDraft)}</div></div>`;}
function entryAssessment(p,price){const e=economy(p,price),r=promotionAssessment({...p,participation:false},price);return `Порог ${money(p.threshold)} · <span class="${tone(e?.profit)}">прибыль ${money(e?.profit??null)}</span><br>${esc(r.label)}${r.code==='enter'?'':` · ${r.level?`бустинг ${r.level}`:'бустинг недоступен'}`}`;}
function rawResponse(b){
  if(!b.writes)return 'Запрос к Ozon ещё не выполнялся.';
  if(b.options.timeout)return 'Ответ на команду не получен. Результат сверки — отдельный запрос чтения, не восстановленный ответ Ozon.';
  if(b.options.apiDown)return 'Ozon API недоступен. Успешного ответа на команду нет.';
  return JSON.stringify(b.action==='price'?{result:b.items.map(i=>({offer_id:i.id,updated:i.submission==='reported_success',errors:i.error?[{code:'DEMO_REJECTED',message:i.error}]:[]}))}:{result:{product_ids:b.items.filter(i=>i.submission==='reported_success').map(i=>Number(i.productId)),rejected:b.items.filter(i=>i.submission==='rejected').map(i=>({product_id:Number(i.productId),reason:i.error}))}},null,2);
}


/* app.js */
const $=id=>document.getElementById(id),storageKey='marginpilot-demo-v3';
let saved=null;try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
let engine=new DemoEngine(saved),selected=new Set(),page=1,pageSize=12,filter='all',query='',period=presets.a,expanded=null,viewBatch=null;
let filtered=[],visible=[],pending=null,promoIds=[],calcId=null,activeModal=null,modalOpener=null,toastTimer,storageFailed=false;
const scheduled=new Set(),timers=new Set();
const currentProducts=()=>engine.products.filter(p=>p.cabinet===engine.cabinet);
const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);};
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(engine.toJSON()));$('storage-status').textContent='изменения сохраняются в этом браузере';storageFailed=false;}catch{$('storage-status').textContent='только до перезагрузки: хранилище недоступно';if(!storageFailed)notify('Не удалось сохранить демо','Текущие действия работают, но после перезагрузки могут быть потеряны.');storageFailed=true;}}
function notify(title,message=''){clearTimeout(toastTimer);$('toast').innerHTML=`<strong>${esc(title)}</strong><p>${esc(message)}</p>`;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
function attempt(fn){try{return fn();}catch(error){notify(error.code==='BATCH_SAVE_FAILED'?'Пакет не отправлен':error.code==='UNAUTHORIZED'?'Сессия завершена':'Действие не выполнено',error.message);return null;}}

function render(){
  $('manager-session').textContent=engine.loggedIn?engine.manager:'Войти';$('cabinet-select').value=engine.cabinet;$('cabinet-select').disabled=!engine.loggedIn;
  $('login-gate').hidden=engine.loggedIn;$('work-content').hidden=!engine.loggedIn;
  if(!engine.loggedIn)return;
  renderCatalog();renderSources();renderHistory();renderBatch();
}
function renderCatalog(){
  const focused=document.activeElement?.dataset?.price;
  filtered=filterCatalog(engine.products,{query,filter,selected,cabinet:engine.cabinet});
  page=Math.min(page,Math.max(1,Math.ceil(filtered.length/pageSize)));visible=filtered.slice((page-1)*pageSize,page*pageSize);
  $('sku-rows').innerHTML=visible.length?visible.map(p=>rowHTML(p,{selected,expanded,period,locked:engine.locked(p.id)})).join(''):'<tr><td colspan="8" class="empty-catalog">Товары не найдены<small>Измените запрос или фильтр.</small></td></tr>';
  $('page-info').textContent=filtered.length?`${num((page-1)*pageSize+1)}–${num(Math.min(page*pageSize,filtered.length))} из ${num(filtered.length)} товаров`:'0 товаров';
  $('page-number').textContent=`${page} / ${Math.max(1,Math.ceil(filtered.length/pageSize))}`;$('prev-page').disabled=page===1;$('next-page').disabled=page*pageSize>=filtered.length;
  document.querySelectorAll('[data-filter]').forEach(b=>{const on=b.dataset.filter===filter;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  renderStats();renderSelection();
  if(focused)document.querySelector(`[data-price="${focused}"]`)?.focus({preventScroll:true});
}
function renderStats(){
  const rows=currentProducts(),risk=rows.filter(p=>profit(p)!==null&&profit(p)<0).length,exit=rows.filter(p=>['exit','zero'].includes(promotionAssessment(p).code)).length,missing=rows.filter(p=>!p.sourceReady||!p.ozonReady).length;
  $('work-count').textContent=`${num(rows.length)} SKU · ${num(engine.products.length)} всего`;
  $('work-stats').innerHTML=[['Товаров в кабинете',rows.length,'SKU',''],['Цена ниже порога',risk,'требуют внимания','risk'],['Рекомендуется выйти',exit,'из акции','signal'],['Недостаточно данных',missing,'для расчёта','']].map(([label,value,unit,cls])=>`<div class="work-stat ${cls}"><span>${label}</span><strong>${num(value)} <small>${unit}</small></strong></div>`).join('');
}
function renderSelection(){
  const chosen=[...selected].map(id=>engine.product(id)),available=visible.filter(p=>!engine.locked(p.id)),checked=available.filter(p=>selected.has(p.id)).length;
  $('select-page').checked=available.length>0&&available.length===checked;$('select-page').indeterminate=checked>0&&checked<available.length;$('select-page').disabled=!available.length;
  $('selected-filter-count').textContent=selected.size;$('selection-summary').textContent=selected.size?`Выбрано ${num(selected.size)} SKU`:'Выберите товары для действия';
  const blocked=chosen.some(p=>engine.locked(p.id)),below=chosen.filter(p=>profit(p)!==null&&profit(p)<0).length;
  $('selection-hint').textContent=blocked?'По части выбранных товаров ещё идёт сверка.':chosen.length?`${below} ниже порога · ${chosen.filter(p=>p.participation).length} в акции · выбор сохранён между страницами`:'Цены и акции можно менять пакетом; быстрое действие — в строке товара';
  $('clear-selection').hidden=!selected.size;
  const unselectedFound=filtered.filter(p=>!selected.has(p.id)&&!engine.locked(p.id)).length;
  $('select-filtered').hidden=!selected.size||!unselectedFound;$('select-filtered').textContent=`Выбрать все найденные · ${num(filtered.filter(p=>!engine.locked(p.id)).length)}`;
  for(const id of ['bulk-price','send-prices'])$(id).disabled=!selected.size||blocked;
  $('bulk-add').disabled=blocked||!chosen.some(p=>!p.participation);$('bulk-remove').disabled=blocked||!chosen.some(p=>p.participation);
}
function expand(id){
  expanded=expanded===id?null:id;
  document.querySelectorAll('.detail-row').forEach(row=>{row.hidden=row.id!==`detail-${expanded}`;row.firstElementChild.innerHTML=row.hidden?'':detailHTML(engine.product(expanded),period,engine.locked(expanded));});
  document.querySelectorAll('.product-row').forEach(row=>{const on=row.dataset.id===expanded;row.classList.toggle('expanded',on);row.querySelector('.product-toggle').setAttribute('aria-expanded',String(on));row.querySelector('.chevron').textContent=on?'−':'+';});
}
function updatePrice(input){
  const price=input.value===''?NaN:Number(input.value),id=input.dataset.price;
  if(attempt(()=>{engine.editPrice(id,price);return true;})===null)return;
  const p=engine.product(id),valid=validPrice(price);input.classList.toggle('below',valid&&p.threshold!==null&&price<p.threshold);input.classList.toggle('invalid',!valid);input.setAttribute('aria-invalid',String(!valid));
  document.querySelector(`[data-profit="${id}"]`).innerHTML=profitHTML(profit(p));
  if(expanded===id)$(`detail-${id}`).firstElementChild.innerHTML=detailHTML(p,period,engine.locked(id));
  renderStats();renderSelection();persist();
}
function renderSources(){
  const sources=engine.sources[engine.cabinet];$('source-summary').textContent=Object.values(sources).some(s=>s.status==='error')?'есть ошибка обмена':'данные загружены · демо';
  const names={one_c:['1С','Себестоимость и данные для расчёта'],ozon:['Ozon Seller API','Цены, акции, продажи и финансовые операции'],performance:['Ozon Performance API','Фактические рекламные расходы']};
  $('source-status').innerHTML=Object.entries(names).map(([id,[name,description]])=>`<div><strong>${name}</strong><p>${description}</p><span class="status ${sources[id].status==='error'?'bad':'good'}">${sources[id].status==='error'?'Ошибка обмена':'Загружено'}</span><small>Последние данные: ${date(sources[id].at)} МСК</small><div><button type="button" class="row-action" data-sync="${id}">Обновить</button><button type="button" class="text-button" data-sync-fail="${id}">Проверить сбой</button></div></div>`).join('');
}

function showModal(id,selector){
  if(!activeModal)modalOpener=document.activeElement;if(activeModal)$(activeModal).hidden=true;
  activeModal=id;$(id).hidden=false;document.body.classList.add('modal-open');
  for(const element of document.querySelectorAll('main,header,footer'))element.inert=true;
  $(id).querySelector(selector||'button:not(:disabled)')?.focus();
}
function closeModal(){
  if(activeModal)$(activeModal).hidden=true;activeModal=null;document.body.classList.remove('modal-open');
  for(const element of document.querySelectorAll('main,header,footer'))element.inert=false;
  if(modalOpener?.isConnected)modalOpener.focus();else $('manager-session').focus();
}
function requestItems(items,action){
  if(!items.length){notify('SKU не выбраны');return;}
  if(action!=='remove'&&items.some(i=>!validPrice(i.price)||i.threshold===null)){notify('Недостаточно данных','Проверьте цены и наличие исходных данных по выбранным SKU.');return;}
  const below=action==='remove'?[]:items.filter(i=>i.price<i.threshold),safe=items.filter(i=>!below.includes(i));
  if(below.length){pending={safe,below,action};$('warning-items').innerHTML=below.map(i=>`<label class="warning-item"><input type="checkbox" data-override="${i.id}" aria-label="Подтвердить цену ниже порога ${i.id}"><span><strong>${esc(i.name)}</strong><small>${i.id}</small></span><span>${money(i.price)}<small>порог ${money(i.threshold)}</small></span></label>`).join('');$('warning-summary').textContent=`${safe.length} SKU с допустимой ценой включены. Исключения сохраняются с менеджером, кабинетом и временем. Отмена прекращает отправку всего пакета.`;showModal('warning-modal','[data-close]');}
  else{if(activeModal)closeModal();submit(confirmItems(safe,[],new Set()),action);}
}
function requestPrices(){
  const parts=prepareItems(engine.products,selected);
  if(parts.invalid.length){notify('Проверьте данные',`${parts.invalid.length} SKU: цена или экономический порог не определены.`);return;}
  requestItems([...parts.safe,...parts.below],'price');
}
function openPromo(ids){
  promoIds=ids.filter(id=>!engine.product(id).participation);
  if(!promoIds.length){notify('Товары уже в акции');return;}
  if(promoIds.some(id=>engine.locked(id))){notify('Действие уже выполняется','Дождитесь результата по выбранным SKU.');return;}
  $('promo-title').textContent=promoIds.length===1?'Цена входа в акцию':`Добавить в акцию · ${promoIds.length} SKU`;
  $('promo-description').textContent=`${engine.product(promoIds[0]).promotionId} · Осенние предложения. Укажите отдельную цену для каждого товара.${ids.length>promoIds.length?' Товары, уже участвующие в акции, исключены из этого действия.':''}`;
  $('promo-items').innerHTML=promoIds.map(id=>promotionItemHTML(engine.product(id))).join('');showModal('promo-modal','input');
}
function confirmPromo(){
  const items=promoIds.map(id=>{const p=engine.product(id),input=document.querySelector(`[data-entry-price="${id}"]`);return {id,name:p.name,price:input.value===''?NaN:Number(input.value),threshold:p.threshold};});
  for(const i of items)if(validPrice(i.price)){engine.product(i.id).entryDraft=i.price;engine.touch(i.id);}
  persist();requestItems(items,'add');
}
function removePromo(ids){const items=ids.map(id=>engine.product(id)).filter(p=>p.participation).map(p=>({id:p.id,name:p.name,price:null,threshold:p.threshold}));requestItems(items,'remove');}
function confirmWarning(){
  if(!pending)return;const overrides=new Set([...document.querySelectorAll('[data-override]:checked')].map(c=>c.dataset.override));
  const items=confirmItems(pending.safe,pending.below,overrides);if(!items.length){notify('SKU не выбраны','Отметьте хотя бы один SKU или нажмите «Отмена».');return;}
  const action=pending.action;pending=null;closeModal();submit(items,action);
}
function simulationOptions(){const mode=$('simulation-mode').value;return {timeout:['timeout','timeout-read'].includes(mode),rejectFirst:mode==='reject',mismatchFirst:mode==='mismatch',apiDown:mode==='api-down',readLater:['read-later','timeout-read'].includes(mode),saveError:mode==='save-error'};}
function submit(items,action){
  const result=attempt(()=>engine.send(items,action,{key:crypto.randomUUID(),options:simulationOptions()}));
  if(!result)return;
  viewBatch=result.batch.id;items.forEach(i=>selected.delete(i.id));$('simulation-mode').value='normal';
  persist();render();schedule(result.batch);notify('Пакет принят в обработку',`${items.length} SKU. Ответ на отправку и автоматическая сверка показаны ниже.`);
}
function schedule(b){
  if(scheduled.has(b.id)||['confirmed','partial'].includes(b.status))return;scheduled.add(b.id);
  const check=()=>{
    engine.verify(b.id);persist();if(engine.loggedIn)render();
    if(b.status==='unconfirmed')later(check,2400);
    else{scheduled.delete(b.id);if(engine.loggedIn)notify(b.status==='confirmed'?'Результат подтверждён':'Есть расхождения',`${b.id}: ${b.items.filter(i=>i.verification==='matched').length} из ${b.items.length} SKU подтверждено. История сохранена.`);}
  };
  const receive=()=>{
    engine.receive(b.id);persist();if(engine.loggedIn)render();
    if(engine.loggedIn&&b.options.apiDown)notify('Ozon API недоступен','Применение не подтверждено. Система отдельно проверит состояние товаров.');
    else if(engine.loggedIn&&b.options.timeout)notify('Нет ответа от Ozon',b.action==='price'?'Пока неизвестно, применились ли цены. Проверяем пакет по SKU. Не отправляйте его повторно до завершения проверки.':`Проверяем, ${b.action==='add'?'добавлены ли выбранные товары в акцию':'удалены ли выбранные товары из акции'}. Пока результат не выяснен, повторный запрос не отправляется.`);
    later(check,1600);
  };
  later(b.writes?check:receive,800);
}
function renderBatch(){
  const history=engine.batches.filter(b=>b.cabinet===engine.cabinet),b=history.find(b=>b.id===viewBatch)||history.at(-1);
  $('batch-panel').hidden=!b;if(!b)return;viewBatch=b.id;
  $('batch-title').textContent=`${b.id} · ${actionNames[b.action]}`;$('batch-status').textContent=statuses[b.status][0];$('batch-status').className=`status ${statuses[b.status][1]}`;
  $('batch-message').textContent=`${b.manager} · ${date(b.at)} МСК. `+({accepted:'Пакет сохранён. Ожидается отправка.',verifying:'Ответ на отправку обработан; система читает фактическое состояние.',unconfirmed:'Часть SKU пока не удалось проверить. Чтение повторяется автоматически; запись не дублируется.',confirmed:'Целевое состояние подтверждено для всех товаров.',partial:'Сверка завершена. Не все товары достигли целевого состояния.'}[b.status]);
  $('batch-counters').textContent=`Попыток отправки: ${b.writes} · сверок: ${b.reads}`;$('retry-failed').disabled=!engine.retryItems(b.id).length;$('test-idempotency').disabled=!engine.loggedIn;
  $('batch-summary').textContent=`По SKU: ${b.items.filter(i=>i.verification==='matched').length} подтверждено / ${b.items.length} всего`;
  $('batch-items').innerHTML=b.items.map(i=>`<div class="batch-item"><strong>${esc(i.name)}<small>${i.id} · цель: ${b.action==='remove'?'вне акции':money(i.price)}</small></strong><span>Ответ API<small>${{pending:'Ожидается',reported_success:b.action==='price'?'updated: true':'product_ids: принято',rejected:'Отклонено',unknown:'Нет ответа · таймаут'}[i.submission]}${i.error?` · ${esc(i.error)}`:''}</small></span><span class="${i.verification==='mismatch'?'negative':''}">Сверка: ${{pending:'не подтверждено',matched:'совпало',mismatch:'расхождение'}[i.verification]}<small>${i.verification==='pending'?esc(i.readError||'Ожидается чтение Ozon'):`Фактическая цена ${money(i.actualPrice)}${b.action==='price'?'':` · ${i.actualParticipation?'в акции':'вне акции'}`}`}</small></span><details class="snapshot-details"><summary>Исходные значения решения</summary><p>Цена: ${money(i.snapshot.price)} · порог: ${money(i.snapshot.threshold)} · прибыль: ${money(i.snapshot.profit)} · комиссия: ${num(i.snapshot.commission*100)}%</p><p>${Object.entries(i.snapshot.costs).map(([k,v])=>`${categories[k]}: ${money(v)}`).join(' · ')}</p><p>Снимок ${date(i.snapshot.capturedAt)} МСК. Подтверждение ниже порога: ${i.override?'да':'нет'}.</p></details></div>`).join('');
  $('batch-events').innerHTML=b.events.map(e=>`<p>${date(e.at)} — ${esc(e.text)}</p>`).join('');$('batch-raw').textContent=rawResponse(b);
  const records=engine.audit.filter(r=>r.batchId===b.id);$('audit-log').hidden=!records.length;$('audit-log').innerHTML=`<strong>Подтверждены исключения ниже порога</strong>${records.map(r=>`${r.sku} · ${esc(r.manager)} · ${esc(r.decision)}`).join('<br>')}`;
}
function renderHistory(){
  const batches=engine.batches.filter(b=>b.cabinet===engine.cabinet);$('history-count').textContent=batches.length;
  $('history-list').innerHTML=[...batches].reverse().map(b=>`<button class="history-entry" type="button" data-batch="${b.id}"><strong>${b.id}</strong><span>${actionNames[b.action]} · ${b.items.length} SKU</span><small>${date(b.at)} · ${esc(b.manager)}</small><span class="status ${statuses[b.status][1]}">${statuses[b.status][0]}</span></button>`).join('')||'<p class="panel-note">Пакетов пока нет. Первая отправка появится здесь.</p>';
  const journal=engine.audit.filter(r=>r.cabinet===engine.cabinet);$('journal-count').textContent=journal.length;
  const search=$('journal-search').value.trim().toLowerCase();$('journal-list').innerHTML=[...journal].reverse().filter(r=>r.sku.toLowerCase().includes(search)).map(r=>`<div class="journal-record"><strong>${r.sku} · ${r.batchId}</strong><p>${date(r.at)} МСК · ${esc(r.manager)} · ${cabinetNames[r.cabinet]}</p><span>${esc(r.decision)}</span></div>`).join('')||'<p class="panel-note">Подтверждений ниже порога не найдено.</p>';
}
function openCalculation(id){
  const p=engine.product(id);calcId=id;$('calculation-title').textContent=`Расчёт · ${id}`;
  $('calculation-fields').innerHTML=Object.entries(p.costs).map(([key,value])=>`<label>${categories[key]}, ₽<input type="number" data-cost="${key}" aria-label="${categories[key]}" min="0" step="0.01" value="${value}"></label>`).join('')+`<label>Комиссия, %<input id="calc-commission" type="number" value="${p.commission*100}" step="0.01" min="0" max="99.99"></label><label>Надбавка, %<input id="calc-markup" type="number" value="${p.markup*100}" step="0.01" min="0"></label>`;
  showModal('calculation-modal','input');
}
function saveCalculation(){
  const read=input=>input.value===''?NaN:Number(input.value);
  const costs=Object.fromEntries([...document.querySelectorAll('[data-cost]')].map(i=>[i.dataset.cost,read(i)]));
  const ok=attempt(()=>{engine.updateCalculation(calcId,{costs,commission:read($('calc-commission'))/100,markup:read($('calc-markup'))/100});return true;});
  if(ok){closeModal();persist();render();notify('Расчёт обновлён','Новый порог и прибыль показаны в таблице. Ранее отправленные снимки и версии плана не изменились.');}
}
function applyBulk(){
  const method=$('bulk-method').value,value=Number($('bulk-value').value),items=[...selected].map(id=>engine.product(id));
  const updates=items.map(p=>({p,price:method==='target'?economy(p)?.targetPrice:method==='fixed'?value:round(p.regularPrice*(1+value/100))}));
  if((method!=='target'&&$('bulk-value').value==='')||updates.some(i=>!validPrice(i.price))){notify('Проверьте значения','Для каждого товара должна получиться положительная цена и полный расчёт.');return;}
  const ok=attempt(()=>{for(const i of updates)if(engine.locked(i.p.id))throw new Error('По части SKU ещё выполняется действие.');for(const i of updates)engine.editPrice(i.p.id,i.price);return true;});
  if(ok){closeModal();persist();render();notify('Цены подготовлены','Они изменены только в таблице. Для отправки нажмите «Загрузить цены».');}
}

// Обработчики сохраняют выбор между страницами, но никогда не смешивают кабинеты.
$('sku-search').addEventListener('input',e=>{query=e.target.value;page=1;renderCatalog();});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;page=1;renderCatalog();}));
$('sku-rows').addEventListener('click',e=>{
  const target=e.target.closest('button');if(!target)return;const d=target.dataset;
  if(d.expand)expand(d.expand);
  if(d.promo){const p=engine.product(d.promo);p.participation?removePromo([p.id]):openPromo([p.id]);}
  if(d.editcalc)openCalculation(d.editcalc);
  if(d.sale){const sale=attempt(()=>engine.simulateSale(d.sale));if(sale){period=presets.c;$('plan-period').value='c';$('custom-period').hidden=true;persist();render();notify('Демо-продажа добавлена',`Дата: ${date(sale.at)} МСК. Открыт период с новой продажей; её версия видна в деталях.`);}}
});
$('sku-rows').addEventListener('input',e=>{if(e.target.matches('[data-price]'))updatePrice(e.target);});
$('sku-rows').addEventListener('change',e=>{
  if(e.target.matches('[data-price]')){if(filter==='risk')renderCatalog();return;}
  if(!e.target.matches('[data-select]'))return;
  const id=e.target.dataset.select;if(e.target.checked)selected.add(id);else selected.delete(id);
  e.target.closest('tr').classList.toggle('selected',e.target.checked);filter==='selected'?renderCatalog():renderSelection();
});
$('select-page').addEventListener('change',e=>{visible.filter(p=>!engine.locked(p.id)).forEach(p=>e.target.checked?selected.add(p.id):selected.delete(p.id));renderCatalog();});
$('clear-selection').addEventListener('click',()=>{selected.clear();renderCatalog();});
$('select-filtered').addEventListener('click',()=>{filtered.filter(p=>!engine.locked(p.id)).forEach(p=>selected.add(p.id));renderCatalog();});
$('page-size').addEventListener('change',e=>{pageSize=Number(e.target.value);page=1;renderCatalog();});
for(const [id,step]of [['prev-page',-1],['next-page',1]])$(id).addEventListener('click',()=>{page+=step;renderCatalog();document.querySelector('.table-scroll').scrollTop=0;});
$('cabinet-select').addEventListener('change',e=>{engine.cabinet=e.target.value;selected.clear();expanded=null;query='';filter='all';page=1;viewBatch=null;$('sku-search').value='';persist();render();});
$('plan-period').addEventListener('change',e=>{$('custom-period').hidden=e.target.value!=='custom';if(e.target.value==='custom'){$('period-start').value=period.start;$('period-end').value=period.end;}else{period=presets[e.target.value];renderCatalog();}});
$('apply-period').addEventListener('click',()=>{const start=$('period-start').value,end=$('period-end').value;if(!validPeriod(start,end)){notify('Некорректный период','Укажите реальные даты; начало не должно быть позже конца.');return;}period={start,end};renderCatalog();});
$('send-prices').addEventListener('click',requestPrices);$('bulk-add').addEventListener('click',()=>openPromo([...selected]));$('bulk-remove').addEventListener('click',()=>removePromo([...selected]));
$('bulk-price').addEventListener('click',()=>{$('bulk-description').textContent=`Будут изменены черновики цен ${selected.size} выбранных SKU.`;showModal('bulk-modal','select');});
$('bulk-method').addEventListener('change',()=>{$('bulk-value-label').hidden=$('bulk-method').value==='target';});$('apply-bulk').addEventListener('click',applyBulk);
$('promo-items').addEventListener('input',e=>{if(e.target.matches('[data-entry-price]'))document.querySelector(`[data-entry-assessment="${e.target.dataset.entryPrice}"]`).innerHTML=entryAssessment(engine.product(e.target.dataset.entryPrice),Number(e.target.value));});
$('confirm-promo').addEventListener('click',confirmPromo);$('confirm-warning').addEventListener('click',confirmWarning);$('save-calculation').addEventListener('click',saveCalculation);
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{pending=null;closeModal();}));
$('retry-failed').addEventListener('click',()=>{const b=engine.batches.find(b=>b.id===viewBatch);requestItems(engine.retryItems(b.id),b.action);});
$('test-idempotency').addEventListener('click',()=>{const b=engine.batches.find(b=>b.id===viewBatch),result=attempt(()=>engine.send(b.items,b.action,{key:b.key,cabinet:b.cabinet}));if(result)notify('Дубликат не отправлен',`Возвращён прежний ${result.batch.id}. Новая команда в Ozon не создана.`);});
$('history-list').addEventListener('click',e=>{const b=e.target.closest('[data-batch]');if(b){viewBatch=b.dataset.batch;renderBatch();$('batch-panel').scrollIntoView({block:'nearest'});}});$('journal-search').addEventListener('input',renderHistory);
$('source-status').addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;const source=button.dataset.sync||button.dataset.syncFail,failed=!!button.dataset.syncFail;if(!source)return;const s=attempt(()=>engine.sync(engine.cabinet,source,failed));if(s){persist();render();notify(failed?'Источник недоступен':'Данные обновлены',failed?'Сохранены последние успешно загруженные значения и время. Ошибка не подменяет данные нулями.':'Обновление демо-источника завершено. Повторная загрузка не создаёт дубли продаж и расходов.');}});
document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>{engine.cabinet='dbs1';selected.clear();filter='all';page=1;query=b.dataset.scenario;expanded=query;$('sku-search').value=query;persist();render();}));
const openSession=()=>{$('manager-select').value=engine.manager;$('logout').hidden=!engine.loggedIn;showModal('session-modal','select');};
$('manager-session').addEventListener('click',openSession);$('open-login').addEventListener('click',openSession);
$('login').addEventListener('click',()=>{attempt(()=>engine.login($('manager-select').value));closeModal();persist();render();});
$('logout').addEventListener('click',()=>{engine.logout();selected.clear();closeModal();persist();render();notify('Демо-сессия завершена','Пакеты в обработке продолжают проверяться; каталог скрыт до входа.');});
$('reset-demo').addEventListener('click',()=>{if(!window.confirm('Сбросить демо? Локальные пакеты, журнал, новые версии плана и демо-продажи будут удалены. Исходные примеры сохранятся.'))return;timers.forEach(clearTimeout);timers.clear();scheduled.clear();engine=new DemoEngine();selected.clear();viewBatch=null;query='';filter='all';page=1;expanded=null;period=presets.a;$('sku-search').value='';$('plan-period').value='a';$('custom-period').hidden=true;$('simulation-mode').value='normal';persist();render();notify('Демо сброшено');});
$('focus-mode').addEventListener('click',()=>{const on=$('workspace').classList.toggle('is-focused');document.body.classList.toggle('workspace-focused',on);$('focus-mode').setAttribute('aria-pressed',String(on));$('focus-mode').setAttribute('aria-label',on?'Вернуться к кейсу':'На весь экран');$('focus-mode').innerHTML=on?'⤡ <span>К кейсу</span>':'⤢ <span>На весь экран</span>';});
document.addEventListener('keydown',e=>{
  if(!activeModal){if(e.key==='Escape'&&$('workspace').classList.contains('is-focused'))$('focus-mode').click();return;}
  if(e.key==='Escape'){pending=null;closeModal();return;}
  if(e.key==='Tab'){const nodes=[...$(activeModal).querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(n=>n.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
});
render();persist();for(const b of engine.batches)schedule(b);
