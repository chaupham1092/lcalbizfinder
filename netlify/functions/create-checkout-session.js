// netlify/functions/create-checkout-session.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const { userId } = JSON.parse(event.body);

  // Create a Stripe Checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price: 'YOUR_STRIPE_PRICE_ID', // Replace with your Stripe price ID
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.URL}/cancel`,
    metadata: {
      userId,
    },
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ id: session.id }),
  };
};
