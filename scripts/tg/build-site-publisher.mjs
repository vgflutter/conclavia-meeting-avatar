import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const root='.daily-agent/site-publisher';await mkdir(root,{recursive:true,mode:0o700});
const result=await build({entryPoints:['scripts/tg/site-publisher.ts'],bundle:true,platform:'node',format:'cjs',target:'node22',conditions:['react-server'],outfile:root+'/site-publisher.cjs',metafile:true,logLevel:'silent',external:['kerberos','@mongodb-js/zstd','@aws-sdk/credential-providers','snappy','mongodb-client-encryption','gcp-metadata','socks','aws4']});
const inputs=Object.keys(result.metafile.inputs);if(inputs.some(s=>/\/tg\/(?:media\.ts|agents\.ts|alex2-speech|publishers|metricool|final-review\.ts)/u.test(s)))throw Error('Provider implementation in website publisher');
await writeFile(root+'/inputs.json',JSON.stringify(inputs,null,2),{mode:0o600});console.log(JSON.stringify({built:true,website:true,social:false,generation:false}));
