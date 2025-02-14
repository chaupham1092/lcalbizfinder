const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { doc, updateDoc } = require('firebase/firestore');
const { db } = require('./firebase.js');

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  const payload = event.body;

  let stripeEvent;

  try {
    // Verify the webhook signature
    stripeEvent = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }

  // Handle the event
  switch (stripeEvent.type) {
    case 'checkout.session.completed':
      const session = stripeEvent.data.object;
      const userId = session.metadata.userId;

      // Update the user's search count in Firestore
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { searchesRemaining: 100 }); // Grant 100 searches
      break;

    default:
      console.log(`Unhandled event type: ${stripeEvent.type}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};
