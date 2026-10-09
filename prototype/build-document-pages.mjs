import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=new URL('.',import.meta.url);
const root=fileURLToPath(new URL('../',here));
const dist=fileURLToPath(new URL('./dist/',here));
const output=join(dist,'docs');
await mkdir(output,{recursive:true});

const docs=[
  ['process','02-PROCESS-AS-IS-TO-BE.md','Бизнес-анализ / Процесс'],
  ['functional','03-FUNCTIONAL-REQUIREMENTS.md','Бизнес-анализ / Требования'],
  ['results','04-RESULTS.md','Бизнес-анализ / Результат'],
  ['constraints','05-CONSTRAINTS-DEPENDENCIES.md','Бизнес-анализ / Контекст'],
  ['risks','06-RISKS-MITIGATION.md','Бизнес-анализ / Риски'],
  ['stakeholders','07-STAKEHOLDERS.md','Бизнес-анализ / Стейкхолдеры'],
  ['success','08-PROJECT-SUCCESS.md','Бизнес-анализ / Критерии'],
  ['expansion','09-EXPANSION-PLANS.md','Бизнес-анализ / Развитие'],
  ['usecases','10-USE-CASES.md','Системный анализ / Сценарии'],
  ['nfr','11-NON-FUNCTIONAL-REQUIREMENTS.md','Системный анализ / Качество'],
  ['architecture','01-SYSTEM-ARCHITECTURE.md','Системный анализ / Архитектура'],
  ['acceptance','16-ACCEPTANCE-CRITERIA.md','Системный анализ / Приёмка'],
  ['backend','12-BACKEND-LOGIC.md','Техническое приложение / Логика'],
  ['http','13-HTTP-CONTRACT.md','Техническое приложение / HTTP'],
  ['db','14-DATABASE-SCHEMA.dbml','Техническое приложение / Данные'],
  ['openapi','15-OPENAPI.json','Техническое приложение / Контракт']
];
const documentPages=Object.fromEntries(docs.map(([page,file])=>[file,page+'.html']));

