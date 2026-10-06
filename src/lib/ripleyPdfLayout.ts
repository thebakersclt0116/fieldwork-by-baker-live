/** Deterministic parser for Ripley's printable detailed MONTH ENTRY HISTORY, not verification forms. */
export const RIPLEY_PDF_VERSION = 'ripley-detailed-pdf-v1';
export type PdfTextItem = { str: string; x: number; y: number; width: number; height: number };
export type PdfTextPage = { page: number; width: number; height: number; items: PdfTextItem[] };
export type PdfSupervisor = { name: string; email: string; bacbId: string; qualification: string };
export type PdfBucket = { key: string; hours: number; category: 'RESTRICTED' | 'UNRESTRICTED'; presence: 'INDEPENDENT' | 'SUPERVISED'; format?: 'INDIVIDUAL' | 'GROUP' };
export type PdfSession = {
  index: number; date: string; startTime: string; endTime: string; supervisorAlias: string;
  supervisor: PdfSupervisor | null; buckets: PdfBucket[]; observationMinutes: number;
  sourceFormat: string; narrative: string; pages: number[]; warnings: string[];
  raw: { date: string; startTime: string; endTime: string; supervisor: string; cells: string[]; narrative: string; text: Array<{page: number; text: string}> };
};
export type PdfReport = {
  version: typeof RIPLEY_PDF_VERSION; pageCount: number; month: string; supervisee: string; organization: string;
  fieldworkType: string; supervisors: PdfSupervisor[]; sessions: PdfSession[];
  totals: { totalHours: number; independentHours: number; supervisedHours: number; restrictedHours: number; unrestrictedHours: number; groupHours: number; individualSupervisionHours: number; observationMinutes: number };
  declared: { totalHours: number | null; independentHours: number | null; supervisedHours: number | null; supervisionPercent: number | null; observationMinutes: number | null; buckets: number[] | null };
  warnings: string[]; errors: string[]; reconciled: boolean; overlapPairs: Array<[number,number]>;
};
type Item = PdfTextItem & { page: number; gy: number };
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const NUM = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const clean = (s: string) => s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s: string) => clean(s).toLowerCase();
const center = (i: PdfTextItem) => i.x + i.width / 2;
const rounded = (n: number) => Math.round(n * 1e6) / 1e6;
function lines(items: Item[]): Array<{y:number; items:Item[]; text:string}> {
  const output: Array<{y:number;items:Item[];text:string}> = [];
  for (const item of [...items].sort((a,b) => a.gy - b.gy || a.x-b.x)) {
    let line = output.at(-1);
    if (!line || Math.abs(item.gy-line.y) > Math.max(1.5, Math.min(item.height,9)*0.28)) {
      line={y:item.gy,items:[],text:''}; output.push(line);
    }
    line.items.push(item);
  }
  for (const line of output) {
    const ordered=line.items.sort((a,b)=>a.x-b.x);
    line.text=ordered.map((i,k)=> k && i.x-(ordered[k-1].x+ordered[k-1].width)>1 ? ' '+i.str : i.str).join('').trim();
  }
  return output;
}
function joined(items: Item[]): string { return lines(items).map(l=>l.text).filter(Boolean).join('\n'); }
function validDate(raw:string):string {
  const text=clean(raw); const m=new RegExp(`^(${MONTHS.join('|')})\\s+(\\d{1,2}),?\\s+(\\d{4})$`,'i').exec(text);
  const n=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  let year:number, month:number, day:number;
  if(m){year=Number(m[3]);month=MONTHS.findIndex(v=>v.toLowerCase()===m[1].toLowerCase())+1;day=Number(m[2]);}
  else if(n){year=Number(n[1]);month=Number(n[2]);day=Number(n[3]);}else return '';
  const d=new Date(Date.UTC(year,month-1,day));
  return d.getUTCFullYear()===year && d.getUTCMonth()+1===month && d.getUTCDate()===day && year>=1900 && year<=2200 ? `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
}
function clock(raw:string): string {
  const m=/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i.exec(clean(raw)); if(!m)return '';
  let hour=Number(m[1]);if(Number(m[2])>59 || (m[3] ? hour<1||hour>12 : hour>23))return '';
  if(m[3])hour=hour%12+(m[3].toLowerCase()==='pm'?12:0);
  return `${String(hour).padStart(2,'0')}:${m[2]}`;
}
const clockMinutes=(s:string) => { const [h,m]=s.split(':').map(Number); return h*60+m; };
function number(raw:string):number|null { const text=clean(raw).replace(/%$/,'');return NUM.test(text)?Number(text):null; }
function headersAt(items:Item[], labels:string[], y:number, tolerance=2):Item[]|null {
  const out:Item[]=[];
  for(const label of labels){const h=items.find(i=>Math.abs(i.gy-y)<tolerance && norm(i.str)===label);if(!h)return null;out.push(h);}
  return out;
}
function readCells(items:Item[], headers:Item[], top:number,bottom:number):string[] {
  const centers=headers.map(center);return headers.map((_,j)=>joined(items.filter(i=>i.gy>top&&i.gy<bottom && center(i)>(j? (centers[j-1]+centers[j])/2:-Infinity) && center(i)<(j<headers.length-1?(centers[j]+centers[j+1])/2:Infinity))));
}
const aliasNorm=(s:string)=>s.normalize('NFKD').replace(/[^a-z]/gi,'').toLowerCase();
export function matchPdfSupervisor(alias:string, supervisors:PdfSupervisor[]):PdfSupervisor|null {
  const a=aliasNorm(alias);
  const candidates=supervisors.filter(s=>{
    const words=s.name.trim().split(/\s+/); const last=words.at(-1)||'';
    return aliasNorm(s.name)===a || aliasNorm((words[0]?.[0]||'')+last.slice(0,3))===a;
  });
  return candidates.length===1?candidates[0]:null;
}
export function parseRipleyPdfLayout(pages:PdfTextPage[]):PdfReport {
  if(!pages.length || pages.length>250)throw new Error('Choose a complete detailed month PDF with 1–250 pages.');
  let offset=0;const items:Item[]=[]; const allItems:Item[]=[];
  for(const page of pages){
    if(!Number.isFinite(page.width)||!Number.isFinite(page.height)||page.width<=0||page.height<=0)throw new Error('Invalid PDF page geometry.');
    const scale=612/page.width;
    for(const raw of page.items){
      if(!raw.str.trim())continue;
      if(![raw.x,raw.y,raw.width,raw.height].every(Number.isFinite))throw new Error('Invalid PDF text positions.');
      const i={...raw,x:raw.x*scale,y:raw.y*scale,width:raw.width*scale,height:Math.max(1,raw.height*scale),page:page.page,gy:offset+raw.y*scale};
      allItems.push(i);
      if((raw.y<30 || raw.y>page.height-35) && (/^https?:\/\/.*ripleyfieldworktracker\.com\//i.test(raw.str.trim()) || /^Page\s+\d+\s+of\s+\d+$/i.test(raw.str.trim()) || /^Period\s*[-–]\s*Ripley/i.test(raw.str.trim()) || /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}\s*[AP]M$/i.test(raw.str.trim())))continue;
      items.push(i);
    }
    offset+=page.height*scale+40;
  }
  items.sort((a,b)=>a.gy-b.gy||a.x-b.x);
  if(items.length>350000)throw new Error('PDF has too much text for one safe import; split by month.');
  const monthWord=new RegExp(`^(?:${MONTHS.join('|')})(?:\\s+\\d{1,2},?\\s+\\d{4})?$`,'i');
  const headings=items.filter(i=>norm(i.str)==='restricted');
  let columns:Item[]|null=null, headerY=0;
  for(const h of headings){
    const same=items.filter(i=>Math.abs(i.gy-h.gy)<Math.max(3,h.height*.4));
    const restricted=same.filter(i=>norm(i.str)==='restricted').sort((a,b)=>a.x-b.x), unrestricted=same.filter(i=>norm(i.str)==='unrestricted').sort((a,b)=>a.x-b.x);
    const group=same.find(i=>norm(i.str)==='group');const date=same.find(i=>norm(i.str)==='date');const supervisor=same.find(i=>norm(i.str)==='supervisor');
    const nearby=items.filter(i=>Math.abs(i.gy-h.gy)<h.height*1.2);
    const start=nearby.find(i=>/^(start|start time)$/i.test(clean(i.str))),end=nearby.find(i=>/^(end|end time)$/i.test(clean(i.str))),observation=nearby.find(i=>/^observation(?: time)?(?: \(mins\))?$/i.test(clean(i.str))),format=nearby.find(i=>/^supervision(?: format)?$/i.test(clean(i.str)));
    if(restricted.length===2&&unrestricted.length===2&&group&&date&&supervisor&&start&&end&&observation&&format){
      columns=[date,start,end,supervisor,restricted[0],unrestricted[0],restricted[1],unrestricted[1],group,observation,format];headerY=h.gy;break;
    }
  }
  if(!columns)throw new Error('This is not a supported detailed Ripley month history PDF. Open the month showing each dated session AND its activity description, then Print → Save as PDF → All pages. A monthly verification form cannot supply those entries.');
  const centers=columns.map(center);
  if(centers.some((v,i)=>i>0&&v<=centers[i-1]))throw new Error('PDF columns are ambiguous. Print the full-width month history again; no hours imported.');
  const bounds=centers.slice(1).map((c,j)=>(c+centers[j])/2);
  const columnOf=(i:Item)=>{const x=center(i);const j=bounds.findIndex(b=>x<b);return j<0?10:j;};
  const report:PdfReport={version:RIPLEY_PDF_VERSION,pageCount:pages.length,month:'',supervisee:'',organization:'',fieldworkType:'',supervisors:[],sessions:[],totals:{totalHours:0,independentHours:0,supervisedHours:0,restrictedHours:0,unrestrictedHours:0,groupHours:0,individualSupervisionHours:0,observationMinutes:0},declared:{totalHours:null,independentHours:null,supervisedHours:null,supervisionPercent:null,observationMinutes:null,buckets:null},warnings:[],errors:[],reconciled:false,overlapPairs:[]};
  const headItems=items.filter(i=>i.gy<headerY-12);
  const meta=headItems.find(i=>norm(i.str)==='supervisee');
  if(meta){
    const hs=headersAt(headItems,['supervisee','month','setting','fieldwork type'],meta.gy,4);
    const next=headItems.find(i=>i.gy>meta.gy+12&&norm(i.str)==='supervisor(s)');
    if(hs){const values=readCells(headItems,hs,meta.gy+meta.height+1,next?next.gy-4:meta.gy+40);[report.supervisee,report.month,report.organization,report.fieldworkType]=values.map(clean);}
  }
  const sh=headItems.find(i=>norm(i.str)==='supervisor(s)');const th=headItems.find(i=>norm(i.str)==='total hours');
  if(sh&&th){
    const hs=headersAt(headItems,['supervisor(s)','email','bacb account id','qualification'],sh.gy,4);
    if(hs){
      const body=headItems.filter(i=>i.gy>sh.gy+sh.height+1&&i.gy<th.gy-5);
      for(const line of lines(body)){
        const values=readCells(body,hs,line.y-1,line.y+2).map(clean);
        if(values[0])report.supervisors.push({name:values[0],email:values[1],bacbId:values[2],qualification:values[3]});
      }
    }
  }
  if(th){
    const hs=headersAt(headItems,['total hours','independent hours','supervised hours','supervision %','observation time (mins)'],th.gy,4);
    if(hs){const v=readCells(headItems,hs,th.gy+th.height+1,th.gy+35);[report.declared.totalHours,report.declared.independentHours,report.declared.supervisedHours,report.declared.supervisionPercent,report.declared.observationMinutes]=v.map(number);}
  }
  if(!report.month||!report.organization||!report.fieldworkType)report.errors.push('The month, organization or fieldwork-type header is missing. Print the full report including its first page.');
  const totalsLine=items.find(i=>i.gy>headerY&&columnOf(i)===0&&norm(i.str)==='total');
  if(totalsLine){
    const near=items.filter(i=>Math.abs(i.gy-totalsLine.gy)<3);
    const nums=[4,5,6,7,8,9].map(c=>number(joined(near.filter(i=>columnOf(i)===c))));
    if(nums.every(n=>n!==null))report.declared.buckets=nums as number[];
  }
  const ledgerEnd=totalsLine?.gy??Infinity;
  const repeatedHeaderBands=items.filter(i=>norm(i.str)==='date'&&columnOf(i)===0&&i.gy>=headerY).map(i=>({top:i.gy-i.height*4,bottom:i.gy+i.height*2}));
  const inHeader=(i:Item)=>repeatedHeaderBands.some(b=>i.gy>=b.top&&i.gy<=b.bottom);
  const ledger=items.filter(i=>i.gy>headerY+columns![0].height*1.6&&i.gy<ledgerEnd&&!inHeader(i));
  const dateTokens=ledger.filter(i=>columnOf(i)===0&& (monthWord.test(clean(i.str))||/^\d{4}-\d{2}-\d{2}$/.test(clean(i.str))));
  const anchors:Array<{item:Item;date:string;dateItems:Item[];bottom:number}>=[];
  for(const token of dateTokens){
    const ds=ledger.filter(i=>columnOf(i)===0&&i.page===token.page&&i.gy>=token.gy-1&&i.gy<token.gy+token.height*4.5);
    const selected:Item[]=[];let date='';
    for(const i of ds.sort((a,b)=>a.gy-b.gy||a.x-b.x)){selected.push(i);date=validDate(joined(selected));if(date)break;}
    if(!date){report.errors.push(`Page ${token.page}: a date could not be reconstructed. No partial file will be called complete.`);continue;}
    anchors.push({item:token,date,dateItems:selected,bottom:Math.max(...selected.map(i=>i.gy+i.height))});
  }
  if(!anchors.length)throw new Error('No dated entry rows were found. Save the detailed month report with all rows expanded and all pages selected.');
  if(anchors.length>5000)throw new Error('This report has more than 5,000 sessions. Split the PDF by month.');
  for(let index=0;index<anchors.length;index++){
    const anchor=anchors[index],next=anchors[index+1];
    const top=anchor.item.gy-1,bottom=next?.item.gy??ledgerEnd,rowBottom=anchor.bottom+1.5;
    const rowItems=ledger.filter(i=>i.gy>=top&&i.gy<=rowBottom);
    const cells=Array.from({length:11},(_,c)=>joined(rowItems.filter(i=>columnOf(i)===c)));
    const start=clock(cells[1]),end=clock(cells[2]),numeric=cells.slice(4,10).map(number);
    const narrativeItems=ledger.filter(i=>i.gy>rowBottom&&i.gy<bottom),narrative=joined(narrativeItems),warnings:string[]=[];
    if(!start||!end||clockMinutes(end)<=clockMinutes(start))report.errors.push(`Session ${index+1}: start/end times are missing or invalid.`);
    if(numeric.some(n=>n===null))report.errors.push(`Session ${index+1}: one of the five hour buckets or observation minutes could not be read.`);
    const keys=['independent-restricted','independent-unrestricted','supervised-restricted','supervised-unrestricted','group-unrestricted'];
    const buckets:PdfBucket[]=numeric.slice(0,5).map((n,k)=>({key:keys[k],hours:n??0,category:k===0||k===2?'RESTRICTED' as const:'UNRESTRICTED' as const,presence:k<2?'INDEPENDENT' as const:'SUPERVISED' as const,...(k>=2?{format:k===4?'GROUP' as const:'INDIVIDUAL' as const}:{})}));
    const total=rounded(buckets.reduce((sum,b)=>sum+b.hours,0));
    if(total<=0||total>24)report.errors.push(`Session ${index+1}: bucket total must be positive and no more than 24 hours.`);
    if(start&&end&&Math.abs(total-(clockMinutes(end)-clockMinutes(start))/60)>0.011)warnings.push('Recorded hour buckets differ from the clock range. The source values were preserved; review with your supervisor.');
    if(!narrative)warnings.push('This original session has no activity description. Baker cannot invent one.');
    if(narrative.includes('\ufffd')||narrative.includes('\ufffe'))warnings.push('The PDF contains an unrecognized text glyph. Original PDF retained; review the narrative against it.');
    const alias=clean(cells[3]),supervisor=matchPdfSupervisor(alias,report.supervisors);
    if(!supervisor)warnings.push(`Supervisor abbreviation “${alias || '(blank)'}” is not a unique match to the report header. Confirm the supervisor before importing.`);
    const observation=numeric[5]??0;
    if(observation>total*60+0.61)report.errors.push(`Session ${index+1}: observation minutes exceed recorded hours.`);
    const active=buckets.filter(b=>b.hours>0);
    if(active.length>1&&observation>0)report.errors.push(`Session ${index+1} combines multiple hour buckets and observation minutes. The report does not allocate observation to each bucket. Export separate source entries or clarify those allocations before importing.`);
    if(active.length>1)warnings.push('One source session contains multiple hour buckets. Linked allocations retain the original full session and do not invent sub-session times or observation allocations.');
    const sourceText=[...new Set([anchor.item.page,...narrativeItems.map(i=>i.page)])].map(page=>({page,text:joined([...rowItems,...narrativeItems].filter(i=>i.page===page))}));
    report.sessions.push({index:index+1,date:anchor.date,startTime:start,endTime:end,supervisorAlias:alias,supervisor,buckets,observationMinutes:observation,sourceFormat:clean(cells[10]),narrative,pages:sourceText.map(s=>s.page),warnings,raw:{date:cells[0],startTime:cells[1],endTime:cells[2],supervisor:cells[3],cells,narrative,text:sourceText}});
  }
  report.totals.totalHours=rounded(report.sessions.reduce((sum,s)=>sum+s.buckets.reduce((n,b)=>n+b.hours,0),0));
  for(const session of report.sessions){
    for(const b of session.buckets){report.totals[b.presence==='INDEPENDENT'?'independentHours':'supervisedHours']+=b.hours;report.totals[b.category==='RESTRICTED'?'restrictedHours':'unrestrictedHours']+=b.hours;if(b.format==='GROUP')report.totals.groupHours+=b.hours;if(b.format==='INDIVIDUAL')report.totals.individualSupervisionHours+=b.hours;}
    report.totals.observationMinutes+=session.observationMinutes;
    const expectedMonth=new RegExp(`^(${MONTHS.join('|')})\\s+(\\d{4})$`,'i').exec(report.month);
    if(expectedMonth){const m=String(MONTHS.findIndex(s=>s.toLowerCase()===expectedMonth[1].toLowerCase())+1).padStart(2,'0');if(!session.date.startsWith(`${expectedMonth[2]}-${m}`))report.errors.push(`Session ${session.index} falls outside the printed month.`);}
  }
  for(const key of Object.keys(report.totals) as Array<keyof PdfReport['totals']>)report.totals[key]=rounded(report.totals[key]);
  if(!report.declared.buckets)report.errors.push('The final per-category Total row is missing. Choose All pages and include the end of the month report.');
  else {
    const sums=Array.from({length:5},(_,k)=>rounded(report.sessions.reduce((n,s)=>n+s.buckets[k].hours,0)));sums.push(report.totals.observationMinutes);
    report.declared.buckets.forEach((n,k)=>{if(Math.abs(n-sums[k])>0.011)report.errors.push(`Printed total ${k+1} (${n}) does not reconcile with extracted entries (${sums[k]}). The file may omit sessions or contain an unread row.`);});
  }
  for(const key of ['totalHours','independentHours','supervisedHours','observationMinutes'] as const){
    const declared=report.declared[key];if(declared===null)report.errors.push(`The report's ${key} summary is missing.`);else if(Math.abs(declared-report.totals[key])>0.011)report.errors.push(`Printed ${key} (${declared}) does not match entries (${report.totals[key]}).`);
  }
  for(let i=0;i<report.sessions.length;i++)for(let j=i+1;j<report.sessions.length;j++){
    const a=report.sessions[i],b=report.sessions[j];
    if(a.date===b.date&&a.startTime&&a.endTime&&b.startTime&&b.endTime&&clockMinutes(a.startTime)<clockMinutes(b.endTime)&&clockMinutes(b.startTime)<clockMinutes(a.endTime))report.overlapPairs.push([a.index,b.index]);
  }
  if(report.overlapPairs.length)report.warnings.push(`${report.overlapPairs.length} overlapping time-range pair(s) exist in the source. Preserved without changing hours; confirm whether any time is duplicated with your supervisor.`);
  if(report.sessions.some(s=>!s.supervisor))report.warnings.push('Some supervisor aliases need confirmation.');
  const printedPages=allItems.map(i=>/Page\s+(\d+)\s+of\s+(\d+)/i.exec(i.str)).filter(Boolean);
  if(printedPages.length&&printedPages.some(m=>Number(m![2])!==pages.length))report.errors.push('The printed page count does not match this PDF. Save the entire month, not selected pages.');
  report.reconciled=report.errors.length===0;
  return report;
}
