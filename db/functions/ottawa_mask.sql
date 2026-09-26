-- Returns the whole map extent minus the union of every ward boundary (the city limits), as GeoJSON.
-- Used to black out everything outside the City of Ottawa.
create or replace function public.ottawa_mask()
returns json
language sql stable as $$
  select ST_AsGeoJSON(
    ST_Difference(
      ST_MakeEnvelope(-180, -85, 180, 85, 4326),
      ST_SimplifyPreserveTopology(ST_Union(ST_MakeValid(w.boundary)), 0.00005)
    )
  )::json
  from wards w;
$$;
