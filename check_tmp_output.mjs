import fs from 'fs';

const file = 'tmp_output.json';
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  console.log("File size:", content.length);
  try {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      console.log("It's an array with", data.length, "elements");
      if (data.length > 0) {
        console.log("First element keys:", Object.keys(data[0]));
        console.log("Distinct table/sheet names or properties:", data.map(x => x.sheet).filter((v, i, a) => a.indexOf(v) === i));
      }
    } else {
      console.log("It's an object. Keys:", Object.keys(data));
    }
  } catch(e) {
    console.log("Failed to parse as JSON:", e.message);
    console.log("Showing first 300 characters:", content.substring(0, 300));
  }
} else {
  console.log("File not found");
}
