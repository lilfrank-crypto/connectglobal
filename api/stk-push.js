export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { phone, amount, reference } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: 'Phone and amount are required' });
    }

    // Normalize phone to 254XXXXXXXXX
    let normalizedPhone = phone.toString().replace(/\s+/g, '').replace(/^\+/, '');
    if (normalizedPhone.startsWith('0')) normalizedPhone = '254' + normalizedPhone.slice(1);
    if (!normalizedPhone.startsWith('254')) normalizedPhone = '254' + normalizedPhone;

    const payload = {
      amount: Number(amount),
      phone_number: normalizedPhone,
      channel_id: 9523,
      network_code: '63902',
      external_reference: reference || 'CGLOBAL',
      callback_url: 'https://connectglobal-tan.vercel.app/api/payhero-callback',
    };

    const response = await fetch('https://backend.payhero.co.ke/api/v2/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic NTNIR2hFUjVXTkc2cWpZYXRnSG46ZWFqaUV1NkNIRVJIeFE2dmRkd1h0eENPQzZEZGpBdDI4dnBsUlVDSQ==',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('PayHero full response:', JSON.stringify(data));
    console.log('PayHero status:', response.status);

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'PayHero error', details: data, payload_sent: payload });
    }

    return res.status(200).json({
      success: true,
      reference: data.reference || reference,
      message: 'STK Push sent. Enter your M-Pesa PIN to complete payment.',
      data,
    });

  } catch (err) {
    console.error('STK push error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
