#!/usr/bin/env node
// Generated iOS-only Info.plist usage strings for Staff voice features.
// No signing, App Store API, Android or production resources are accessed.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

if (process.platform !== 'darwin') {
  console.error('The iOS plist patch requires macOS.');
  process.exit(1);
}
const plist = join(process.cwd(), 'ios', 'App', 'App', 'Info.plist');
if (!existsSync(plist)) {
  console.error('Generated iOS Info.plist missing: prepare Capacitor iOS first.');
  process.exit(1);
}
const entries = [
  ['NSMicrophoneUsageDescription', 'O Staff usa o microfone somente quando você escolhe falar um comando de voz.'],
  ['NSSpeechRecognitionUsageDescription', 'O Staff transforma seus comandos de voz em texto para atender à solicitação.'],
];
for (const [key, message] of entries) {
  const query = spawnSync('/usr/libexec/PlistBuddy', ['-c', 'Print :' + key, plist], { encoding: 'utf8' });
  const command = query.status === 0 ? 'Set' : 'Add';
  const args = command === 'Set'
    ? ['-c', 'Set :' + key + ' ' + message, plist]
    : ['-c', 'Add :' + key + ' string ' + message, plist];
  const result = spawnSync('/usr/libexec/PlistBuddy', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Cannot set iOS usage description ' + key + ': ' + result.stderr);
  const check = spawnSync('/usr/libexec/PlistBuddy', ['-c', 'Print :' + key, plist], { encoding: 'utf8' });
  if (check.status !== 0 || check.stdout.trim() !== message) throw new Error('iOS usage description not preserved: ' + key);
}
console.log('PASS: Staff iOS microphone and speech-recognition usage descriptions verified.');
