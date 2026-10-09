import {access, cp, lstat, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Публикуем только готовый сайт и явно перечисленные публичные приложения.
// Рабочая книга, временные файлы и прочее содержимое проекта в Pages не попадают.
const root=fileURLToPath(new URL('../',import.meta.url));
const source=join(root,'prototype','dist');
const target=join(root,'pages-build');
const marker=join(target,'.marginpilot-generated');

if(resolve(target)!==resolve(root,'pages-build'))throw new Error('Неверный путь сборки Pages');
let current;
try{current=await lstat(target);}catch(error){if(error.code!=='ENOENT')throw error;}
if(current){
  if(!current.isDirectory()||current.isSymbolicLink())throw new Error('Папка сборки не является обычным каталогом');
  try{await readFile(marker,'utf8');}
  catch{throw new Error('Папка pages-build уже существует, но не помечена как автоматически созданная сборка');}
  await rm(target,{recursive:true});
}

await cp(source,target,{recursive:true});
await cp(join(root,'assets'),join(target,'assets'),{recursive:true});
await mkdir(join(target,'output','pdf'),{recursive:true});
await cp(join(root,'output','pdf','case-marginpilot.pdf'),join(target,'output','pdf','case-marginpilot.pdf'));
for(const file of ['14-DATABASE-SCHEMA.dbml','15-OPENAPI.json']){
  await cp(join(root,file),join(target,file));
}

async function rewriteLinks(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isDirectory()){
      if(entry.name!=='assets'&&entry.name!=='output')await rewriteLinks(path);
      continue;
    }
    if(!/\.(html|js|css|mjs)$/.test(entry.name))continue;
    const depth=relative(target,directory).split(/[\\/]/).filter(Boolean).length;
    const prefix=depth?'../'.repeat(depth):'';
    const before=await readFile(path,'utf8');
    const after=before.replace(/(?:\.\.\/){2,3}(?=(?:assets\/|output\/pdf\/|14-DATABASE-SCHEMA\.dbml|15-OPENAPI\.json))/g,prefix);
    if(after!==before)await writeFile(path,after,'utf8');
  }
}
await rewriteLinks(target);

// Сборка должна открываться из корня Pages без обращения к файлам за его пределами.
async function checkHtmlLinks(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isDirectory()){
      if(entry.name!=='assets'&&entry.name!=='output')await checkHtmlLinks(path);
      continue;
    }
    if(!entry.name.endsWith('.html'))continue;
    const html=await readFile(path,'utf8');
    for(const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){
      const link=match[1];
      if(/^(?:https?:|mailto:|data:|#|\/\/)/i.test(link))continue;
      const file=decodeURIComponent(link.split(/[?#]/,1)[0]);
      if(!file)continue;
      const destination=resolve(dirname(path),file);
      if(relative(target,destination).startsWith('..'))throw new Error(`Ссылка выходит за пределы сайта: ${relative(target,path)} → ${link}`);
      try{await access(destination);}catch{throw new Error(`В сайте отсутствует файл: ${relative(target,path)} → ${link}`);}
    }
  }
}
await checkHtmlLinks(target);
await writeFile(marker,'generated; safe to replace on the next build\n','utf8');
console.log(`Готовая сборка GitHub Pages: ${target}`);
