-- ============================================================================
--  Why some posts came out unbranded.
--
--  Branding is not code - it is four columns on `brands`, and the engine reads
--  them in three places:
--
--    Generate Content Image          -> brand_primary_color, brand_secondary_color,
--                                       image_branding_instructions, company_name
--    Create Creatomate Branded Image -> brand_primary_color, brand_secondary_color,
--                                       logo_url, company_name
--    Create Creatomate Branded Video -> same as above
--
--  Where a column is empty the engine has nothing to apply, so the output comes
--  back generic. This is inherited from the old spreadsheet, not from the migration.
-- ============================================================================

-- ---------- 1. see exactly what is missing ----------
select brand_id,
       company_name,
       case when brand_primary_color         = '' then 'MISSING' else brand_primary_color end   as primary_color,
       case when brand_secondary_color       = '' then 'MISSING' else brand_secondary_color end as secondary_color,
       case when logo_url                    = '' then 'MISSING' else 'set' end                 as logo,
       case when image_branding_instructions = '' then 'MISSING' else 'set' end                 as art_direction
from brands
order by brand_id;

-- Expected result today:
--   huax   full branding
--   paip   colors + art direction, logo_url points at a hawks-theme path -> verify it
--   smply  colors + art direction, no logo
--   jayco  nothing at all  <- this is why Jayco posts look generic


-- ---------- 2. fill Jayco in ----------
-- Replace the two hex values and the logo URL with Jayco's real ones before running.
-- The art direction below is written in the same shape as the other three companies:
-- it names the palette, the setting, and what the model must NOT invent.

update brands set
  brand_primary_color   = '#REPLACE',   -- e.g. '#1B4D89'
  brand_secondary_color = '#REPLACE',   -- e.g. '#F2A900'
  logo_url              = '',           -- a direct https link to a PNG, or leave empty
  image_branding_instructions =
    'Use Jayco Maintenance''s visual identity: primary #REPLACE, secondary #REPLACE, '
    'white, and neutral grey. Show realistic residential and commercial service work '
    'across the United States, with technicians in clean branded workwear and practical '
    'natural lighting. Do not invent or redraw the logo, and do not add any wordmark. '
    'Leave clean negative space in one corner for deterministic placement of the '
    'official Jayco Maintenance logo.'
where brand_id = 'jayco';


-- ---------- 3. check the Pipes & Wires logo ----------
-- Its logo_url is  https://pipeswires.com/wp-content/themes/hawks-theme/content/hawkslogo.png
-- That is the HAWKS logo file path sitting on the Pipes & Wires domain. Open it in a
-- browser: if it shows the wrong logo or 404s, Creatomate is stamping the wrong brand
-- on every Pipes & Wires render. Replace it, or clear it so no logo is applied at all:
--
--   update brands set logo_url = '' where brand_id = 'paip';


-- ---------- 4. re-check ----------
-- Re-run the query in section 1. Anything still MISSING will keep producing
-- unbranded output for that company, however many times you run the engine.
