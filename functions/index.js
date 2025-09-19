const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();
const stripe = Stripe(functions.config().stripe ? functions.config().stripe.secret : "YOUR_STRIPE_SECRET"); // set via `firebase functions:config:set stripe.secret="sk_..."`

// create checkout session for subscription or one-time payment
exports.createCheckoutSession = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { priceId, uid, successUrl, cancelUrl } = req.body;
      if (!uid || !priceId) return res.status(400).send("Missing uid or priceId");

      // Ensure user has a stripeCustomerId
      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      let customerId = userSnap.exists ? userSnap.data().stripeCustomerId : null;

      if (!customerId) {
        const user = userSnap.exists ? userSnap.data() : {};
        const customer = await stripe.customers.create({
          email: user.email
        });
        customerId = customer.id;
        await userRef.set({ stripeCustomerId: customerId }, { merge: true });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription", // or "payment" for one-time
        payment_method_types: ["card"],
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error(err);
      res.status(500).send(err.message);
    }
  });
});

// webhook to handle checkout.session.completed and update user's isPaid
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const endpointSecret = functions.config().stripe.webhook_secret || "YOUR_WEBHOOK_SECRET";
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.log("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const customer = session.customer;
    try {
      // Find user by stripeCustomerId
      const users = await db.collection("users").where("stripeCustomerId", "==", customer).get();
      if (!users.empty) {
        const uRef = users.docs[0].ref;
        await uRef.set({ isPaid: true }, { merge: true });
      }
    } catch (err) {
      console.error(err);
    }
  }

  res.json({ received: true });
});
