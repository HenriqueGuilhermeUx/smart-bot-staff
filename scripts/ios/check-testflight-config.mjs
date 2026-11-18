#!/usr/bin/env node
// Static pre-TestFlight checks only. Does not authenticate, sign, or upload.
import {readFileSync} from 'node:fs';
const cap=readFileSync('capacitor.config.ts','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const errors=[];
const check=(ok,msg)=>{if(!ok) errors.push(msg)};
check(/appId:\s*['"]br\.com\.alternativeventures\.staff['"]/.test(cap),'Unexpected Staff iOS bundle identifier');
check(/webDir:\s*['"]dist['"]/.test(cap),'Unexpected Capacitor output directory');
check(/allowMixedContent:\s*false/.test(cap),'Review changed cleartext/mixed content setting');
for(const dep of ['@capacitor/core','@capacitor/cli','@capacitor/android']){
 const v=pkg.dependencies?.[dep]||pkg.devDependencies?.[dep]||'';
 check(/^8\./.test(v),'Expected Capacitor 8 dependency: '+dep);
}
for(const dep of ['@capgo/capacitor-speech-recognition','@capgo/capacitor-speech-synthesis','@capacitor/local-notifications']){
 check(Boolean(pkg.dependencies?.[dep]),'Native capability dependency missing: '+dep);
}
console.log('INFO: microphone, speech recognition and notifications need physical iPhone permission/denial/revocation QA');
console.log('INFO: Apple team, code signing, commercial Play AAB identity, privacy, deletion and review metadata unverified');
for(const msg of errors) console.error('FAIL:',msg);
if(errors.length) process.exitCode=1;
else console.log('PASS: Staff static pre-TestFlight source config only');
