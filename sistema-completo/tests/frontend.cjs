// Integração do JavaScript com a API real; DOM mínimo, sem inspeção visual.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map(),events={};let cookie='';
const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},showModal(){},close(){},setAttribute(){}});return nodes.get(s)};
const context=vm.createContext({console,Date,Math,JSON,String,Number,Array,Set,crypto:require('node:crypto').webcrypto,setTimeout:()=>0,clearTimeout(){},document:{querySelector:node,addEventListener:(name,cb)=>events[name]=cb},FormData:class{constructor(f){this.fields=f.fields}get(k){return this.fields[k]??null}getAll(k){return this.fields[k]||[]}has(k){return k in this.fields}},fetch:async(url,options)=>{options.headers.Cookie=cookie;const r=await fetch('http://127.0.0.1:8766'+url,options);const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return r}});
let source=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');source=source.replace(/boot\(\);\s*$/,'');vm.runInContext(source,context);
const run=s=>vm.runInContext(s,context);
async function login(email){await events.submit({preventDefault(){},target:{id:'login-form',dataset:{},fields:{email,password:'demo123'},querySelector(){return {disabled:false}}}})}
(async()=>{
 await run('boot()');assert.match(node('#app').innerHTML,/login-form/);
 await login('camila@example.com');assert.equal(run('role'),'professional');assert.match(node('#app').innerHTML,/Cuidar começa por acompanhar/);
 for(const page of ['dashboard','patients','exercises','routines','evolution','messages','about']){run(`page='${page}';shell()`);assert.ok(node('#app').innerHTML.length>1000)}
 run('patientForm()');assert.match(node('#modal').innerHTML,/name="password"/);
 await run('logout()');assert.match(node('#app').innerHTML,/login-form/);
 await login('mariana@example.com');assert.equal(run('role'),'patient');assert.equal(run('db.patients.length'),1);
 for(const page of ['dashboard','routines','evolution','messages','about']){run(`page='${page}';shell()`);assert.ok(!node('#app').innerHTML.includes('role-select'))}
 await run('logout()');console.log('PASS: login real, sessão, renderização das telas, cadastro com senha, isolamento do paciente e logout.');
})().catch(e=>{console.error(e);process.exitCode=1});
