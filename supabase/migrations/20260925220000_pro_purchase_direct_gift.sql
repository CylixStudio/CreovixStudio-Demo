-- Pro checkout: direct account activation vs gift/code purchase.
-- Extends pro_purchases with purchase_type + optional gift fields.

ALTER TABLE public.pro_purchases
  ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'gift',
  ADD COLUMN IF NOT EXISTS gift_recipient_email text,
  ADD COLUMN IF NOT EXISTS gift_message text,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pro_purchases_purchase_type_check'
  ) THEN
    ALTER TABLE public.pro_purchases
      ADD CONSTRAINT pro_purchases_purchase_type_check
      CHECK (purchase_type IN ('direct', 'gift'));
  END IF;
END $$;

-- Existing rows were code-delivery purchases.
UPDATE public.pro_purchases
   SET purchase_type = 'gift'
 WHERE purchase_type IS NULL OR purchase_type = '';

CREATE INDEX IF NOT EXISTS pro_purchases_type_idx
  ON public.pro_purchases (purchase_type, created_at DESC);

COMMENT ON COLUMN public.pro_purchases.purchase_type IS
  'direct = Pro applied to user_id immediately; gift = activation code emailed for manual redeem';
COMMENT ON COLUMN public.pro_purchases.gift_recipient_email IS
  'Optional recipient for gift codes; when null the buyer email receives the code';
COMMENT ON COLUMN public.pro_purchases.gift_message IS
  'Optional personal gift message included in the gift email';
COMMENT ON COLUMN public.pro_purchases.activated_at IS
  'When direct purchase applied Pro to user_subscriptions';
COMMENT ON COLUMN public.pro_purchases.user_id IS
  'Buyer / account that receives Pro on direct purchases';

NOTIFY pgrst, 'reload schema';
