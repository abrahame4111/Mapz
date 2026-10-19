// Increments build-number.txt. Run once per new iteration handed to the head unit.
import { readFileSync, writeFileSync } from 'node:fs';

const n = Number(readFileSync('build-number.txt', 'utf8').trim()) + 1;
writeFileSync('build-number.txt', n + '\n');
console.log('Build number is now ' + n);
