const https = require('https');

const url = 'https://firestore.googleapis.com/v1/projects/continual-webbing-dsjh2/databases/ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0/documents/orders?pageSize=1';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      console.log(JSON.parse(data));
    } catch (e) {
      console.error(e);
    }
  });
}).on('error', (e) => {
  console.error(e);
});
