CREATE TABLE public.members (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    subscription_plan VARCHAR(20) NOT NULL DEFAULT 'basic' CHECK (subscription_plan IN ('basic', 'standard', 'premium')),
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'suspended')),
    allowed_workout_days TEXT[] NOT NULL DEFAULT '{monday,wednesday,friday}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE FUNCTION public.handle_new_member ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY definer 
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.members (id, full_name, email)
    VALUES (
        NEW.id, 
        NEW.raw_user_meta_data ->> 'full_name', 
        NEW.email
    );

    return NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_member();

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_member_updated
    BEFORE UPDATE ON public.members
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;