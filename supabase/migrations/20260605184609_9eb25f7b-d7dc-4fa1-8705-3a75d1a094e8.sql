-- Use a unique constraint on email and phone to prevent duplicates
-- If a user with the same email and phone tries to access again, it will trigger an update or just handle gracefully
ALTER TABLE public.demo_leads ADD CONSTRAINT demo_leads_email_phone_unique UNIQUE (email, phone);