const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inline=(text,pathPrefix='../../')=>{
  let value=escape(text);
  value=value.replace(/`([^`]+)`/g,'<code>$1</code>');
  value=value.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  value=value.replace(/\*([^*]+)\*/g,'<em>$1</em>');
  value=value.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,(_,alt,href)=>{
    const target=/^(https?:|data:)/i.test(href)?href:`${pathPrefix}${href.replace(/^\.\//,'')}`;
    return `<img class="doc-inline-image" src="${target}" alt="${alt}">`;
  });
  value=value.replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,label,href)=>{
    let target=href;
    const hashIndex=target.indexOf('#');
    const base=hashIndex>=0?target.slice(0,hashIndex):target;
    const hash=hashIndex>=0?target.slice(hashIndex):'';
    const pagePrefix=pathPrefix==='../../../'?'':'docs/';
    if(documentPages[base])target=`${pagePrefix}${documentPages[base]}${hash}`;
    else if(base==='case-marginpilot.md')target=`${pathPrefix==='../../../'?'../index.html':'index.html'}${hash||'#story'}`;
    else if(!/^(https?:|#|mailto:)/i.test(target))target=`../../${target.replace(/^\.\//,'')}`;
    return `<a href="${target}">${label}</a>`;
  });
  return value;
};
const slug=text=>text.toLowerCase().replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'');
const xmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wrapText=(text,max=34)=>{
  const words=String(text).split(/\s+/);const lines=[];let line='';
  for(const word of words){
    if(!line){line=word;continue;}
    if((line+' '+word).length<=max)line+=' '+word;
    else{lines.push(line);line=word;}
  }
  if(line)lines.push(line);
  return lines.length?lines:[''];
};
const svgText=(x,y,text,opts={})=>{
  const lines=wrapText(text,opts.max||34);const anchor=opts.anchor||'start';const size=opts.size||13;const fill=opts.fill||'#31433a';
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${size}" font-weight="${opts.weight||400}" fill="${fill}">${lines.map((line,i)=>`<tspan x="${x}" dy="${i?size+3:0}">${xmlEscape(line)}</tspan>`).join('')}</text>`;
};
function renderSequenceDiagram(source){
  const lines=source.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).filter(line=>line!=='sequenceDiagram');
  const participants=[];const events=[];const fragments=[];const openFragments=[];
  const addParticipant=(id,label,type='participant')=>{if(id&&!participants.some(item=>item.id===id))participants.push({id,label:label||id,type});};
  const fragmentStart=new Set(['alt','opt','loop','par']);
  for(const line of lines){
    let match=line.match(/^(actor|participant)\s+(\w+)(?:\s+as\s+(.+))?$/);
    if(match){addParticipant(match[2],match[3],match[1]);continue;}
    match=line.match(/^(alt|else|opt|loop|par|and)\b\s*(.*)$/);
    if(match){
      const type=match[1];const label=match[2]||'';
      if(fragmentStart.has(type)){
        const fragment={type,label,start:events.length,depth:openFragments.length,branches:[]};fragments.push(fragment);events.push({kind:'fragment-start',fragment,depth:fragment.depth});openFragments.push(fragment);
      }else if(openFragments.length){
        const fragment=openFragments[openFragments.length-1];events.push({kind:'fragment-branch',fragment,type,label,depth:Math.max(0,openFragments.length-1)});fragment.branches.push(events.length-1);
      }
      continue;
    }
    if(line==='end'){
      const fragment=openFragments.pop();
      if(fragment){fragment.end=events.length;events.push({kind:'fragment-end',fragment,depth:openFragments.length});}
      continue;
    }
    match=line.match(/^Note\s+(?:over\s+([^:]+)|right\s+of\s+(\w+)):\s*(.*)$/i);
    if(match){events.push({kind:'note',targets:(match[1]||match[2]).split(',').map(value=>value.trim()),label:match[3],depth:openFragments.length});continue;}
    match=line.match(/^(\w+)\s*(-->>|->>|-->|->)\s*(\w+)\s*:\s*(.*)$/);
    if(match){addParticipant(match[1]);addParticipant(match[3]);events.push({kind:'message',from:match[1],to:match[3],line:match[2],label:match[4],depth:openFragments.length});}
  }
  const gap=220;const left=24;const cardWidth=176;const width=Math.max(960,left*2+Math.max(1,participants.length-1)*gap+cardWidth);const headerY=20;const headerH=64;const contentY=headerY+headerH+34;
  const xFor=id=>left+(Math.max(0,participants.findIndex(item=>item.id===id)))*gap+cardWidth/2;
  const rowHeight=event=>event.kind==='fragment-start'||event.kind==='fragment-branch'?30:event.kind==='fragment-end'?10:event.kind==='note'?72:60;
  const rows=[];let y=contentY;for(const event of events){const height=rowHeight(event);rows.push({y,height});y+=height;}
  const height=y+30;const palette={alt:['#fff8ed','#b77821','#f0d5a3'],opt:['#f2faf6','#3d8762','#bfdfcd'],loop:['#f1f7fc','#477da9','#c8dced'],par:['#f7f2fb','#79569a','#dacbe8']};
  let svg=`<div class="doc-sequence"><svg class="sequence-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Диаграмма последовательности MarginPilot"><title>Диаграмма последовательности MarginPilot</title><rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#fbfcfa" stroke="#d9e4d8"/>`;
  for(const fragment of fragments){
    if(fragment.end===undefined)continue;
    const colors=palette[fragment.type]||palette.opt;const start=rows[fragment.start];const end=rows[fragment.end];const frameX=12+fragment.depth*18;const frameY=start.y-8;const frameBottom=end.y+end.height;const frameWidth=width-frameX-12;
    svg+=`<rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="${frameBottom-frameY}" rx="10" fill="${colors[0]}" fill-opacity="0.65" stroke="${colors[2]}" stroke-width="1.5"/>`;
    const label=`${fragment.type.toUpperCase()}${fragment.label?` [${fragment.label}]`:''}`;svg+=`<rect x="${frameX}" y="${frameY}" width="${Math.min(frameWidth-20,Math.max(86,label.length*7+22))}" height="24" rx="6" fill="${colors[2]}"/><text x="${frameX+11}" y="${frameY+16}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="700" fill="${colors[1]}">${xmlEscape(label)}</text>`;
    fragment.branches.forEach(index=>{const branch=events[index];const row=rows[index];const branchLabel=`${branch.type.toUpperCase()}${branch.label?` [${branch.label}]`:''}`;svg+=`<line x1="${frameX}" y1="${row.y+4}" x2="${width-12}" y2="${row.y+4}" stroke="${colors[2]}" stroke-dasharray="5 4"/><text x="${frameX+11}" y="${row.y+22}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="700" fill="${colors[1]}">${xmlEscape(branchLabel)}</text>`;});
  }
  participants.forEach((participant,index)=>{const x=left+index*gap+cardWidth/2;if(participant.type==='actor'){svg+=`<circle cx="${x}" cy="${headerY+12}" r="7" fill="none" stroke="#213b31" stroke-width="2"/><path d="M ${x} ${headerY+20} v 20 M ${x-14} ${headerY+27} h 28 M ${x} ${headerY+40} l -12 16 M ${x} ${headerY+40} l 12 16" fill="none" stroke="#213b31" stroke-width="2" stroke-linecap="round"/>${svgText(x,headerY+78,participant.label,{max:22,anchor:'middle',size:12,weight:700,fill:'#213b31'})}`;}else{svg+=`<rect x="${x-cardWidth/2}" y="${headerY}" width="${cardWidth}" height="${headerH}" rx="12" fill="#213b31"/>${svgText(x,headerY+20,participant.label,{max:20,anchor:'middle',size:11,weight:700,fill:'#fff'})}<text x="${x}" y="${headerY+51}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="10" fill="#b9d4c3">${xmlEscape(participant.id)}</text>`;}const lineStart=participant.type==='actor'?headerY+88:headerY+headerH;svg+=`<line x1="${x}" y1="${lineStart}" x2="${x}" y2="${height-18}" stroke="#a8bfb0" stroke-dasharray="5 5"/>`;});
  events.forEach((event,index)=>{const row=rows[index];const rowY=row.y;
    if(event.kind==='fragment-start'||event.kind==='fragment-end')return;
    if(event.kind==='fragment-branch')return;
    if(event.kind==='note'){const indexes=event.targets.map(id=>participants.findIndex(item=>item.id===id)).filter(item=>item>=0);const min=indexes.length?Math.min(...indexes):0;const max=indexes.length?Math.max(...indexes):Math.max(0,participants.length-1);const x1=left+min*gap+22;const x2=left+max*gap+cardWidth-22;const noteWidth=Math.max(230,Math.min(width-x1-20,x2-x1));svg+=`<path d="M ${x1+10} ${rowY+8} h ${noteWidth-20} l 10 10 v ${row.height-18} h -${noteWidth} z" fill="#fff4cc" stroke="#e3c86e"/>${svgText(x1+17,rowY+31,event.label,{max:42,size:12,fill:'#725d23'})}`;return;}
    const x1=xFor(event.from);const x2=xFor(event.to);const lineY=rowY+36;const direction=x2>=x1?1:-1;const dashed=event.line.startsWith('--');const start=x1+direction*10;const end=x2-direction*12;
    if(x1===x2){svg+=`<path d="M ${x1} ${lineY} h 52 v 20 h -40" fill="none" stroke="#4e7563" stroke-width="1.6" ${dashed?'stroke-dasharray="6 4"':''}/><path d="M ${x1-2} ${lineY+20} l 9 -5 v 10 z" fill="#4e7563"/>${svgText(x1+12,rowY+18,event.label,{max:38,size:12,fill:'#31433a'})}`;}
    else{svg+=`<line x1="${start}" y1="${lineY}" x2="${end}" y2="${lineY}" stroke="#4e7563" stroke-width="1.6" ${dashed?'stroke-dasharray="6 4"':''}/><path d="M ${x2} ${lineY} l ${-direction*10} -5 v 10 z" fill="#4e7563"/>${svgText((x1+x2)/2,rowY+18,event.label,{max:42,anchor:'middle',size:12,fill:'#31433a'})}`;}
  });
  svg+='</svg></div>';return svg;
}
function renderFlowchart(source){
  const lines=source.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).filter(line=>!/^flowchart\s+/i.test(line));
  const nodes=new Map();const edges=[];const nodePattern=/(\w+)\s*(\["([^"]+)"\]|\{"([^"]+)"\})/g;
  const addNode=(id,label,type='action')=>{if(id&&!nodes.has(id))nodes.set(id,{id,label:label||id,type});};
  for(const line of lines){
    let match;
    while((match=nodePattern.exec(line))){addNode(match[1],match[3]||match[4],match[2].startsWith('{')?'decision':'action');}
    nodePattern.lastIndex=0;
    const edgePattern=/^(\w+)(?:\s*(?:\["[^"]+"\]|\{"[^"]+"\}))?\s+(?:--\s*"([^"]+)"\s*-->|-->)\s*(\w+)(?:\s*(?:\["[^"]+"\]|\{"[^"]+"\}))?/;
    match=line.match(edgePattern);
    if(match){addNode(match[1]);addNode(match[3]);edges.push({from:match[1],to:match[3],label:match[2]||''});}
  }
  const position={A:[0,0],B:[0,1],C:[0,2],D:[0,3],E:[-1,4],F:[-1,5],X:[-1,6],G:[0,6],H:[0,7],S:[0,8],I:[0,9],J:[0,10],K:[-1,11],T:[1,11],L:[0,12],M:[0,13],N:[-1,14],O:[0,14],R:[1,14],P:[-1,15],Q:[-1,16]};
  const fallback=[0,0];const gapX=250;const gapY=100;const originX=550;const originY=38;const width=1100;const nodeWidth=210;
  const box=node=>{const lines=wrapText(node.label,node.type==='decision'?25:28);const height=node.type==='decision'?94:Math.max(62,28+lines.length*16);const grid=position[node.id]||fallback;const x=originX+grid[0]*gapX;const y=originY+grid[1]*gapY;return {...node,x,y,width:nodeWidth,height,lines};};
  const boxes=new Map([...nodes.values()].map(node=>[node.id,box(node)]));
  const arrowId='flow-arrow';let svg=`<div class="doc-flowchart"><svg class="flowchart-svg" viewBox="0 0 ${width} 1770" role="img" aria-label="Высокоуровневый поток MarginPilot"><title>Высокоуровневый поток MarginPilot</title><defs><marker id="${arrowId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4e7563"/></marker></defs><rect x="0" y="0" width="${width}" height="1770" rx="18" fill="#fbfcfa" stroke="#d9e4d8"/>`;
  const colors=node=>{if(['A','P'].includes(node.id))return ['#e9f5ed','#5b9a70','#244e30'];if(['D','E','J','M'].includes(node.id))return ['#fff4d8','#c59339','#5e4311'];if(['F','T','O','R'].includes(node.id))return ['#fff0ed','#c56d5f','#692d24'];if(node.id==='X')return ['#f1f4f1','#8a958d','#354039'];return ['#eef3f8','#6686a5','#1d344b'];};
  const point=(b,side)=>({x:side==='left'?b.x-b.width/2:side==='right'?b.x+b.width/2:b.x,y:side==='top'?b.y:side==='bottom'?b.y+b.height:b.y+b.height/2});
  const edgeLabels=[];
  for(const edge of edges){const from=boxes.get(edge.from),to=boxes.get(edge.to);if(!from||!to)continue;let start,end,path,labelX=(from.x+to.x)/2,labelY=(from.y+to.y)/2;
    if(to.y>=from.y){start=point(from,'bottom');end=point(to,'top');path=`M ${start.x} ${start.y} C ${start.x} ${start.y+30}, ${end.x} ${end.y-30}, ${end.x} ${end.y}`;}
    else{start=point(from,'right');end=point(to,'right');const bend=Math.max(start.x,end.x)+150;path=`M ${start.x} ${start.y} C ${bend} ${start.y}, ${bend} ${end.y}, ${end.x} ${end.y}`;labelX=bend-18;labelY=(start.y+end.y)/2;}
    svg+=`<path d="${path}" fill="none" stroke="#4e7563" stroke-width="2" marker-end="url(#${arrowId})"/>`;
    if(edge.label){if(Math.abs(end.y-start.y)<80){labelX=end.x;labelY=Math.min(start.y,end.y)-18;}const labelLines=wrapText(edge.label,25);const labelWidth=Math.max(74,Math.max(...labelLines.map(value=>value.length))*7+20);const labelHeight=labelLines.length*15+10;edgeLabels.push({label:edge.label,labelX,labelY,labelWidth,labelHeight});}
  }
  for(const node of boxes.values()){const [fill,stroke,textColor]=colors(node);if(node.type==='decision'){const points=`${node.x},${node.y} ${node.x+node.width/2},${node.y+node.height/2} ${node.x},${node.y+node.height} ${node.x-node.width/2},${node.y+node.height/2}`;svg+=`<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>${svgText(node.x,node.y+node.height/2-((node.lines.length-1)*7),node.label,{max:25,anchor:'middle',size:12,weight:700,fill:textColor})}`;}else{svg+=`<rect x="${node.x-node.width/2}" y="${node.y}" width="${node.width}" height="${node.height}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="2"/>${svgText(node.x,node.y+28-((node.lines.length-1)*7),node.label,{max:28,anchor:'middle',size:12,weight:700,fill:textColor})}`;}}
  const placedLabels=[];const overlaps=(x,y,w,h,otherX,otherY,otherW,otherH,padding=8)=>x-w/2<otherX+otherW/2+padding&&x+w/2>otherX-otherW/2-padding&&y-h/2<otherY+otherH/2+padding&&y+h/2>otherY-otherH/2-padding;
  for(const item of edgeLabels){const candidates=[[item.labelX,item.labelY],[item.labelX+170,item.labelY],[item.labelX-170,item.labelY],[item.labelX,item.labelY-54],[item.labelX,item.labelY+54],[item.labelX+250,item.labelY],[item.labelX-250,item.labelY],[item.labelX+320,item.labelY],[item.labelX-320,item.labelY],[100,item.labelY],[width-100,item.labelY]];const candidate=candidates.find(([x,y])=>x-item.labelWidth/2>12&&x+item.labelWidth/2<width-12&&y-item.labelHeight/2>10&&y+item.labelHeight/2<1758&&!Array.from(boxes.values()).some(box=>overlaps(x,y,item.labelWidth,item.labelHeight,box.x,box.y+box.height/2,box.width,box.height))&&!placedLabels.some(label=>overlaps(x,y,item.labelWidth,item.labelHeight,label.x,label.y,label.width,label.height,5)))||candidates[0];item.labelX=candidate[0];item.labelY=candidate[1];placedLabels.push({x:item.labelX,y:item.labelY,width:item.labelWidth,height:item.labelHeight});const labelLines=wrapText(item.label,25);svg+=`<rect x="${item.labelX-item.labelWidth/2}" y="${item.labelY-item.labelHeight/2}" width="${item.labelWidth}" height="${item.labelHeight}" rx="8" fill="#fbfcfa" stroke="#d9e4d8"/>${svgText(item.labelX,item.labelY-((labelLines.length-1)*7),item.label,{max:25,anchor:'middle',size:11,fill:'#42614f'})}`;}
  svg+='</svg></div>';return svg;
}

