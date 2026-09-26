-- Returns the ward containing (lat, lng), its councillor, and its boundary as GeoJSON.
-- Returns no rows when the point is outside every ward.
create or replace function public.ward_lookup(lat double precision, lng double precision)
returns table (
  ward_number int,
  ward_name text,
  councillor_name text,
  councillor_email text,
  councillor_phone text,
  boundary json
)
language sql stable as $$
  select w.ward_number, w.ward_name, c.name, c.email, c.phone,
         ST_AsGeoJSON(w.boundary)::json
  from wards w
  left join councillors c on c.ward_id = w.ward_id and not c.is_mayor
  where ST_Contains(w.boundary, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
  limit 1;
$$;
