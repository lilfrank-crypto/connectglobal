export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = req.body;
    console.log('PayHero callback received:', JSON.stringify(body));

    // PayHero sends status: 'Success' or 'Failed'
    const status = body?.status;
    const reference = body?.reference || body?.account_number || '';
    const phone = body?.phone_number || '';
    const amount = body?.amount || 0;

    if (status === 'Success') {
      // Write to Firestore via REST API
      const projectId = 'connectglobal-2458e';
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/pendingUnlocks/${reference}`;

      await fetch(firestoreUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            phone: { stringValue: phone },
            amount: { integerValue: String(amount) },
            reference: { stringValue: reference },
            status: { stringValue: 'paid' },
            paidAt: { stringValue: new Date().toISOString() },
          }
        })
      });

      console.log(`Payment confirmed for ${phone}, ref: ${reference}`);
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Callback error:', err);
    return res.status(200).json({ received: true }); // Always 200 to PayHero
  }
}
