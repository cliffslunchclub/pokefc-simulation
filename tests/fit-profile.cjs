/* Fit only verified, complete original-engine sample files.
 * This tool never uses generated/synthetic data as calibration reference. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {fit,verifyCollection}=require('../assets/js/calibration-fit.js');
const root=path.resolve(__dirname,'..'),samplesDir=path.join(root,'calibration','references'),out=path.join(root,'calibration');
if(!fs.existsSync(samplesDir))fs.mkdirSync(samplesDir,{recursive:true});
const files=fs.readdirSync(samplesDir).filter(x=>x.endsWith('.json')).sort();
try{
 const references=files.map(f=>{
  const original=path.join(out,'reports',f);
  if(!fs.existsSync(original))throw Error('Missing original official TacticMesh report for '+f);
  return verifyCollection(JSON.parse(fs.readFileSync(path.join(samplesDir,f),'utf8')),JSON.parse(fs.readFileSync(original,'utf8')));
 });
 if(references.length<8){console.error(`No calibration activated: ${references.length} verified full TacticMesh matches; need >=8 (32+ recommended).`);process.exitCode=2;}
 else{
  const result=fit(references,{minMatches:8,replicates:32});
  fs.writeFileSync(path.join(out,'calibration-evaluation.json'),JSON.stringify({runAt:new Date().toISOString(),sourceFiles:files,referenceCount:references.length,...result},null,2)+'\n');
  if(result.accepted&&result.profile){
   fs.writeFileSync(path.join(root,'assets/js/calibration-profile.js'),'/* Generated only from verified full-length upstream TacticMesh reference matches. */\nwindow.FXI_CAL_PROFILE='+JSON.stringify(result.profile,null,2)+';\n');
   fs.writeFileSync(path.join(out,'assets/js/calibration-profile.json'),JSON.stringify(result.profile,null,2)+'\n');
   console.log('CALIBRATION ACCEPTED: '+references.length+' real matches. Holdout baseline error '+result.baseline.meanAbsoluteRelativeError.toFixed(3)+' -> calibrated '+result.tuned.meanAbsoluteRelativeError.toFixed(3));
   console.log('Updated assets/js/calibration-profile.js. Reload FUTBOL XI; this does NOT change existing match results.');
  }else{
   console.error('Profile REJECTED by holdout; existing provisional or prior calibration remains in place.');process.exitCode=1;
  }
 }
}catch(e){console.error('Calibration refused: '+e.message);process.exitCode=1}
