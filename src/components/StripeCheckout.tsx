/**
 * Stripe Checkout Integration for Fieldwork by Baker
 * 
 * This component handles subscription checkout using Stripe.
 * It loads the Stripe.js library and redirects to Stripe Checkout
 * for secure payment processing with Apple Pay, Google Pay, and cards.
 */

import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { motion } from 'framer-motion';
import { CreditCard, Apple, Loader2 } from 'lucide-react';

// Initialize Stripe with your publishable key
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

interface StripeCheckoutProps {
  priceId: string;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function StripeCheckout({
  priceId,
  planName,
  billingCycle,
  onSuccess,
  onError,
}: StripeCheckoutProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = useCallback(async () => {
    if (!stripePromise) {
      onError?.('Stripe is not configured. Please add your publishable key.');
      return;
    }

    setIsLoading(true);

    try {
      // In production, this would call your backend API to create a checkout session
      // For now, we show a demo modal explaining the integration
      
      // Simulated checkout flow - replace with actual API call
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }

      // Production implementation:
      // 1. Call your backend: POST /api/create-checkout-session
      //    body: { priceId, planName, billingCycle, customerEmail }
      // 2. Backend creates Stripe Checkout Session
      // 3. Return { sessionId }
      // 4. stripe.redirectToCheckout({ sessionId })

      // Demo: Show success after brief delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Checkout failed';
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  }, [priceId, planName, billingCycle, onSuccess, onError]);

  return (
    <div className="space-y-3">
      {/* Apple Pay Button (primary for mobile/convenience) */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleCheckout}
        disabled={isLoading}
        className="w-full h-12 bg-black text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <>
            <Apple size={18} />
            Pay with Apple Pay
          </>
        )}
      </motion.button>

      {/* Credit/Debit Card Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleCheckout}
        disabled={isLoading}
        className="w-full h-12 bg-white text-[#332C28] border-2 border-[#F2EDEA] rounded-xl text-sm font-semibold hover:bg-[#FAF8F6] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <>
            <CreditCard size={18} />
            Credit or Debit Card
          </>
        )}
      </motion.button>

      {/* Google Pay Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleCheckout}
        disabled={isLoading}
        className="w-full h-12 bg-white text-[#332C28] border-2 border-[#F2EDEA] rounded-xl text-sm font-semibold hover:bg-[#FAF8F6] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Pay with Google Pay
          </>
        )}
      </motion.button>
    </div>
  );
}

/**
 * Stripe Integration Checklist
 * 
 * 1. Install Stripe packages:
 *    npm install @stripe/stripe-js @stripe/react-stripe-js
 * 
 * 2. Create a .env file with your Stripe keys:
 *    VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
 * 
 * 3. Set up your backend API endpoint:
 *    POST /api/create-checkout-session
 *    - Creates Stripe Checkout Session
 *    - Returns { sessionId }
 *    
 * 4. In production, replace the demo handleCheckout with:
 *    const response = await fetch('/api/create-checkout-session', {
 *      method: 'POST',
 *      headers: { 'Content-Type': 'application/json' },
 *      body: JSON.stringify({ priceId, planName, billingCycle }),
 *    });
 *    const { sessionId } = await response.json();
 *    const stripe = await stripePromise;
 *    await stripe?.redirectToCheckout({ sessionId });
 * 
 * 5. Set up webhook endpoint:
 *    POST /api/stripe-webhook
 *    - Handle checkout.session.completed
 *    - Activate subscription in database
 */
