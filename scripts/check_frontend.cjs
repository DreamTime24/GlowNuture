const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const files=fs.readdirSync('frontend/assets').filter(x=>x.endsWith('.js')).map(x=>path.join('frontend/assets',x)).concat('frontend/firebase-messaging-sw.js');
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stderr);process.exit(1);}}
console.log('Syntax checked:',files.length,'JavaScript files');
