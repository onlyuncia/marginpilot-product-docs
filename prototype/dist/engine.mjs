import {createCatalog,snapshot,validPrice,refreshThreshold,applyVerified,promotionAssessment,economy,round} from './model.mjs';

export const managers=['Анна · демо','Михаил · демо','Ирина · демо'];
export class DemoError extends Error {constructor(code,message){super(message);this.code=code;}}
const fail=(code,message)=>{throw new DemoError(code,message);};
const terminal=b=>['confirmed','partial'].includes(b.status);
export class DemoEngine {
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
