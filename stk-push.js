// /api/stk-push.js
// Vercel Serverless Function — initiates an M-Pesa STK Push via TinyPesa
// Keeps the TinyPesa API key secure on the server side (never exposed to the browser)

export default async function handler(req, res) {
  // Allow CORS for your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, amount, accountRef } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: 'Missing phone or amount' });
    }

    // Normalize phone to 254XXXXXXXXX format
    let msisdn = phone.toString().replace(/\D/g, '');
    if (msisdn.startsWith('0')) msisdn = '254' + msisdn.slice(1);
    if (msisdn.startsWith('7') || msisdn.startsWith('1')) msisdn = '254' + msisdn;

    const TINYPESA_API_URL = process.env.TINYPESA_API_URL || 'https://tinypesa.com/api/v1';
    const TINYPESA_API_KEY = process.env.TINYPESA_LINK_API_KEY;

    if (!TINYPESA_API_KEY) {
      return res.status(500).json({ error: 'TinyPesa API key not configured on server' });
    }

    const response = await fetch(`${TINYPESA_API_URL}/express/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Apikey': TINYPESA_API_KEY
      },
      body: new URLSearchParams({
        amount: amount.toString(),
        msisdn: msisdn,
        account_no: accountRef || 'ConnectGlobal'
      })
    });

    const data = await response.json();

    return res.status(200).json({
      success: true,
      data
    });

  } catch (err) {
    console.error('STK Push error:', err);
    return res.status(500).json({ error: 'Failed to initiate payment', details: err.message });
  }
}
