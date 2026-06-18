// /api/stk-push.js — Vercel Serverless Function
// Initiates M-Pesa STK Push via Safaricom Daraja API
// Till Number: under Franklin Kariuki Muturi

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { phone, amount, userEmail, userName } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'Missing phone or amount' });

    // ── Credentials (set these in Vercel Environment Variables) ──
    const CONSUMER_KEY     = process.env.MPESA_CONSUMER_KEY;
    const CONSUMER_SECRET  = process.env.MPESA_CONSUMER_SECRET;
    const SHORTCODE        = process.env.MPESA_SHORTCODE;      // Your Till Number
    const PASSKEY          = process.env.MPESA_PASSKEY;        // From Safaricom Daraja portal
    const CALLBACK_URL     = process.env.MPESA_CALLBACK_URL;   // https://your-domain.vercel.app/api/mpesa-callback

    if (!CONSUMER_KEY || !CONSUMER_SECRET || !SHORTCODE || !PASSKEY) {
      return res.status(500).json({ error: 'M-Pesa credentials not configured in environment variables' });
    }

    // ── Step 1: Get OAuth token ──
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const tokenRes = await fetch('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` }
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      console.error('Token error:', tokenData);
      return res.status(500).json({ error: 'Failed to get M-Pesa access token', detail: tokenData });
    }

    // ── Step 2: Generate password and timestamp ──
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password  = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

    // ── Step 3: Normalize phone to 254XXXXXXXXX ──
    let msisdn = phone.toString().replace(/\D/g, '');
    if (msisdn.startsWith('0'))  msisdn = '254' + msisdn.slice(1);
    if (msisdn.startsWith('7') || msisdn.startsWith('1')) msisdn = '254' + msisdn;

    // ── Step 4: STK Push request ──
    const stkBody = {
      BusinessShortCode: SHORTCODE,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   'CustomerBuyGoodsOnline',  // For Till Numbers
      Amount:            parseInt(amount),
      PartyA:            msisdn,
      PartyB:            SHORTCODE,
      PhoneNumber:       msisdn,
      CallBackURL:       CALLBACK_URL || `https://connectglobal-tan.vercel.app/api/mpesa-callback`,
      AccountReference:  'ConnectGlobal',
      TransactionDesc:   `Chat access for ${userName || 'user'}`
    };

    const stkRes = await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method:  'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(stkBody)
    });

    const stkData = await stkRes.json();
    console.log('STK Push response:', JSON.stringify(stkData));

    if (stkData.ResponseCode === '0') {
      return res.status(200).json({
        success: true,
        checkoutRequestId: stkData.CheckoutRequestID,
        message: 'STK Push sent successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        error: stkData.errorMessage || stkData.ResultDesc || 'STK Push failed',
        detail: stkData
      });
    }

  } catch (err) {
    console.error('STK Push error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
