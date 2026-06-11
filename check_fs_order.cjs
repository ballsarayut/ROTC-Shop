const https = require('https');

const url = 'https://firestore.googleapis.com/v1/projects/continual-webbing-dsjh2/databases/ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0/documents/orders?pageSize=100';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.documents) {
        const order = json.documents.find(d => d.name.endsWith('u11fuobKKiEfHrtmqMlI'));
        if (order) {
           console.log(JSON.stringify(order, null, 2));
        } else {
           console.log("Order not found in firestore");
           // print first few IDs
           const ids = json.documents.map(d => d.name.split('/').pop());
           console.log("IDs:", ids.slice(0, 10));
        }
      } else {
        console.log(json);
      }
    } catch (e) {
      console.error(e);
    }
  });
}).on('error', (e) => {
  console.error(e);
});
