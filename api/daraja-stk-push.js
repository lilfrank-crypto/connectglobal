// /api/daraja-stk-push.js
// Vercel Serverless Function — initiates an M-Pesa STK Push via Safaricom's Daraja API
// Direct integration with M-Pesa. No middleman.
//
// Uses AgriFlow's Daraja sandbox credentials for testing
// Required Environment Variables (set in Vercel dashboard):
// - DARAJA_CONSUMER_KEY: hvQKMrAkocApoSmWbcV0m9Wa2NDUsQKiJYtMel2EK0q8U40b
// - DARAJA_CONSUMER_SECRET: tyqRe9OGu6rL22Wiy7lD9GeHyIgdMv1RuxhZSZV9I62wR1SrDw1pGUNfsRtN8VBO
// - DARAJA_BUSINESS_SHORTCODE: Your Till Number (3527691)
// - DARAJA_WEBHOOK_URL: https://connectglobal-tan.vercel.app/api/daraja-webhook

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
    let phoneNumber = phone.toString().replace(/\D/g, '');
    if (phoneNumber.startsWith('0')) phoneNumber = '254' + phoneNumber.slice(1);
    if (phoneNumber.length === 9) phoneNumber = '254' + phoneNumber;
    if (!phoneNumber.startsWith('254')) phoneNumber = '254' + phoneNumber;

    // Validate credentials
    const consumerKey = process.env.DARAJA_CONSUMER_KEY;
    const consumerSecret = process.env.DARAJA_CONSUMER_SECRET;
    const shortcode = process.env.DARAJA_BUSINESS_SHORTCODE || '174379';
    const webhookUrl = process.env.DARAJA_WEBHOOK_URL;

    if (!consumerKey || !consumerSecret) {
      return res.status(500).json({ 
        error: 'Daraja credentials not configured',
        details: 'Set DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET in environment variables'
      });
    }

    // Step 1: Get OAuth token from Daraja (SANDBOX)
    const authString = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const tokenResponse = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`
      }
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('OAuth token error:', errorText);
      return res.status(500).json({ 
        error: 'Failed to get Daraja OAuth token',
        details: errorText 
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Step 2: Generate timestamp and password for STK Push
    const timestamp = new Date().toISOString().replace(/[:-]/g, '').slice(0, -5);
    
    // For sandbox testing, use a default passkey if not provided
    // In production, Safaricom will send you the actual passkey
    const passkey = process.env.DARAJA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd1a503017';
    const passwordString = shortcode + passkey + timestamp;
    const password = Buffer.from(passwordString).toString('base64');

    // Step 3: Initiate STK Push to SANDBOX endpoint
    const stkPushResponse = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(amount),
        PartyA: phoneNumber,
        PartyB: shortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: webhookUrl || `https://${req.headers.host}/api/daraja-webhook`,
        AccountReference: accountRef || 'ConnectGlobal',
        TransactionDesc: accountRef || 'Payment via ConnectGlobal'
      })
    });

    if (!stkPushResponse.ok) {
      const errorText = await stkPushResponse.text();
      console.error('STK Push error:', errorText);
      return res.status(500).json({ 
        error: 'Failed to initiate STK Push',
        details: errorText 
      });
    }

    const stkData = await stkPushResponse.json();

    console.log(`✅ STK Push initiated for ${phoneNumber}, amount: KSh ${amount}`);

    return res.status(200).json({
      success: true,
      message: 'STK Push sent successfully',
      checkoutRequestId: stkData.CheckoutRequestID,
      merchantRequestId: stkData.MerchantRequestID,
      responseCode: stkData.ResponseCode,
      data: stkData
    });

  } catch (err) {
    console.error('STK Push error:', err);
    return res.status(500).json({ 
      error: 'Failed to initiate payment', 
      details: err.message 
    });
  }
}
