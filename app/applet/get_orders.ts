import dotenv from "dotenv";
dotenv.config();

fetch(process.env.VITE_GOOGLE_SHEET_URL + "?action=read&sheet=Orders")
  .then(r => r.json())
  .then(data => {
    const d = data.find(x => x.id === "IPGS70QV") || data[data.length-1];
    console.log(JSON.stringify(d, null, 2));
  });
