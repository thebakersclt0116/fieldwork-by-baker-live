-- Run after the durable auth migration, only through the explicit migration command.
ALTER TABLE fieldwork_entitlements
  ADD COLUMN IF NOT EXISTS billing_access_ends_at timestamptz;

CREATE TABLE IF NOT EXISTS fieldwork_billing_customers (
  user_id text NOT NULL REFERENCES fieldwork_auth_user(id) ON DELETE RESTRICT,
  stripe_customer_id text NOT NULL UNIQUE,
  livemode boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, livemode),
  UNIQUE (stripe_customer_id, user_id, livemode)
);

CREATE TABLE IF NOT EXISTS fieldwork_billing_checkouts (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  livemode boolean NOT NULL,
  plan_id text NOT NULL CHECK (plan_id IN ('individual_monthly', 'professional_monthly', 'professional_annual')),
  integration_identifier text NOT NULL,
  stripe_checkout_session_id text UNIQUE,
  stripe_subscription_id text,
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'no_payment_required', 'failed')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'complete', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (stripe_customer_id, user_id, livemode)
    REFERENCES fieldwork_billing_customers(stripe_customer_id, user_id, livemode) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS fieldwork_billing_checkouts_user
  ON fieldwork_billing_checkouts(user_id, livemode, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS fieldwork_billing_one_open_checkout
  ON fieldwork_billing_checkouts(user_id, livemode) WHERE status IN ('pending', 'open');
ALTER TABLE fieldwork_billing_checkouts
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE fieldwork_billing_checkouts
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

CREATE TABLE IF NOT EXISTS fieldwork_billing_subscriptions (
  stripe_subscription_id text PRIMARY KEY,
  user_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  livemode boolean NOT NULL,
  plan_id text CHECK (plan_id IN ('individual_monthly', 'professional_monthly', 'professional_annual')),
  status text NOT NULL,
  current_period_end timestamptz,
  paid_access_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  latest_invoice_paid boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (stripe_customer_id, user_id, livemode)
    REFERENCES fieldwork_billing_customers(stripe_customer_id, user_id, livemode) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS fieldwork_billing_subscriptions_user
  ON fieldwork_billing_subscriptions(user_id, livemode);

-- Store only reconciliation evidence, never the event body, email, or payment data.
CREATE TABLE IF NOT EXISTS fieldwork_billing_events (
  stripe_event_id text PRIMARY KEY,
  livemode boolean NOT NULL,
  event_type text NOT NULL,
  event_created_at timestamptz NOT NULL,
  stripe_object_id text,
  outcome text NOT NULL DEFAULT 'processing',
  processed_at timestamptz
);

CREATE OR REPLACE FUNCTION fieldwork_keep_billing_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.livemode IS DISTINCT FROM OLD.livemode THEN
    RAISE EXCEPTION 'Fieldwork billing ownership is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fieldwork_billing_customer_owner ON fieldwork_billing_customers;
CREATE TRIGGER fieldwork_billing_customer_owner
  BEFORE UPDATE ON fieldwork_billing_customers
  FOR EACH ROW EXECUTE FUNCTION fieldwork_keep_billing_owner();
DROP TRIGGER IF EXISTS fieldwork_billing_checkout_owner ON fieldwork_billing_checkouts;
CREATE TRIGGER fieldwork_billing_checkout_owner
  BEFORE UPDATE ON fieldwork_billing_checkouts
  FOR EACH ROW EXECUTE FUNCTION fieldwork_keep_billing_owner();
DROP TRIGGER IF EXISTS fieldwork_billing_subscription_owner ON fieldwork_billing_subscriptions;
CREATE TRIGGER fieldwork_billing_subscription_owner
  BEFORE UPDATE ON fieldwork_billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION fieldwork_keep_billing_owner();
