// /api/mpesa-callback.js — Vercel Serverless Function
// Receives Safaricom's payment confirmation and writes result to Firestore
// Safaricom calls this URL automatically after the user enters their PIN

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyCRpHTVqVPC_rX54auYGcIk3xy4yMOVQ2o",
  authDomain:        "connectglobal-2458e.firebaseapp.com",
  projectId:         "connectglobal-2458e",
  storageBucket:     "connectglobal-2458e.firebasestorage.app",
  messagingSenderId: "272739449615",
  appId:             "1:272739449615:web:7a1470c4ca332d9014dc7a"
};

// Reuse Firebase app across warm serverless invocations
const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const payload  = req.body;
    const callback = payload?.Body?.stkCallback;

    if (!callback) {
      console.log('No callback body:', JSON.stringify(payload));
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const resultCode = callback.ResultCode;
    const checkoutId = callback.CheckoutRequestID;
    const items      = callback.CallbackMetadata?.Item || [];

    const getItem = name => items.find(i => i.Name === name)?.Value;
    const amount      = getItem('Amount');
    const receipt     = getItem('MpesaReceiptNumber');
    const phoneNumber = getItem('PhoneNumber');

    console.log(`Callback: code=${resultCode}, receipt=${receipt}, phone=${phoneNumber}, amount=${amount}`);

    if (resultCode === 0) {
      // ── Payment successful ──
      // Log the transaction
      await setDoc(doc(db, 'transactions', receipt || checkoutId), {
        receipt,
        amount,
        phone: phoneNumber?.toString(),
        checkoutRequestId: checkoutId,
        status: 'completed',
        source: 'mpesa-daraja',
        createdAt: serverTimestamp()
      });

      // Add to pendingUnlocks — admin sees it and confirms
      // (phone is the user identifier here since we don't have email from callback)
      await setDoc(doc(db, 'pendingUnlocks', `mpesa_${receipt}`), {
        phone: phoneNumber?.toString(),
        amount,
        receipt,
        checkoutRequestId: checkoutId,
        userId: phoneNumber?.toString(), // admin will match to user manually or by phone
        userName: 'M-Pesa Payment',
        source: 'mpesa-auto',
        createdAt: serverTimestamp()
      });

      console.log('Payment confirmed and logged:', receipt);
    } else {
      // Payment failed or cancelled
      console.log(`Payment not completed. Code: ${resultCode}, Desc: ${callback.ResultDesc}`);
      await setDoc(doc(db, 'transactions', checkoutId), {
        checkoutRequestId: checkoutId,
        status: resultCode === 1032 ? 'cancelled' : 'failed',
        resultCode,
        resultDesc: callback.ResultDesc,
        createdAt: serverTimestamp()
      });
    }

    // Always return 200 to Safaricom to stop retries
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  } catch (err) {
    console.error('Callback error:', err);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
}
