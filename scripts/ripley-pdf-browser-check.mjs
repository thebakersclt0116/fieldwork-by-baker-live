import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {PDFDocument,StandardFonts} from 'pdf-lib';

// Entirely fictional fixture. No private user file, client narrative, credential or original account is committed or logged.
async function fixture(month='January', omitLast=false, summaryOnly=false){
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const first=pdf.addPage([612,792]);
  const draw=(page,s,x,y,size=7,strong=false)=>{const f=strong?bold:font;page.drawText(s,{x:x-f.widthOfTextAtSize(s,size)/2,y:792-y-size,size,font:f});};
  draw(first,'Period - Ripley',70,15);draw(first,'Page 1 of 2',540,770);
  for(const [s,x] of [['Supervisee',103],['Month',210],['Setting',334],['Fieldwork Type',483]])draw(first,s,x,96,8,true);
  for(const [s,x] of [['Casey Example',103],[month+' 2026',210],['Example Organization',334],['Supervised Fieldwork',483]])draw(first,s,x,119);
  for(const [s,x] of [['Supervisor(s)',105],['Email',243],['BACB Account ID',393],['Qualification',512]])draw(first,s,x,149,8,true);
  for(const [s,x] of [['Avery Example',105],['avery@example.com',243],['TEST-ONLY',393],['BCBA',512]])draw(first,s,x,171);
  for(const [s,x] of [['Total Hours',85],['Independent Hours',176],['Supervised Hours',284],['Supervision %',380],['Observation Time (Mins)',493]])draw(first,s,x,222,7.5,true);
  for(const [s,x] of [['3.250',85],['2.000',176],['1.250',284],['38.46%',380],['15.000',493]])draw(first,s,x,243);
  if(summaryOnly)return Buffer.from(await pdf.save());
  const centers=[68,103,134,177,232,291,350,409,459,508,569];
  for(const [s,i] of [['Date',0],['Start',1],['End',2],['Supervisor',3],['Restricted',4],['Unrestricted',5],['Restricted',6],['Unrestricted',7],['Group',8],['Observation',9],['Supervision',10]])draw(first,s,centers[i],300,6,true);
  for(const i of [1,2])draw(first,'Time',centers[i],308,6,true);
  draw(first,'Time (Mins)',centers[9],308,6,true);draw(first,'Format',centers[10],308,6,true);
  const session=(y,day,start,end,nums,note)=>{
    [month,String(day)+',','2026'].forEach((s,i)=>draw(first,s,centers[0],y+i*9));
    draw(first,start,centers[1],y+7,6);draw(first,end,centers[2],y+7,6);draw(first,'A. EXA',centers[3],y+7);
    nums.forEach((n,i)=>draw(first,String(n),centers[i+4],y+7));
    if(nums[2]||nums[3]||nums[4])draw(first,'In-Person',centers[10],y+7,6);
    first.drawText(note,{x:47,y:792-y-48,font,size:7});
  };
  session(335,28,'8:30 AM','10:30 AM',[0,2,0,0,0,0],'Synthetic narrative one: analyzed fictional practice data.');
  session(420,27,'9:00 AM','10:00 AM',[0,0,0,0,1,0],'Synthetic narrative two: group review with a fictional supervisor.');
  session(660,26,'9:00 AM','9:15 AM',[0,0,0.25,0,0,15],'Synthetic narrative three continues onto the next page');
  if(!omitLast){const last=pdf.addPage([612,792]);draw(last,'Period - Ripley',70,15);draw(last,'Page 2 of 2',540,770);
    last.drawText('and retains this exact continuation sentence.',{x:47,y:792-55,font,size:7});
    draw(last,'Total',68,110,7,true);[0,2,0.25,0,1,15].forEach((n,i)=>draw(last,Number(n).toFixed(3),centers[i+4],110));
  }
  return Buffer.from(await pdf.save());
}
let localServer;
const live=Boolean(process.env.BAKER_TEST_ORIGIN);
const origin=process.env.BAKER_TEST_ORIGIN||'http://127.0.0.1:4181';
if(!live){const root=path.resolve('dist');localServer=http.createServer(async(req,res)=>{
  try{let filename=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!filename.startsWith(root+path.sep)&&filename!==root){res.writeHead(403);res.end();return;}
    let bytes;try{bytes=await fs.readFile(filename);}catch{filename=path.join(root,'index.html');bytes=await fs.readFile(filename);}
    const ext=path.extname(filename);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream');res.end(bytes);
  }catch{res.writeHead(500);res.end();}
});await new Promise(r=>localServer.listen(4181,'127.0.0.1',r));}
await fs.mkdir('pdf-release-evidence',{recursive:true});
const browser=await chromium.launch({headless:true});const checks=[];
let email='pdf-fixture@example.com',user={name:'Synthetic QA',email,initials:'QA',role:'free',subscription:'none',trialEndsAt:Math.floor(Date.now()/1000)+86400},token='isolated-ui-fixture-not-production-auth';
try{
  if(live){email='pdf-release-qa-'+randomUUID()+'@example.com';const r=await fetch(origin+'/api/free-signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'PDF release QA',email,password:randomUUID()+randomUUID()})});const a=await r.json();assert.ok(r.ok&&a.token,'Normal trial signup must succeed; no auth bypass');user={...a.user,initials:'QA'};token=a.token;}
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  await context.addInitScript(({user,token})=>{localStorage.setItem('authUser',JSON.stringify(user));localStorage.setItem('bakerSessionToken',token);localStorage.setItem('theme','dark');},{user,token});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(!live)await page.route('**/api/health*',r=>r.fulfill({json:{stripeMode:'test',stripeCheckoutConfigured:true,liveBillingEnabled:false}}));
  await page.goto(origin+'/import');await page.getByRole('heading',{name:'Bring every session. Pick up where you left off.',exact:true}).waitFor();
  const guides=page.locator('img[src^="/guides/"]');assert.equal(await guides.count(),4);
  for(let i=0;i<4;i++){await guides.nth(i).scrollIntoViewIfNeeded();await guides.nth(i).evaluate(img=>img.decode());assert.ok(await guides.nth(i).evaluate(img=>img.naturalWidth>0));}
  await page.getByRole('button',{name:'Enlarge step 1:',exact:false}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);checks.push('all guide images load; enlargement and Escape work');
  await page.screenshot({path:'pdf-release-evidence/guide-desktop.png',fullPage:false});
  const pdf=await fixture(),feb=await fixture('February');
  const upload=async files=>{await page.locator('input[type=file][accept]').setInputFiles(files);await page.getByRole('heading',{name:'3. Review & reconcile before adding hours',exact:true}).waitFor({timeout:60000});};
  await upload([{name:'January-fictional.pdf',mimeType:'application/pdf',buffer:pdf},{name:'February-fictional.pdf',mimeType:'application/pdf',buffer:feb}]);
  assert.equal(await page.getByText('Totals reconcile',{exact:true}).count(),2);checks.push('real PDF worker reads two complete PDFs and reconciles all categories');
  await page.getByLabel('I reviewed the source rows, scope, flags and totals.',{exact:false}).check();
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Import selected entries',exact:true}).click();
  await page.waitForFunction(email=>JSON.parse(localStorage.getItem(`fieldworkByBaker:v1:${email}:entries`)||'[]').length===6,email);
  const entries=await page.evaluate(email=>JSON.parse(localStorage.getItem(`fieldworkByBaker:v1:${email}:entries`)||'[]'),email);
  assert.equal(entries.reduce((n,e)=>n+e.duration,0),6.5);assert.equal(entries.filter(e=>e.activityCategory==='RESTRICTED').reduce((n,e)=>n+e.duration,0),0.5);
  assert.equal(entries.reduce((n,e)=>n+(e.supervisionMinutes||0),0),150);assert.equal(entries.reduce((n,e)=>n+(e.observationMinutes||0),0),30);
  assert.ok(entries.every(e=>e.status==='PENDING'&&e.migration.sourceHash&&e.supervisorName==='Avery Example'));
  assert.equal(entries.filter(e=>e.notes.includes('exact continuation sentence')).length,2);assert.equal(entries.filter(e=>e.migration.sourcePages.length===2).length,2);
  checks.push('six individual sessions persist with exact narratives, page provenance, categories and supervision');
  await page.goto(origin+'/audit-history');await page.getByRole('heading',{name:'Entry-by-entry audit ledger'}).waitFor();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download full audit ZIP',exact:true}).click();const download=await downloadPromise;const zip=await fs.readFile(await download.path());assert.ok(zip.includes(pdf)&&zip.includes(feb),'Exact original PDFs must be in ZIP');checks.push('audit archive preserves both original PDF byte streams');
  await page.goto(origin+'/import');await upload([{name:'January-reprinted.pdf',mimeType:'application/pdf',buffer:pdf},{name:'February-reprinted.pdf',mimeType:'application/pdf',buffer:feb}]);
  assert.ok((await page.locator('body').innerText()).includes('Exact duplicates: 6.'));await page.getByLabel('I reviewed the source rows, scope, flags and totals.',{exact:false}).check();assert.ok(await page.getByRole('button',{name:'Import selected entries',exact:true}).isDisabled());checks.push('repeat imports are detected and cannot add duplicate hours');
  await page.locator('input[type=file][accept]').setInputFiles({name:'missing-last-page.pdf',mimeType:'application/pdf',buffer:await fixture('January',true)});
  await page.waitForFunction(()=>document.body.innerText.includes('No tracked entries were added.'));assert.equal((await page.evaluate(email=>JSON.parse(localStorage.getItem(`fieldworkByBaker:v1:${email}:entries`)||'[]'),email)).length,6);checks.push('missing PDF pages fail closed without changing tracked entries');
  await page.locator('input[type=file][accept]').setInputFiles({name:'monthly-summary.pdf',mimeType:'application/pdf',buffer:await fixture('January',false,true)});
  await page.waitForFunction(()=>document.body.innerText.includes('not a supported detailed Ripley'));assert.equal((await page.evaluate(email=>JSON.parse(localStorage.getItem(`fieldworkByBaker:v1:${email}:entries`)||'[]'),email)).length,6);checks.push('monthly summaries are rejected as individual history');
  await page.locator('input[type=file][accept]').setInputFiles([{name:'valid-first.pdf',mimeType:'application/pdf',buffer:pdf},{name:'invalid-second.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 invalid fixture')}]);
  await page.waitForTimeout(2000);
  const partialButton=page.getByRole('button',{name:'Prepare PDF review',exact:true});
  assert.ok(await partialButton.count()===0 || await partialButton.isDisabled(),'A failed batch must not expose a valid prefix as ready for import');
  assert.equal((await page.evaluate(email=>JSON.parse(localStorage.getItem(`fieldworkByBaker:v1:${email}:entries`)||'[]'),email)).length,6);
  checks.push('a corrupt later file cannot silently turn a bulk import into a partial import');
  await page.setViewportSize({width:390,height:844});await page.goto(origin+'/import');await page.getByRole('heading',{name:'Bring every session. Pick up where you left off.'}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2));await page.screenshot({path:'pdf-release-evidence/guide-mobile.png',fullPage:true});checks.push('mobile import guide has no horizontal overflow');
  assert.deepEqual(errors,[]);checks.push('no browser runtime errors');
  await fs.writeFile('pdf-release-evidence/pdf-browser-report.json',JSON.stringify({checkedAt:new Date().toISOString(),origin,authentication:live?'normal-server-signed-trial':'isolated-local-ui-fixture',passed:checks.length,checks,syntheticDataOnly:true},null,2));console.log(JSON.stringify({passed:checks.length,checks},null,2));
}catch(error){console.error('PDF browser acceptance failed:',error.message);throw error;}
finally{await browser.close();if(localServer)await new Promise(r=>localServer.close(r));}
