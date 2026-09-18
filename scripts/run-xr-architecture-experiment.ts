import fs from 'node:fs/promises'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { parsePortableExperimentConfig, buildPortableExperimentBundle, verifyPortableExperimentBundle } from '../dev/xr-lab/PortableXRExperiment.ts';
const args=process.argv.slice(2), i=args.indexOf('--config'); if(i<0||!args[i+1])throw new Error('usage: --config <experiment.json>');
const configPath=path.resolve(args[i+1]); const raw=JSON.parse((await fs.readFile(configPath,'utf8')).replace(/^\uFEFF/,''));
const config=parsePortableExperimentConfig(raw); let buildHash=process.env.NEMOSYNE_BUILD_HASH;
if(!buildHash){try{buildHash=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{buildHash='container-source';}}
const bundle=buildPortableExperimentBundle(config,buildHash); verifyPortableExperimentBundle(bundle);
const outDir=path.resolve(path.dirname(configPath),'artifacts'); await fs.mkdir(outDir,{recursive:true});
const out=path.join(outDir,`campaign-${bundle.bundleHash.slice(7,23)}.json`); await fs.writeFile(out,JSON.stringify(bundle,null,2)+'\n');
console.log(JSON.stringify({status:'READY',bundleHash:bundle.bundleHash,runs:bundle.runs.length,output:out},null,2));
