-- Permite a cualquier usuario autenticado leer todas las predicciones.
-- Necesario para: clasificación, perfil de jugador y vista de pronósticos ajenos en el home.
-- Las políticas de INSERT/UPDATE/DELETE siguen restringidas al propio usuario.

create policy "Predicciones visibles por todos los autenticados"
  on public.predictions for select
  using (auth.role() = 'authenticated');
