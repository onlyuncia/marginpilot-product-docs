import {readFile,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const strip=(source)=>source
  .replace(/^import[^;]+;\s*/gm,'')
  .replace(/export\s+(?=const|function|class)/g,'');
const dist=join(root,'dist');
const parts=[];
for(const file of ['model.mjs','engine.mjs','views.mjs','app.js'])parts.push(`/* ${file} */\n${strip(await readFile(join(dist,file),'utf8'))}`);
await writeFile(join(dist,'file-app.js'),`/* Сборка для открытия index.html напрямую через file://. Исходники остаются в отдельных модулях. */\n${parts.join('\n\n')}`,'utf8');
