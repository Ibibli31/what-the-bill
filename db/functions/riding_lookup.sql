-- Returns the federal and provincial ridings containing (lat, lng), each with its member and boundary as GeoJSON.
-- Returns no rows when the point is outside every Ottawa ward.
drop function if exists public.riding_lookup(double precision, double precision);
create function public.riding_lookup(lat double precision, lng double precision)
returns table (
  level text,
  code text,
  riding_name text,
  member_name text,
  member_party text,
  member_email text,
  member_photo_url text,
  boundary json
)
language sql stable as $$
  with pt as (select ST_SetSRID(ST_MakePoint(lng, lat), 4326) as geom)
  select r.level::text, r.code, r.name,
         coalesce(mp.name, mpp.name), coalesce(mp.party, mpp.party), coalesce(mp.email, mpp.email), coalesce(mp.photo_url, mpp.photo_url),
         ST_AsGeoJSON(r.boundary)::json
  from ridings r
  cross join pt
  left join mps mp on mp.riding_id = r.riding_id
  left join mpps mpp on mpp.riding_id = r.riding_id
  where exists (select 1 from wards w where ST_Contains(w.boundary, pt.geom))
    and ST_Contains(r.boundary, pt.geom);
$$;
