-- InsForge manages scheduled HTTP invocations outside application migrations.
-- The `inventory-retention` edge function and its daily schedule are deployed
-- separately so application roles never receive access to the `cron` schema.
SELECT 1;
