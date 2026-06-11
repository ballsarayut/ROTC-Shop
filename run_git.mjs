import { exec } from 'child_process';

exec('git log -n 10 --oneline', (err, stdout, stderr) => {
  if (err) {
    console.error("Error executing git log:", err);
    return;
  }
  console.log("Git Log Output:\n", stdout);
});