function renderMarkdown(markdown,pathPrefix='../../'){
  const lines=markdown.replace(/^\uFEFF/,'').split(/\r?\n/);
  const headings=[];let html='';let i=0;let paragraph=[];let listType=null;
  const flushParagraph=()=>{if(paragraph.length){html+=`<p>${inline(paragraph.join(' '),pathPrefix)}</p>`;paragraph=[];}};
  const closeList=()=>{if(listType){html+=`</${listType}>`;listType=null;}};
  while(i<lines.length){
    const line=lines[i];
    if(/^```/.test(line)){flushParagraph();closeList();const lang=line.slice(3).trim();const block=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))block.push(lines[i++]);i++;const source=block.join('\n');html+=lang==='mermaid'&&/^\s*sequenceDiagram/.test(source)?renderSequenceDiagram(source):lang==='mermaid'&&/^\s*flowchart\s+TD/i.test(source)?renderFlowchart(source):`<pre class="doc-code ${lang==='mermaid'?'doc-mermaid':''}"><code>${escape(source)}</code></pre>`;continue;}
    const h=line.match(/^(#{1,4})\s+(.+)$/);
    if(h){flushParagraph();closeList();const level=Math.min(4,h[1].length);const text=h[2].replace(/\s+#*$/,'').trim();if(level>1){const id=slug(text);headings.push({level,text,id});html+=`<h${level} id="${id}">${inline(text,pathPrefix)}</h${level}>`;}i++;continue;}
    if(/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)){flushParagraph();closeList();html+='<hr>';i++;continue;}
    const tableStart=line.trim().startsWith('|')&&i+1<lines.length&&/^\s*\|?\s*:?-{2,}/.test(lines[i+1]);
    if(tableStart){flushParagraph();closeList();const parseRow=s=>s.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim());const headers=parseRow(line);html+='<div class="doc-table-wrap"><table class="doc-table"><thead><tr>'+headers.map(x=>`<th>${inline(x,pathPrefix)}</th>`).join('')+'</tr></thead><tbody>';i+=2;while(i<lines.length&&lines[i].trim().startsWith('|')){const cells=parseRow(lines[i]);html+='<tr>'+headers.map((_,n)=>`<td>${inline(cells[n]||'',pathPrefix)}</td>`).join('')+'</tr>';i++;}html+='</tbody></table></div>';continue;}
    const ul=line.match(/^\s*[-*+]\s+(.+)$/);const ol=line.match(/^\s*\d+[.)]\s+(.+)$/);
    if(ul||ol){flushParagraph();const nextType=ul?'ul':'ol';if(listType!==nextType){closeList();listType=nextType;html+=`<${listType}>`;}html+=`<li>${inline((ul||ol)[1],pathPrefix)}</li>`;i++;continue;}
    if(/^>\s?/.test(line)){flushParagraph();closeList();const quote=[];while(i<lines.length&&/^>\s?/.test(lines[i]))quote.push(lines[i++].replace(/^>\s?/,'').trim());html+=`<blockquote>${inline(quote.join(' '),pathPrefix)}</blockquote>`;continue;}
    if(!line.trim()){flushParagraph();closeList();i++;continue;}
    paragraph.push(line.trim());i++;
  }
  flushParagraph();closeList();return {html,headings};
}

const commonNav=`<header class="site-header"><div class="wrap header-inner"><a class="brand" href="../index.html#top"><span class="brand-mark" aria-hidden="true">m<span>↗</span></span>MarginPilot <small>/ case</small></a><nav aria-label="Навигация по кейсу"><a href="../index.html#story">Контекст</a><a href="../artifacts.html">Артефакты</a><a href="../documents.html">Карта документов</a></nav><a class="header-action" href="../index.html#demo">Открыть продукт <span>↗</span></a></div></header>`;
const artifactContent={};
for(const [slugName,file,kicker] of docs){
  const source=await readFile(join(root,file),'utf8');
  const title=(source.match(/^#\s+(.+)$/m)||[,basename(file,'.md')])[1].trim();
  const rendered=file.endsWith('.dbml')||file.endsWith('.json')?{html:`<pre class="doc-code"><code>${escape(file.endsWith('.json')?JSON.stringify(JSON.parse(source),null,2):source)}</code></pre>`,headings:[]}:renderMarkdown(source,'../../../');
  const embedded=file.endsWith('.dbml')||file.endsWith('.json')?rendered.html:renderMarkdown(source,'../../').html;
  artifactContent[slugName]=embedded;
  const toc=rendered.headings.filter(h=>h.level<=2).map(h=>`<a href="#${h.id}">${inline(h.text)}</a>`).join('');
  const sourceLink=file.endsWith('.md')?'':`<a href="../../../${file}">Открыть исходный файл ↗</a>`;
  const tocSourceLink=file.endsWith('.md')?'':`<a class="document-toc-source" href="../../../${file}">Исходный файл ↗</a>`;
  const body=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${escape(title)} — полный документ кейса MarginPilot"><meta name="theme-color" content="#f7f8f5"><title>MarginPilot — ${escape(title)}</title><link rel="stylesheet" href="../styles.css"></head><body>${commonNav}<main class="document-page"><section class="document-page-hero"><div class="wrap"><a class="artifact-breadcrumb" href="../artifacts.html">← Все артефакты</a><p class="kicker">${escape(kicker)}</p><h1>${inline(title)}</h1><div class="document-page-meta"><span>Полный документ</span><span>Исходный формат: ${file.endsWith('.dbml')?'DBML':file.endsWith('.json')?'JSON':'Markdown'}</span>${sourceLink}</div></div></section><section class="document-page-content"><div class="wrap document-layout"><article class="document-body">${rendered.html}</article><aside class="document-toc"><small>СОДЕРЖАНИЕ</small>${toc}${tocSourceLink}</aside></div></section></main><footer><div class="wrap"><a class="brand" href="../index.html#top">MarginPilot ↗</a><p>Портфельный кейс бизнес- и системного аналитика</p><a href="../artifacts.html">Все артефакты →</a></div></footer></body></html>`;
  await writeFile(join(output,`${slugName}.html`),body,'utf8');
}
await writeFile(join(dist,'document-content.js'),`window.MarginPilotDocumentContent=${JSON.stringify(artifactContent)};`,'utf8');
