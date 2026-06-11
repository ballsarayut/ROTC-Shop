import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  if (!SCRIPT_URL) return;

  const readUrl = `${SCRIPT_URL}?action=read&sheet=Orders`;
  const data = await (await fetch(readUrl)).json() as any[];

  const target = data.find((r: any) => r.id === 'HFCHc8iPgpKrjqTloZ48');
  console.log("Read 1: target =", {
    id: target?.id,
    fullName: target?.fullName,
    isEmbroidered: target?.isEmbroidered,
  });

  // Let's call the script to sync!
  const payload = {
    ...target,
    isEmbroidered: true
  };

  const response = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'sync',
      sheet: 'Orders',
      payload: payload
    })
  });
  console.log("POST response:", await response.json());

  // Read back 2
  const data2 = await (await fetch(readUrl)).json() as any[];
  const target2 = data2.find((r: any) => r.id === 'HFCHc8iPgpKrjqTloZ48');
  console.log("Read 2: target =", {
    id: target2?.id,
    fullName: target2?.fullName,
    isEmbroidered: target2?.isEmbroidered,
  });
}

run();
