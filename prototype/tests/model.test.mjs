import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalog,filterCatalog,prepareItems,confirmItems,validPrice,profit,planFact,applyVerified} from '../dist/model.mjs';

test('Каталог содержит 3600 уникальных SKU и оба состояния участия',()=>{
  const data=createCatalog();assert.equal(data.length,3600);assert.equal(new Set(data.map(p=>p.id)).size,3600);
  assert.ok(data.some(p=>p.participation));assert.ok(data.some(p=>!p.participation));
});
test('Поиск работает по артикулу, названию и нескольким словам',()=>{
  const data=createCatalog();assert.equal(filterCatalog(data,{query:'SKU-DEMO-3600'})[0].id,'SKU-DEMO-3600');
  assert.ok(filterCatalog(data,{query:'смеситель кухня'}).length===0);
  assert.ok(filterCatalog(data,{query:'смеситель кухни'}).every(p=>p.name.includes('кухни')));
  assert.equal(filterCatalog(data,{query:'несуществующий товар'}).length,0);
});
test('Фильтры учитывают участие, риск и выбор между страницами',()=>{
  const data=createCatalog(),selected=new Set([data[0].id,data[3599].id]);
  assert.equal(filterCatalog(data,{filter:'selected',selected}).length,2);
  assert.ok(filterCatalog(data,{filter:'risk'}).every(p=>p.proposed<p.threshold));
  assert.ok(filterCatalog(data,{filter:'promo'}).every(p=>p.participation));
  assert.ok(filterCatalog(data,{filter:'outside'}).every(p=>!p.participation));
});
test('Цена положительная, конечная, с точностью до копеек',()=>{
  [NaN,Infinity,0,-12,1.234,100000001].forEach(v=>assert.equal(validPrice(v),false));
  [0.01,1290,1290.12,100000000].forEach(v=>assert.equal(validPrice(v),true));
});
test('Предупреждение не включает рискованные SKU по умолчанию',()=>{
  const data=createCatalog(4), selected=new Set(data.map(p=>p.id));
  const {safe,below,invalid}=prepareItems(data,selected);assert.equal(invalid.length,0);assert.equal(below.length,1);
  assert.equal(confirmItems(safe,below,new Set()).length,3);
  const confirmed=confirmItems(safe,below,new Set([below[0].id]));assert.equal(confirmed.length,4);assert.equal(confirmed.filter(i=>i.override).length,1);
  assert.equal(confirmItems([],below,new Set()).length,0);
});
test('Экономика равна нулю на пороге и учитывает комиссию',()=>{
  const p=createCatalog(1)[0];assert.equal(profit(p,p.threshold),0);assert.equal(profit(p,1290),32.8);
  const fixed=Object.values(p.costs).reduce((a,b)=>a+b,0);assert.ok(Math.abs(fixed-p.threshold*.82)<.01);
});
test('Вход сохраняет старую цену, выход восстанавливает её',()=>{
  const p=createCatalog(1)[0],old=p.current;applyVerified(p,'add',1270);
  assert.equal(p.participation,true);assert.equal(p.current,1270);assert.equal(p.regularPrice,old);
  applyVerified(p,'remove',null);assert.equal(p.participation,false);assert.equal(p.current,old);
});
test('Повторная фиксация входа не перезаписывает старую цену',()=>{
  const p=createCatalog(1)[0],old=p.current;applyVerified(p,'add',1270);applyVerified(p,'add',1270);assert.equal(p.regularPrice,old);
});
test('Нет продаж: расходы видны, значения на единицу отсутствуют',()=>{
  const p=createCatalog(1)[0],plan=planFact(p,'b');assert.equal(plan.units,0);assert.equal(plan.ads,180);
  assert.equal(plan.fact,-180);assert.equal(plan.perUnit,null);assert.equal(plan.deltaPerUnit,null);
});
test('Новое решение не изменяет исторический план-факт',()=>{
  const p=createCatalog(1)[0],before=planFact(p,'a');applyVerified(p,'price',1500);assert.deepEqual(planFact(p,'a'),before);
});
