// /api/daraja-webhook.js
// Vercel Serverless Function — receives STK Push callback from M-Pesa via Daraja
// 
// M-Pesa sends the callback when user completes or cancels the STK Push prompt
// Configure DARAJA_WEBHOOK_URL=https://connectglobal-tan.vercel.app/api/daraja-webhook in Vercel env

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    console.log('Daraja webhook received:', JSON.stringify(payload, null, 2));

    // M-Pesa Daraja STK Push callback format:
    // {
    //   "Body": {
    //     "stkCallback": {
    //       "MerchantRequestID": "29115-34620561-1",
    //       "CheckoutRequestID": "ws_co_191220191020375136",
    //       "ResultCode": 0,
    //       "ResultDesc": "The service request is processed successfully.",
    //       "CallbackMetadata": {
    //         "Item": [
    //           { "Name": "Amount", "Value": 1.0 },
    //           { "Name": "MpesaReceiptNumber", "Value": "NLJ7RT61SQG" },
    //           { "Name": "TransactionDate", "Value": 20191219102115 },
    //           { "Name": "PhoneNumber", "Value": 254708374149 }
    //         ]
    //       }
    //     }
    //   }
    // }

    const callback = payload?.Body?.stkCallback;
    if (!callback) {
      console.warn('Invalid callback payload structure');
      return res.status(200).json({ received: true, note: 'Invalid format' });
    }

    const resultCode = callback.ResultCode;
    const resultDesc = callback.ResultDesc;
    const merchantRequestId = callback.MerchantRequestID;
    const checkoutRequestId = callback.CheckoutRequestID;

    const items = callback.CallbackMetadata?.Item || [];
    const getItem = (name) => items.find(i => i.Name === name)?.Value;

    const amount = getItem('Amount');
    const receipt = getItem('MpesaReceiptNumber');
    const transactionDate = getItem('TransactionDate');
    const phoneNumber = getItem('PhoneNumber');

    if (resultCode === 0) {
      // ✅ Payment successful
      console.log(`
✅ PAYMENT CONFIRMED
   Amount: KSh ${amount}
   Receipt: ${receipt}
   Phone: ${phoneNumber}
   Date: ${transactionDate}
   MerchantRequestID: ${merchantRequestId}
   CheckoutRequestID: ${checkoutRequestId}
      `);

      // TODO: If you add a database (Vercel KV, Supabase, Firebase):
      // - Store this confirmation in your DB
      // - Your admin dashboard can then query confirmed payments
      // - Sync status to your localStorage-based app via `/api/payment-status` endpoint
      //
      // For now, admins manually confirm in the dashboard by checking their M-Pesa app

    } else if (resultCode === 1032) {
      // User cancelled the STK Push
      console.log(`❌ User cancelled payment. ResultCode: ${resultCode}`);
    } else {
      // Payment failed
      console.log(`❌ Payment failed. ResultCode: ${resultCode}, Desc: ${resultDesc}`);
    }

    // Always respond 200 OK so M-Pesa doesn't retry indefinitely
    return res.status(200).json({ 
      received: true,
      merchantRequestId,
      checkoutRequestId
    });

  } catch (err) {
    console.error('Webhook error:', err);
    // Still return 200 so M-Pesa doesn't keep retrying
    return res.status(200).json({ received: true, error: err.message });
  }
}
