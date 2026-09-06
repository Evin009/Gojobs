-- Terms were being derived into buckets we no longer track (Fall 2027, Winter
-- 2027), and winter/spring were split when they're one intake. Existing rows
-- keep whatever they were classified as, so they need bringing into line.

-- winter and spring are the same job cycle
update jobs set term = replace(term, 'winter_2027', 'spring_2027');
update jobs set term = replace(term, 'winter_2026', 'spring_2026');

-- anything outside the three we track is no better than unknown
update jobs
set term = 'not_stated'
where term <> '' 
  and term !~ '(fall_2026|spring_2027|summer_2027)';

-- a row may now list the same term twice after the winter/spring merge
update jobs set term = 'spring_2027' where term like '%spring_2027%spring_2027%';

-- A row listing several terms keeps the untracked ones unless they're stripped
-- individually: the rule above only cleared rows that matched nothing at all.
update jobs
set term = array_to_string(
    array(
        select distinct t from unnest(string_to_array(term, ',')) as t
        where t in ('fall_2026', 'spring_2027', 'summer_2027')
        order by t
    ), ','
)
where term <> '' and term <> 'not_stated';

-- stripping every tracked term out of a row leaves it empty
update jobs set term = 'not_stated' where term = '';
