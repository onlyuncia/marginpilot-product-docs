// Все значения, продажи и условия акций синтетические. Это не формула исходной рабочей книги.
export const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const validPrice = n => Number.isFinite(n) && n > 0 && n <= 1e8 && Math.abs(n*100-Math.round(n*100)) < 1e-5;
export const cabinetNames = {dbs1:'Основной кабинет · DBS',dbs2:'Второй кабинет · DBS'};
export const categories = {revenue:'Выручка',unit:'Себестоимость',commission:'Комиссия',logistics:'Логистика',tariff:'Тариф',reviews:'Отзывы',ads:'Реклама',payroll:'ФОТ'};
export const presets = {a:{start:'2026-09-01',end:'2026-09-30'},b:{start:'2026-10-01',end:'2026-10-07'},c:{start:'2026-09-01',end:'2026-10-31'}};
export function validPeriod(start,end) {
  const valid = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10)===d;
  return valid(start)&&valid(end)&&start<=end;
}
export function economy(p,price=p.proposed) {
  if(!p.sourceReady || !validPrice(price) || !Number.isFinite(p.commission) || p.commission<0 || p.commission>=1 || Object.values(p.costs).some(v=>!Number.isFinite(v)||v<0))return null;
  const fixed=Object.values(p.costs).reduce((a,b)=>a+b,0), fee=round(price*p.commission), result=round(price-fixed-fee);
  return {price,commission:fee,threshold:Math.ceil(fixed/(1-p.commission)*100-1e-7)/100,profit:result,margin:round(result/price*100),targetPrice:round((fixed+p.costs.unit*p.markup)/(1-p.commission))};
}
export const profit = (p,price=p.proposed) => economy(p,price)?.profit ?? null;
export function refreshThreshold(p) {p.threshold=economy(p,Math.max(1,p.proposed||p.regularPrice))?.threshold ?? null;}
export function promotionAssessment(p,price=p.participation?p.promoEntry:p.entryDraft) {
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
export function snapshot(p,price) {return {price,costs:{...p.costs},commission:p.commission,markup:p.markup,threshold:p.threshold,profit:profit(p,price),capturedAt:null};}
function version(p,date,price,id) {return {...snapshot(p,price),id,validFrom:date,sourceBatch:null,complete:p.sourceReady};}
export function createCatalog(count=3600) {
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
export function filterCatalog(products,{query='',filter='all',selected=new Set(),cabinet=null}={}) {
  const terms=query.toLocaleLowerCase('ru').trim().split(/\s+/).filter(Boolean);
  return products.filter(p=> (!cabinet||p.cabinet===cabinet) && terms.every(term=>`${p.id} ${p.name}`.toLocaleLowerCase('ru').includes(term)) &&
    (filter==='all'||filter==='risk'&&profit(p)!==null&&profit(p)<0||filter==='promo'&&p.participation||filter==='outside'&&!p.participation||filter==='selected'&&selected.has(p.id)||filter==='exit'&&['exit','zero'].includes(promotionAssessment(p).code)||filter==='missing'&&(!p.sourceReady||!p.ozonReady)));
}
export function prepareItems(products,selected,action='price') {
  const list=products.filter(p=>selected.has(p.id)).map(p=>({id:p.id,name:p.name,price:action==='remove'?null:action==='add'?p.entryDraft:p.proposed,threshold:p.threshold}));
  return {invalid:list.filter(i=>action!=='remove'&&(!validPrice(i.price)||i.threshold===null)),safe:list.filter(i=>action==='remove'||validPrice(i.price)&&i.threshold!==null&&i.price>=i.threshold),below:list.filter(i=>action!=='remove'&&validPrice(i.price)&&i.threshold!==null&&i.price<i.threshold)};
}
export const confirmItems=(safe,below,overrides)=>[...safe.map(i=>({...i,override:false})),...below.filter(i=>overrides.has(i.id)).map(i=>({...i,override:true}))];
export function planAt(p,date) {return p.plans.filter(v=>v.validFrom<=date).sort((a,b)=>b.validFrom.localeCompare(a.validFrom))[0]||null;}
export function planFact(p,period='a') {
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
export function applyVerified(p,action,price,{at=null,batchId=null}={}) {
  if(action==='price'){p.regularPrice=price;p.proposed=price;if(!p.participation)p.current=price;}
  else if(action==='add'){if(p.participation)return;p.promoEntry=price;p.entryDraft=price;p.current=price;p.participation=true;}
  else if(action==='remove'){p.current=p.regularPrice;p.participation=false;}
  // Версия описывает фактическую цену продажи. Обычная цена не подменяет цену действующей акции.
  if(at)p.plans.push({...version(p,at,p.current,`${p.id}-V${p.plans.length+1}`),sourceBatch:batchId});
}
