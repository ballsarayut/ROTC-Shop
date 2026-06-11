import fs from 'fs';
try {
  const env = fs.readFileSync('.env', 'utf8');
  console.log(env);
} catch (e) {
  console.log('.env not found');
}
