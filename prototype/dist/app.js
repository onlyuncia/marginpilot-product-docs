import {filterCatalog,prepareItems,confirmItems,validPrice,validPeriod,profit,economy,planFact,promotionAssessment,presets,cabinetNames,categories,round} from './model.mjs';
import {DemoEngine} from './engine.mjs';
import {num,money,signed,tone,esc,date,actionNames,statuses,rowHTML,detailHTML,profitHTML,promotionItemHTML,entryAssessment,rawResponse} from './views.mjs';

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
