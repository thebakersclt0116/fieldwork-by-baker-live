import fs from 'node:fs';
function replace(path, before, after) { const c = fs.readFileSync(path, 'utf8'); if (c.includes(after)) return; if (!c.includes(before)) throw new Error('Review source changed: ' + path); fs.writeFileSync(path, c.replace(before, after)); }
const parser = 'src/lib/detailedMigration.ts';
let source = fs.readFileSync(parser, 'utf8');
// Observation without feedback and supervisor contact are distinct in current BACB documentation.
source = source.replace("if (presence === 'INDEPENDENT' && ((minuteValues.supervision || 0) > 0 || (minuteValues.observation || 0) > 0)) errors.push('Independent entry conflicts with supervision/observation minutes.');", "if (presence === 'INDEPENDENT' && (minuteValues.supervision || 0) > 0) errors.push('Independent entry conflicts with supervision minutes.');");
source = source.replace("    if (minuteValues.observation !== undefined && minuteValues.supervision !== undefined && minuteValues.observation > minuteValues.supervision) errors.push('Client observation exceeds total supervision.');\n", '');
fs.writeFileSync(parser, source);
replace(parser, "    const originalStatus = get('status');", "    const controls = (table.originals[index] as { __originalControls?: Array<{ usedPlaceholder?: boolean }> })?.__originalControls;\n    if (Array.isArray(controls) && controls.some(c => c.usedPlaceholder)) warnings.push('Some source allocation amounts were displayed as Ripley edit-form placeholders. Original value and placeholder are both retained; verify against the month history.');\n    const originalStatus = get('status');");
const bridge = 'public/audit-bridge/background.js';
replace(bridge, "    const explicit = el.labels?.[0]?.textContent || el.getAttribute('aria-label');", "    const labelNode = el.labels?.[0]?.cloneNode(true);\n    labelNode?.querySelectorAll('input,textarea,select,button').forEach(node => node.remove());\n    const explicit = labelNode?.textContent || el.getAttribute('aria-label');");
replace(bridge, "    if (type === 'checkbox') shown = el.checked ? 'true' : 'false';", "    if (type === 'checkbox') shown = el.checked ? 'true' : 'false';\n    if (type === 'radio') shown = label || value;\n    const placeholder = el.getAttribute('placeholder') || '';\n    const usedPlaceholder = !String(value).trim() && /restricted/i.test(label) && /^(?:\\d+(?:\\.\\d+)?|\\.\\d+)$/.test(placeholder.trim());\n    if (usedPlaceholder) shown = placeholder;");
replace(bridge, "controls.push({ label, name: el.name || '', type, value, shown,", "controls.push({ label, name: el.name || '', type, value, shown, placeholder, usedPlaceholder,");
const test = 'scripts/detailed-migration.browser.mjs';
let testSource = fs.readFileSync(test, 'utf8');
testSource = testSource.replaceAll("page.getByText('Full supplementary note', { exact: false }).first()", "page.locator('p').filter({ hasText: 'Full supplementary note' }).first()");
testSource = testSource.replace('<input type="hidden" name="csrf"', '<label>Unrestricted<input name="unrestricted" placeholder="1.75" value=""></label><input type="hidden" name="csrf"');
testSource = testSource.replace("expect(result.detail.record['Description of activity']).toContain('Second line.');", "expect(result.detail.record['Description of activity']).toContain('Second line.');\n  expect(result.detail.record.Unrestricted).toBe('1.75');\n  expect(result.detail.record.__originalControls.find(c => c.name === 'unrestricted').usedPlaceholder).toBe(true);");
fs.writeFileSync(test, testSource);
console.log('Source-fidelity review complete: original controls and placeholder evidence preserved; observations are not automatically supervision contacts.');
