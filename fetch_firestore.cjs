const https = require('https');

const url = 'https://firestore.googleapis.com/v1/projects/continual-webbing-dsjh2/databases/ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0/documents/products';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.documents) {
        json.documents.forEach((doc) => {
          const name = doc.fields.name?.stringValue || '';
          const price = doc.fields.price?.integerValue || doc.fields.price?.doubleValue || 0;
          console.log(`- ${name} : ${price}`);
        });
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
