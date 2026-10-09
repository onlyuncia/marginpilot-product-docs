import test from 'node:test';
import assert from 'node:assert/strict';
import {DemoEngine} from '../dist/engine.mjs';
import {planFact,planAt,promotionAssessment,validPeriod,economy} from '../dist/model.mjs';
const fresh=()=>new DemoEngine(null,12);
const item=(e,index=0,price=1400)=>({id:e.products[index].id,price,override:false});
const send=(e,items=[item(e)],action='price',options={},key='key-1')=>e.send(items,action,{key,options}).batch;
const finish=(e,b)=>{e.receive(b.id);e.verify(b.id);};

test('Без демо-сессии отправка и изменение расчёта запрещены',()=>{
  const e=fresh();e.logout();assert.throws(()=>send(e),{code:'UNAUTHORIZED'});assert.equal(e.batches.length,0);
  e.login('Михаил · демо');assert.equal(send(e).manager,'Михаил · демо');
});
test('Кабинеты не смешиваются и переключение не изменяет старый пакет',()=>{
  const e=new DemoEngine(null,1801);
  assert.throws(()=>send(e,[item(e),item(e,1800,3000)]),{code:'CABINET_MISMATCH'});
  const b=send(e);e.cabinet='dbs2';assert.equal(b.cabinet,'dbs1');
});
test('Сбой сохранения не создаёт пакет и внешнюю отправку',()=>{
  const e=fresh();assert.throws(()=>send(e,[item(e)],'price',{saveError:true}),{code:'BATCH_SAVE_FAILED'});assert.equal(e.batches.length,0);assert.equal(e.audit.length,0);
});
test('Порог проверяется на стороне логики, не только в окне',()=>{
  const e=fresh();assert.throws(()=>send(e,[item(e,0,1000)]),{code:'BELOW_THRESHOLD_NOT_CONFIRMED'});
  const b=send(e,[{...item(e,0,1000),override:true}]);assert.equal(e.audit.length,1);assert.equal(e.audit[0].batchId,b.id);assert.equal(e.audit[0].cabinet,'dbs1');
});
test('Один ключ и тело возвращают тот же пакет; другой состав отклоняется',()=>{
  const e=fresh(),b=send(e);const duplicate=e.send([item(e)],'price',{key:'key-1'});assert.equal(duplicate.batch.id,b.id);assert.equal(duplicate.replayed,true);assert.equal(e.batches.length,1);
  assert.throws(()=>e.send([item(e,1,1000)],'price',{key:'key-1'}),{code:'IDEMPOTENCY_CONFLICT'});
});
test('Повтор по SKU защищён, но другой SKU может обрабатываться параллельно',()=>{
  const e=fresh();send(e);assert.throws(()=>send(e,[item(e)],'price',{},'new-key'),{code:'ACTION_IN_PROGRESS'});
  assert.ok(send(e,[item(e,1,1000)],'price',{},'other-key'));assert.equal(e.batches.length,2);
});
test('Ответ API не подтверждает фактическую цену',()=>{
  const e=fresh(),p=e.products[0],before=p.regularPrice,b=send(e);
  e.receive(b.id);assert.equal(b.items[0].submission,'reported_success');assert.equal(b.items[0].verification,'pending');assert.equal(p.regularPrice,before);
  e.verify(b.id);assert.equal(p.regularPrice,1400);assert.equal(b.status,'confirmed');assert.equal(p.plans.length,3);
});
test('При таймауте и отложенной сверке повторяется чтение, не запись',()=>{
  const e=fresh(),b=send(e,[item(e),item(e,1,1000)],'price',{timeout:true,readLater:true});e.receive(b.id);
  e.verify(b.id);assert.equal(b.status,'unconfirmed');assert.equal(b.items[0].verification,'pending');assert.equal(b.items[1].verification,'matched');assert.equal(e.products[0].plans.length,2);
  e.verify(b.id);assert.equal(b.status,'unconfirmed');e.verify(b.id);assert.equal(b.status,'confirmed');assert.equal(b.writes,1);assert.equal(b.reads,3);assert.equal(b.items[0].submission,'unknown');
  e.verify(b.id);assert.equal(e.products[0].plans.length,3);
});
test('Недоступность API оставляет состояние неизвестным до успешного чтения',()=>{
  const e=fresh(),b=send(e,[item(e)],'price',{apiDown:true});e.receive(b.id);e.verify(b.id);
  assert.equal(b.status,'unconfirmed');assert.equal(b.items[0].actualPrice,null);assert.equal(e.sources.dbs1.ozon.status,'error');e.verify(b.id);e.verify(b.id);
  assert.equal(b.status,'partial');assert.equal(b.items[0].verification,'mismatch');assert.equal(e.products[0].regularPrice,1290);assert.equal(b.writes,1);
});
test('Повтор предлагается только для установленного расхождения',()=>{
  const e=fresh(),b=send(e,[item(e),item(e,1,1000)],'price',{rejectFirst:true});finish(e,b);
  assert.equal(b.status,'partial');const retries=e.retryItems(b.id);assert.equal(retries.length,1);assert.equal(retries[0].id,e.products[0].id);assert.equal(retries[0].override,false);
  const retry=send(e,retries,'price',{},'retry-key');finish(e,retry);assert.equal(retry.status,'confirmed');assert.equal(e.batches.length,2);
});
test('Обычная цена не заменяет цену действующей акции',()=>{
  const e=fresh(),p=e.products[2],entry=p.promoEntry,b=send(e,[item(e,2,1600)]);finish(e,b);
  assert.equal(p.regularPrice,1600);assert.equal(p.current,entry);assert.equal(p.promoEntry,entry);
  const exit=send(e,[item(e,2,null)],'remove',{},'exit-key');finish(e,exit);assert.equal(p.current,1600);assert.equal(p.participation,false);
});
test('Пакетный вход имеет отдельные цены и рекомендации',()=>{
  const e=fresh(),b=send(e,[item(e,0,1270),item(e,1,870)],'add');finish(e,b);
  assert.equal(e.products[0].regularPrice,1290);assert.equal(e.products[1].regularPrice,890);assert.equal(e.products[0].current,1270);assert.equal(b.status,'confirmed');
  assert.equal(promotionAssessment(e.products[5]).code,'zero');assert.equal(promotionAssessment(e.products[8]).code,'exit');
});
test('Цена выше лимита акции отклоняется независимо от экономической выгоды',()=>{
  const e=fresh(),b=send(e,[item(e,0,2000)],'add');finish(e,b);assert.equal(b.items[0].submission,'rejected');assert.equal(b.items[0].verification,'mismatch');assert.equal(e.products[0].participation,false);
});
test('Снимок и исторические версии не меняются от нового сценария расчёта',()=>{
  const e=fresh(),p=e.products[0],b=send(e);finish(e,b);const snapshot=JSON.stringify(b.items[0].snapshot),history=JSON.stringify(p.plans),before=planFact(p,'a');
  e.updateCalculation(p.id,{costs:{...p.costs,ads:90},commission:.2,markup:.3});assert.equal(JSON.stringify(b.items[0].snapshot),snapshot);assert.equal(JSON.stringify(p.plans),history);assert.deepEqual(planFact(p,'a'),before);assert.notEqual(economy(p).threshold,1250);
});
test('Новая продажа использует подтверждённую новую версию, старая — историческую',()=>{
  const e=fresh(),p=e.products[0],before=planFact(p,'a'),b=send(e);finish(e,b);const sale=e.simulateSale(p.id),plan=planAt(p,sale.at);
  assert.equal(plan.sourceBatch,b.id);assert.equal(plan.price,1400);assert.deepEqual(planFact(p,'a'),before);assert.equal(planFact(p,'c').sales.at(-1).planId,plan.id);
});
test('Отсутствие плана и себестоимости не превращается в нули',()=>{
  const e=fresh(),missingPlan=planFact(e.products[4],'a'),missingCost=planFact(e.products[9],'a');
  assert.ok(missingPlan.missingUnits>0);assert.equal(missingPlan.plan,null);assert.equal(missingPlan.delta,null);assert.ok(missingPlan.fact!==null);
  assert.equal(missingCost.actual.unit,null);assert.equal(missingCost.fact,null);assert.equal(missingCost.perUnit,null);
});
test('Период включает весь последний день и отклоняет неверные даты',()=>{
  assert.equal(validPeriod('2026-09-31','2026-10-02'),false);assert.equal(validPeriod('2026-10-02','2026-09-01'),false);
  const p=fresh().products[0];assert.ok(planFact(p,{start:'2026-09-06',end:'2026-09-06'}).units>0);assert.throws(()=>planFact(p,{start:'2026-10-03',end:'2026-10-01'}));
});
test('Обновление источника устраняет пропуск и не дублирует продажи',()=>{
  const e=fresh(),p=e.products[6],len=p.sales.length;assert.equal(p.threshold,null);e.sync('dbs1','one_c');assert.equal(p.sourceReady,true);assert.ok(p.threshold>0);
  e.sync('dbs1','ozon');e.sync('dbs1','ozon');assert.equal(p.sales.length,len);const at=e.sources.dbs1.ozon.at;e.sync('dbs1','ozon',true);assert.equal(e.sources.dbs1.ozon.at,at);
});
test('Восстановление сохраняет пакеты, журнал, планы и продажи без повторной записи',()=>{
  const e=fresh(),b=send(e,[{...item(e,0,1200),override:true}]);e.receive(b.id);const restored=new DemoEngine(JSON.parse(JSON.stringify(e.toJSON())),12);
  assert.equal(restored.batches[0].writes,1);restored.verify(b.id);restored.simulateSale(restored.products[0].id);
  const again=new DemoEngine(JSON.parse(JSON.stringify(restored.toJSON())),12);assert.equal(again.products[0].plans.length,3);assert.equal(again.audit.length,1);assert.equal(again.batches[0].writes,1);assert.equal(again.products[0].sales.length,3);
});
