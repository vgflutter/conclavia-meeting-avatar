/** Read-only check of the user-approved visual identity; no providers/network. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const lock=JSON.parse(await readFile('docs/tg/cdaily-visual-lock.json','utf8'));
for(const asset of lock.assets){
 const hash=createHash('sha256').update(await readFile(asset.path)).digest('hex');
 if(hash!==asset.sha256)throw Error('Approved CDaily identity changed: '+asset.path);
}
console.log(`CDaily visual identity: ${lock.assets.length} approved assets/settings match. No provider calls.`);
