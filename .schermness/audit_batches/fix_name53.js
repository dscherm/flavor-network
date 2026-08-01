const fs = require('fs');
const raw = fs.readFileSync('.ralph/audit_batches/batch_12.json', 'utf8');
const input = JSON.parse(raw);
const name53 = input[53].name;
const cps = [...name53].map(c => c.codePointAt(0).toString(16));
console.log('codepoints:', cps);
// Re-serialize using JSON.stringify which will properly escape the control char
const serialized = JSON.stringify(name53);
console.log('json serialized:', serialized);
