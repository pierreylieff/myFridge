-- The trigger function must not be callable via the public REST/RPC API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
