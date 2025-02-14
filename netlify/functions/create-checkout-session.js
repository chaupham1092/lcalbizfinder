const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price: 'YOUR_STRIPE_PRICE_ID', // Replace with your Stripe Price ID
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.URL}/success`,
    cancel_url: `${process.env.URL}/cancel`,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ id: session.id }),
  };
};
