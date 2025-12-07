// Stripe Webhook Handler for CarCashPro
// This endpoint receives payment confirmations from Stripe and activates Pro subscriptions

import Stripe from 'stripe';
import admin from 'firebase-admin';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export const config = {
  api: {
    bodyParser: false, // Stripe requires raw body for signature verification
  },
};

// Helper to get raw body
const getRawBody = async (req) => {
  return new Promise((resolve, reject) => {
    let buffer = '';
    req.on('data', (chunk) => {
      buffer += chunk;
    });
    req.on('end', () => {
      resolve(buffer);
    });
    req.on('error', reject);
  });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const rawBody = await getRawBody(req);
    
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        
        // Get customer email from session
        const customerEmail = session.customer_details?.email || session.customer_email;
        
        if (customerEmail) {
          // Find user by email in Firebase
          const usersSnapshot = await db.collection('users')
            .where('email', '==', customerEmail)
            .limit(1)
            .get();
          
          if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            
            // Update user to Pro
            await userDoc.ref.update({
              isPro: true,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              proActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            console.log(`✅ Activated Pro for user: ${customerEmail}`);
          } else {
            console.warn(`⚠️ User not found for email: ${customerEmail}`);
          }
        }
        break;

      case 'customer.subscription.deleted':
        // Handle subscription cancellation
        const subscription = event.data.object;
        
        // Find user by Stripe subscription ID
        const cancelSnapshot = await db.collection('users')
          .where('stripeSubscriptionId', '==', subscription.id)
          .limit(1)
          .get();
        
        if (!cancelSnapshot.empty) {
          const userDoc = cancelSnapshot.docs[0];
          
          // Deactivate Pro
          await userDoc.ref.update({
            isPro: false,
            proCancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          
          console.log(`❌ Deactivated Pro for subscription: ${subscription.id}`);
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
