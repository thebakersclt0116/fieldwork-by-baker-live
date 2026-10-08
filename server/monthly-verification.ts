import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { CloudError } from './cloud-client.js';

export interface VerificationIdentity {
  traineeName: string; bacbId: string; state: string; country: string;
  supervisorName: string; supervisorCertification: string;
}
export interface VerificationTotals { totalMinutes: number; supervisionMinutes: number; observationMinutes: number }
export async function fillMonthlyVerification(identity: VerificationIdentity, totals: VerificationTotals, month: string, structure: 'individual'|'organization', requirements: '2022'|'2027', fieldworkType: 'SUPERVISED'|'CONCENTRATED') {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !['individual','organization'].includes(structure) || !['2022','2027'].includes(requirements) || !['SUPERVISED','CONCENTRATED'].includes(fieldworkType)) throw new CloudError('INVALID_FORM_INPUT',400);
  if (Object.values(identity).some(value => typeof value !== 'string' || !value.trim() || value.length > 150 || /[\r\n]/.test(value))) throw new CloudError('FORM_IDENTITY_REQUIRED',400);
  const {totalMinutes, supervisionMinutes, observationMinutes} = totals;
  if (![totalMinutes,supervisionMinutes,observationMinutes].every(value => Number.isSafeInteger(value) && value >= 0) || totalMinutes === 0 || supervisionMinutes > totalMinutes || observationMinutes > supervisionMinutes) throw new CloudError('REVIEW_HOUR_ALLOCATION',400);
  const template = await readFile(`${process.cwd()}/server/forms/monthly-${structure}-${requirements}.pdf`);
  const pdf = await PDFDocument.load(template);
  const form = pdf.getForm();
  const text = (name: string, value: string) => form.getTextField(name).setText(value);
  const [year, number] = month.split('-').map(Number);
  pdf.setModificationDate(new Date(Date.UTC(year,number-1,1)));
  text('TRAINEE_NAME',identity.traineeName.trim()); text('TRAINEE_BACB_ID',identity.bacbId.trim());
  text('TRAINEE_CERTIFICATE_MONTH/YEAR',new Date(year,number-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'}));
  text('TRAINEE_FIELDWORK_STATE',identity.state.trim()); text('TRAINEE_FIELDWORK_COUNTRY',identity.country.trim());
  text('RESPONSIBLE_SUPERVISOR_NAME',identity.supervisorName.trim()); text('RESPONSIBLE_SUPERVISOR_BACB_ID',identity.supervisorCertification.trim());
  const independent = totalMinutes - supervisionMinutes;
  const percentage = ((supervisionMinutes/totalMinutes)*100).toFixed(2)+'%';
  text('PERCENT_HOURS_SUPERVISED',percentage);
  if (requirements === '2027') {
    for (const [prefix,minutes] of [['Independent',independent],['Supervised',supervisionMinutes],['Total_Fieldwork',totalMinutes],['Observation',observationMinutes]] as const) {
      text(prefix+'_Hours',String(Math.floor(minutes/60)));
      const minuteField = prefix === 'Observation' ? (structure === 'individual' ? 'Independent_Minutes 3' : 'Independent_Minutes 2') : prefix+'_Minutes';
      text(minuteField,String(minutes%60));
    }
  } else {
    text('INDEPENDENT_HOURS',(independent/60).toFixed(2)); text('SUPERVISED_HOURS',(supervisionMinutes/60).toFixed(2)); text('TOTAL_FIELDWORK',(totalMinutes/60).toFixed(2));
    // The official template uses one checkbox field with two differently named widgets.
    const choice = form.getCheckBox('CHECK_SUPERVISED_FIELDWORK');
    const widgets = choice.acroField.getWidgets().sort((a,b) => a.getRectangle().x-b.getRectangle().x);
    if (widgets.length !== 2) throw new CloudError('FORM_TEMPLATE_CHANGED');
    const selected = widgets[fieldworkType === 'SUPERVISED' ? 0 : 1].getOnValue();
    if (!selected) throw new CloudError('FORM_TEMPLATE_CHANGED');
    choice.acroField.dict.set(PDFName.of('V'),selected);
    widgets.forEach((widget,index) => widget.setAppearanceState(index === (fieldworkType === 'SUPERVISED' ? 0 : 1) ? selected : PDFName.of('Off')));
  }
  // Both signatures and dates stay blank. Generating a form never approves the hours.
  text('SUPERVISOR_SIGNATURE_DATE',''); text('TRAINEE_SIGNATURE_DATE','');
  form.updateFieldAppearances(await pdf.embedFont(StandardFonts.Helvetica));
  // Lock the prefilled values while leaving signature and date fields available.
  for (const field of form.getFields()) {
    if (field.constructor.name !== 'PDFSignature' && !field.getName().endsWith('SIGNATURE_DATE')) field.enableReadOnly();
  }
  return pdf.save();
}
