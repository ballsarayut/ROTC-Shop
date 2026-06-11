import { googleSheetService } from './src/services/googleSheetService.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const payload = {
        id: "TEST1",
        items: JSON.stringify([{id: "1", name: "test"}])
    };
    
    // Simulate what AdminDashboard does
    const fakeOrder = {
       id: "TEST_ORDER_ADMIN",
       items: [{id: "1", name: "test"}]
    }

    const payload2 = {
       ...fakeOrder,
       items: JSON.stringify(fakeOrder.items)
    };

    console.log("PAYLOAD 2:", payload2);

    // Simulate what checkout does
    const orderData = {
        id: "TEST_CHK",
        items: [{id:"2", name:"test2"}]
    }
    const cleanOrderData = JSON.parse(JSON.stringify(orderData));
    const payload3 = {
       ...cleanOrderData,
       items: JSON.stringify(orderData.items)
    };
    console.log("PAYLOAD 3:", payload3);
}

run();
