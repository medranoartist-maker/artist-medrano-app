/**
 * Importador privado de Google Sheets → Supabase.
 * Uso: node migration/importar-a-supabase.mjs ruta/al/respaldo.json --dry-run
 *      SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node migration/importar-a-supabase.mjs ruta/al/respaldo.json
 * No subir el respaldo ni claves al repositorio; ejecutar desde computadora de confianza.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const backupPath=process.argv[2];
const dryRun=process.argv.includes('--dry-run');
if(!backupPath){console.error('Uso: node migration/importar-a-supabase.mjs ruta/respaldo.json [--dry-run]');process.exit(1);}
let backup;
try {backup=JSON.parse(readFileSync(backupPath,'utf8'));}
catch(error){console.error('El archivo no es JSON válido o no se puede leer:',error.message);process.exit(1);}
if(!backup || !Array.isArray(backup.sheets))throw new Error('Formato de respaldo inesperado. Usá exportarRespaldoArtistMedrano().');

function stableUuid(label){
 const h=createHash('sha256').update('artist-medrano|'+(backup.sourceSpreadsheetTitle||'')+'|'+label).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
function validUuid(value){return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);}
function tidy(value){return String(value??'').replace(/^'/,'').trim();}
function normalizedPhone(value){return tidy(value)||null;}

const directory=backup.sheets.find(x=>x.name==='Clientas');
const index=new Map();
const clients=new Map();
const diagnoses=new Map();

for(const row of (directory?.values||[]).slice(1)){
 const id=tidy(row[0]),name=tidy(row[1]),tab=tidy(row[2]),phone=normalizedPhone(row[3]);
 if(!id||!name||!tab)continue;
 const uuid=validUuid(id)?id:stableUuid('client:'+id);
 const record={id:uuid,full_name:name,phone};
 clients.set(uuid,record);index.set(tab,uuid);
}

const demo=['Sofía','Martina','Valentina'];
for(let i=0;i<demo.length;i++){
 const tab=`Demo ${i+1} · ${demo[i]}`;
 const sheet=backup.sheets.find(x=>x.name===tab);
 if(!sheet||sheet.values.length<2)continue;
 const uuid=stableUuid('legacy-demo:'+tab);
 clients.set(uuid,{id:uuid,full_name:demo[i],phone:null});index.set(tab,uuid);
}

const errors=[];
for(const sheet of backup.sheets){
 if(sheet.name==='Clientas'||!Array.isArray(sheet.values)||sheet.values.length<2)continue;
 const clientId=index.get(sheet.name);
 // Puede haber otras pestañas no relacionadas con el sistema.
 if(!clientId)continue;
 for(let indexRow=1;indexRow<sheet.values.length;indexRow++){
  const row=sheet.values[indexRow];const raw=row[5];
  if(!raw)continue;
  let data;
  try {data=typeof raw==='string'?JSON.parse(raw):raw;}
  catch {errors.push(`JSON inválido: pestaña ${sheet.name}, fila ${indexRow+1}`);continue;}
  if(!data || typeof data!=='object' || !data.answers || typeof data.answers!=='object'){
   errors.push(`Faltan respuestas: pestaña ${sheet.name}, fila ${indexRow+1}`);continue;
  }
  const id=String(data.id||stableUuid(`visit:${sheet.name}:${indexRow}`));
  diagnoses.set(id,{
   id,client_id:clientId,visit_date:tidy(data.date)||tidy(row[1])||'',
   status:tidy(data.status)||tidy(row[2])||'Pendiente',
   plan:String(data.plan||''),service:String(data.service||''),
   answers:data.answers,recommendation:String(data.recommendation||'')
  });
 }
}
console.log('Recuento de migración (sin mostrar datos personales):');
console.log('Clientas:',clients.size,'Diagnósticos:',diagnoses.size,'Filas problemáticas:',errors.length);
if(errors.length){console.error(errors.join('\n'));throw new Error('No se importó: revisá el respaldo antes de continuar.');}
if(dryRun){console.log('Prueba de lectura completada. No se transfirieron datos.');process.exit(0);}

const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key||!/^https:\/\//.test(url))throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en variables de entorno.');

async function upsert(table,records){
 if(!records.length)return;
 // Batching para limitar tamaño de solicitudes.
 for(let i=0;i<records.length;i+=100){
  const response=await fetch(`${url}/rest/v1/${table}?on_conflict=id`,{
   method:'POST',headers:{'apikey':key,'Authorization':`Bearer ${key}`,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
   body:JSON.stringify(records.slice(i,i+100))
  });
  if(!response.ok)throw new Error(`No se pudo importar ${table}: HTTP ${response.status}. ${await response.text()}`);
 }
}
await upsert('clients',[...clients.values()]);
await upsert('diagnoses',[...diagnoses.values()]);
console.log('Importación completada. Verificá cantidades y relaciones en Supabase. Conservá el respaldo original.');
