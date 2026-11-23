CREATE OR REPLACE FUNCTION public.payment_vault_save(p_password text, p_environment text, p_access_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_hash text;
BEGIN
  SELECT vault_password_hash INTO v_hash FROM public.payment_gateway_settings WHERE id = 1 FOR UPDATE;
  IF v_hash IS NULL OR crypt(p_password, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'Senha do cofre incorreta.';
  END IF;
  IF p_environment NOT IN ('test', 'production') THEN
    RAISE EXCEPTION 'Ambiente inválido.';
  END IF;
  IF p_access_token <> '' AND NOT (
    (p_environment = 'test' AND p_access_token LIKE 'TEST-%') OR
    (p_environment = 'production' AND p_access_token LIKE 'APP_USR-%')
  ) THEN
    RAISE EXCEPTION 'Token incompatível com o ambiente escolhido.';
  END IF;
  UPDATE public.payment_gateway_settings
  SET environment = p_environment,
      access_token = NULLIF(p_access_token, ''),
      updated_at = now()
  WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_vault_reveal(p_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_row public.payment_gateway_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.payment_gateway_settings WHERE id = 1;
  IF v_row.vault_password_hash IS NULL OR crypt(p_password, v_row.vault_password_hash) <> v_row.vault_password_hash THEN
    RAISE EXCEPTION 'Senha do cofre incorreta.';
  END IF;
  RETURN COALESCE(v_row.access_token, '');
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_vault_set_password(p_current text, p_new text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_hash text;
BEGIN
  IF char_length(p_new) < 8 OR char_length(p_new) > 100 THEN
    RAISE EXCEPTION 'A senha deve ter entre 8 e 100 caracteres.';
  END IF;
  SELECT vault_password_hash INTO v_hash FROM public.payment_gateway_settings WHERE id = 1 FOR UPDATE;
  IF v_hash IS NOT NULL AND (p_current IS NULL OR crypt(p_current, v_hash) <> v_hash) THEN
    RAISE EXCEPTION 'Senha atual do cofre incorreta.';
  END IF;
  UPDATE public.payment_gateway_settings
  SET vault_password_hash = crypt(p_new, gen_salt('bf', 12)), updated_at = now()
  WHERE id = 1;
END;
$$;