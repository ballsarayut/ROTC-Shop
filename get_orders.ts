import dotenv from "dotenv";
dotenv.config();

fetch(process.env.VITE_GOOGLE_SHEET_URL + "?action=read&sheet=Orders")
  .then(r => r.json())
  .then(data => {
    const d = data.find((x: any) => x.id === "IPGS70QV");
    console.log(JSON.stringify(d, null, 2));
  });
