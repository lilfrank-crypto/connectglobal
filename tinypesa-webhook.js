// /api/tinypesa-webhook.js
// Vercel Serverless Function — receives payment confirmation callbacks from TinyPesa
// Configure this URL in your TinyPesa dashboard as the callback/webhook URL:
//   https://YOUR-DOMAIN.vercel.app/api/tinypesa-webhook

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    console.log('TinyPesa webhook received:', JSON.stringify(payload));

    // TinyPesa typically sends something like:
    // {
    //   "Body": {
    //     "stkCallback": {
    //       "MerchantRequestID": "...",
    //       "CheckoutRequestID": "...",
    //       "ResultCode": 0,
    //       "ResultDesc": "The service request is processed successfully.",
    //       "CallbackMetadata": {
    //         "Item": [
    //           { "Name": "Amount", "Value": 100 },
    //           { "Name": "MpesaReceiptNumber", "Value": "ABC123XYZ" },
    //           { "Name": "PhoneNumber", "Value": 254712345678 }
    //         ]
    //       }
    //     }
    //   }
    // }

    const callback = payload?.Body?.stkCallback;
    const resultCode = callback?.ResultCode;
    const items = callback?.CallbackMetadata?.Item || [];

    const getItem = (name) => items.find(i => i.Name === name)?.Value;

    const amount = getItem('Amount');
    const receipt = getItem('MpesaReceiptNumber');
    const phoneNumber = getItem('PhoneNumber');

    if (resultCode === 0) {
      // Payment successful
      console.log(`✅ Payment success: KSh ${amount} from ${phoneNumber}, receipt: ${receipt}`);

      // NOTE: Since this app uses localStorage for the admin↔user bridge,
      // and serverless functions can't write to the browser's localStorage,
      // this webhook currently just logs the event.
      //
      // For full automation, you'd connect this to a database (e.g. Vercel KV,
      // Supabase, or Firebase) so the admin dashboard and user app can both
      // read the confirmed payment status from a shared backend.
      //
      // For now: the admin manually confirms payments in the dashboard's
      // "Pending Confirmations" section after checking their M-Pesa messages.

    } else {
      console.log(`❌ Payment failed or cancelled. ResultCode: ${resultCode}, Desc: ${callback?.ResultDesc}`);
    }

    // Always respond 200 OK so TinyPesa doesn't retry indefinitely
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
}
