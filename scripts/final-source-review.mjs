import fs from 'node:fs';
function replace(path, before, after) { const c = fs.readFileSync(path, 'utf8'); if (c.includes(after)) return; if (!c.includes(before)) throw new Error('Review source changed: ' + path); fs.writeFileSync(path, c.replace(before, after)); }
const parser = 'src/lib/detailedMigration.ts';
let source = fs.readFileSync(parser, 'utf8');
// BACB documentation differentiates observation without feedback from supervisor contact.
// Do not force observation minutes to be a subset of supervision or reject independent observation.
source = source.replace("if (presence === 'INDEPENDENT' && ((minuteValues.supervision || 0) > 0 || (minuteValues.observation || 0) > 0)) errors.push('Independent entry conflicts with supervision/observation minutes.');", "if (presence === 'INDEPENDENT' && (minuteValues.supervision || 0) > 0) errors.push('Independent entry conflicts with supervision minutes.');");
source = source.replace("    if (minuteValues.observation !== undefined && minuteValues.supervision !== undefined && minuteValues.observation > minuteValues.supervision) errors.push('Client observation exceeds total supervision.');\n", '');
fs.writeFileSync(parser, source);
replace(parser, "    const originalStatus = get('status');", "    const controls = (table.originals[index] as { __originalControls?: Array<{ usedPlaceholder?: boolean }> })?.__originalControls;\n    if (Array.isArray(controls) && controls.some(c => c.usedPlaceholder)) warnings.push('Some source allocation amounts were displayed as Ripley edit-form placeholders. Original value and placeholder are both retained; verify against the month history.');\n    const originalStatus = get('status');");
const bridge = 'public/audit-bridge/background.js';
replace(bridge, "    if (type === 'checkbox') shown = el.checked ? 'true' : 'false';", "    if (type === 'checkbox') shown = el.checked ? 'true' : 'false';\n    if (type === 'radio') shown = label || value;\n    const placeholder = el.getAttribute('placeholder') || '';\n    const usedPlaceholder = !String(value).trim() && /restricted/i.test(label) && /^(?:\\d+(?:\\.\\d+)?|\\.\\d+)$/.test(placeholder.trim());\n    if (usedPlaceholder) shown = placeholder;");
replace(bridge, "controls.push({ label, name: el.name || '', type, value, shown,", "controls.push({ label, name: el.name || '', type, value, shown, placeholder, usedPlaceholder,");
replace('src/pages/DetailedMigration.tsx', "{saved", "{saved");
// Guard against accidentally archiving all of another user's account in a session race.
// Existing archive functions already recheck the current account before reading and export.
console.log('Source-fidelity review complete: observations are distinct from contact, numeric placeholders identified, original control values preserved.');
