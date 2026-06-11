const { spawn } = require('child_process');
const fs = require('fs');

const out = fs.openSync('./clean.log', 'a');
const err = fs.openSync('./clean.log', 'a');

const child = spawn('npx', ['tsx', 'clean_all_schools.ts'], {
  detached: true,
  stdio: [ 'ignore', out, err ]
});

child.unref();
console.log("Spawned detached process with PID:", child.pid);
