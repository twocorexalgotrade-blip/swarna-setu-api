
const axios = require('axios');

async function fetchRates() {
    try {
        console.log("Fetching...");
        const response = await axios.get('https://data-asg.goldprice.org/dbXRates/INR', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log("Response status:", response.status);
        console.log("Response data:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("Error:", error.message);
        if (error.response) {
            console.log("Error response:", error.response.data);
        }
    }
}

fetchRates();
