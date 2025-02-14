// netlify/functions/stripe-webhook.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { doc, updateDoc } = require('firebase/firestore');
const { db } = require('./firebase.js');

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  const payload = event.body;

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }

  // Handle payment success
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;

    // Update user's search count in Firestore
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { searchesRemaining: 100 }); // Grant 100 searches
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};
