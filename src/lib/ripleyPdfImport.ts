import type { PdfTextPage, PdfReport, PdfSession } from './ripleyPdfLayout.ts';
import { parseRipleyPdfLayout } from './ripleyPdfLayout.ts';
import { parseSource, sha256, type SourceTable } from './detailedMigration.ts';

/** Extract locally with a matching, bundled PDF.js worker. Parsing uses no AI or remote service; account sync separately preserves the original file in cloud storage. */
export async function readRipleyPdf(bytes: Uint8Array, progress?: (page:number,total:number)=>void):Promise<PdfReport> {
  if(bytes.byteLength>25*1024*1024)throw new Error('Each PDF must be 25 MB or smaller. Export one month at a time.');
  if(!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-'))throw new Error('The selected file is not a valid PDF.');
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker=await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  // PDF.js 6 removed the old isEvalSupported option. Use its checked public parameters, not an any cast.
  const task=pdfjs.getDocument({data:new Uint8Array(bytes),disableFontFace:true,useSystemFonts:false,useWorkerFetch:false,stopAtErrors:true,enableXfa:false});
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;void task.destroy();},90000);
  try {
    const pdf=await task.promise;
    if(pdf.numPages>250)throw new Error('This PDF exceeds 250 pages. Export separate months instead of one very large document.');
    const pages:PdfTextPage[]=[];let textCount=0;
    for(let n=1;n<=pdf.numPages;n++){
      if(timedOut)throw new Error('PDF processing exceeded the time limit. Export smaller month files.');
      progress?.(n,pdf.numPages);
      const page=await pdf.getPage(n),viewport=page.getViewport({scale:1}),text=await page.getTextContent();
      const items:PdfTextPage['items']=[];
      for(const item of text.items){
        if(!('str' in item)||!item.str.trim())continue;
        const tx=pdfjs.Util.transform(viewport.transform,item.transform),height=Math.max(1,Math.hypot(tx[2],tx[3]));
        items.push({str:item.str,x:tx[4],y:tx[5]-height,width:item.width,height});
      }
      textCount+=items.length;
      if(textCount>350000)throw new Error('Too much PDF text for one safe import. Export smaller files.');
      if(!items.length)throw new Error(`Page ${n} has no readable text. Use Print → Save as PDF from Ripley, not screenshots or scanned pages.`);
      pages.push({page:n,width:viewport.width,height:viewport.height,items});page.cleanup();
    }
    return parseRipleyPdfLayout(pages);
  } catch(error) {
    if(timedOut)throw new Error('PDF processing timed out. No tracked entries were changed.');
    if(error instanceof Error && error.name==='PasswordException')throw new Error('This PDF requires a password. Save an unencrypted copy you are authorized to use.');
    throw error;
  } finally {clearTimeout(timer);await task.destroy();}
}
export type PdfSource = { filename:string; hash:string; report:PdfReport };
export async function pdfReportsToTable(sources:PdfSource[]):Promise<SourceTable> {
  const rows:Record<string,unknown>[]=[];
  const origins:NonNullable<SourceTable['origins']>=[];
  for(const source of sources){
    const report=source.report;
    if(!report.reconciled)throw new Error(`${source.filename}: ${report.errors.join(' ')}`);
    const counts=new Map<string,number>();
    for(const session of report.sessions){
      const active=session.buckets.filter(b=>b.hours>0);
      if(!session.supervisor)throw new Error(`${source.filename}, session ${session.index}: supervisor abbreviation ${session.supervisorAlias} needs confirmation against the report header.`);
      const signature=JSON.stringify([report.supervisee.toLowerCase(),report.organization.toLowerCase(),report.month,session.date,session.startTime,session.endTime,session.supervisorAlias.toLowerCase()]);
      const occurrence=counts.get(signature)||0;counts.set(signature,occurrence+1);
      const derivedId='ripley-pdf-'+await sha256(signature+'#'+occurrence);
      const supervised=active.filter(b=>b.presence==='SUPERVISED').reduce((n,b)=>n+b.hours,0);
      const individual=active.filter(b=>b.format==='INDIVIDUAL').reduce((n,b)=>n+b.hours,0);
      const record={
        'Entry ID':derivedId,Date:session.date,'Start time':session.startTime,'End time':session.endTime,
        'Total hours':active.reduce((n,b)=>n+b.hours,0),
        'Activity category':active.every(b=>b.category===active[0].category)?active[0].category:'UNKNOWN',
        'Fieldwork type':report.fieldworkType,Organization:report.organization,Supervisor:session.supervisor.name,
        'Supervisor email':session.supervisor.email,'Description of activity':session.narrative,
        'Hour type':active.every(b=>b.presence===active[0].presence)?active[0].presence:'',
        'Supervision format':active.length===1?active[0].format||'':'',
        'Supervision minutes':Math.round(supervised*60000000)/1000000,
        'Individual supervision minutes':Math.round(individual*60000000)/1000000,
        'Observation minutes':session.observationMinutes,
        'Observation mode':session.observationMinutes?session.sourceFormat:'',
        'Contact type':'',Setting:report.organization,
        'Independent restricted hours':session.buckets[0].hours,'Independent unrestricted hours':session.buckets[1].hours,
        'Supervised restricted hours':session.buckets[2].hours,'Supervised unrestricted hours':session.buckets[3].hours,
        'Supervised group unrestricted hours':session.buckets[4].hours,
        'Original supervision modality':session.sourceFormat,
      };
      const original={format:report.version,sourceIdKind:'derived-from-printable-row-not-native-ripley-id',supervisee:report.supervisee,month:report.month,organization:report.organization,fieldworkType:report.fieldworkType,supervisor:session.supervisor,session:{...session,index:undefined,pages:undefined,raw:{...session.raw,text:undefined}},columns:record};
      rows.push(record);
      origins.push({filename:source.filename,sha256:source.hash,sourceRow:session.index,original,pdfSession:session});
    }
  }
  return {...parseSource(JSON.stringify(rows),'ripley-detailed-pdf.json'),origins};
}
export function pdfPreviewStatistics(sessions:PdfSession[]) {
  return {sessions:sessions.length,allocations:sessions.reduce((n,s)=>n+s.buckets.filter(b=>b.hours>0).length,0),hours:sessions.reduce((n,s)=>n+s.buckets.reduce((a,b)=>a+b.hours,0),0)};
}
