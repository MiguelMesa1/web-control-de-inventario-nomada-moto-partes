-- Fuente: maximos y minimos (1).xlsx, hoja Alegra.
-- Los umbrales se guardan en unidades enteras como se muestran en Excel.
-- Valores positivos menores a una unidad se normalizan a 1 para que la alerta sea accionable.

ALTER TABLE public.reorder_watchlist
  ADD COLUMN minimum_stock NUMERIC(14, 2),
  ADD COLUMN maximum_stock NUMERIC(14, 2),
  ADD COLUMN primary_supplier TEXT,
  ADD COLUMN secondary_supplier TEXT;

UPDATE public.reorder_watchlist
SET minimum_stock = COALESCE(minimum_stock, reorder_point),
    maximum_stock = COALESCE(maximum_stock, GREATEST(reorder_point * 2, reorder_point)),
    primary_supplier = COALESCE(primary_supplier, supplier);

ALTER TABLE public.reorder_watchlist
  ALTER COLUMN minimum_stock SET DEFAULT 10,
  ALTER COLUMN minimum_stock SET NOT NULL,
  ALTER COLUMN maximum_stock SET DEFAULT 20,
  ALTER COLUMN maximum_stock SET NOT NULL,
  ADD CONSTRAINT reorder_watchlist_minimum_stock_range
    CHECK (minimum_stock >= 0 AND minimum_stock <= 1000000),
  ADD CONSTRAINT reorder_watchlist_maximum_stock_range
    CHECK (maximum_stock >= minimum_stock AND maximum_stock <= 1000000),
  ADD CONSTRAINT reorder_watchlist_primary_supplier_not_blank
    CHECK (primary_supplier IS NULL OR BTRIM(primary_supplier) <> ''),
  ADD CONSTRAINT reorder_watchlist_secondary_supplier_not_blank
    CHECK (secondary_supplier IS NULL OR BTRIM(secondary_supplier) <> '');

CREATE INDEX reorder_watchlist_minimum_stock_idx
  ON public.reorder_watchlist (active, minimum_stock, product_name);

INSERT INTO public.reorder_watchlist (
  sku,
  product_name,
  minimum_stock,
  maximum_stock,
  primary_supplier,
  secondary_supplier,
  reorder_point,
  supplier,
  active
)
VALUES
  ('2220201', 'CARENAJE SIN FAROLA BAJAJ BOXER CT 100 NEGRO', 110, 221, 'REDPLAS', 'DIFEL', 110, 'REDPLAS', TRUE),
  ('2220202', 'CARENAJE SIN FAROLA BAJAJ BOXER CT 100 ROJO', 18, 36, 'REDPLAS', 'DIFEL', 18, 'REDPLAS', TRUE),
  ('2220204', 'CARENAJE SIN FAROLA BAJAJ BOXER CT 100 AZUL OSCURO', 24, 48, 'REDPLAS', 'DIFEL', 24, 'REDPLAS', TRUE),
  ('2220205', 'CARENAJE SIN FAROLA BAJAJ BOXER CT 100 BLANCO', 13, 26, 'REDPLAS', 'DIFEL', 13, 'REDPLAS', TRUE),
  ('2220206', 'CARENAJE SIN FAROLA BAJAJ BOXER CT 100 GRIS', 33, 66, 'REDPLAS', 'DIFEL', 33, 'REDPLAS', TRUE),
  ('2221611', 'CARENAJE SIN FAROLA BAJAJ PULSAR 180 UG /GT INY NEGRO', 69, 139, 'REDPLAS', 'DIFEL', 69, 'REDPLAS', TRUE),
  ('2221612', 'CARENAJE SIN FAROLA BAJAJ PULSAR 180 UG /GT INY ROJO', 9, 19, 'REDPLAS', 'DIFEL', 9, 'REDPLAS', TRUE),
  ('2221615', 'CARENAJE SIN FAROLA BAJAJ PULSAR 180 UG /GT INY BLANCO', 14, 28, 'REDPLAS', 'DIFEL', 14, 'REDPLAS', TRUE),
  ('2221616', 'CARENAJE SIN FAROLA BAJAJ PULSAR 180 UG /GT INY GRIS', 5, 9, 'REDPLAS', 'DIFEL', 5, 'REDPLAS', TRUE),
  ('2221617', 'CARENAJE SIN FAROLA BAJAJ PULSAR 180 UG /GT INY AZUL', 25, 50, 'REDPLAS', 'DIFEL', 25, 'REDPLAS', TRUE),
  ('2221618', 'CARENAJE SIN FAROLA BAJAJ PULSAR 180 UG /GT INY VERDE', 18, 35, 'REDPLAS', 'DIFEL', 18, 'REDPLAS', TRUE),
  ('2292401', 'CARENAJE SIN FAROLA YAMAHA XTZ 125 NEGRO', 84, 168, 'REDPLAS', 'TERMOPLASTICOS', 84, 'REDPLAS', TRUE),
  ('2292405', 'CARENAJE SIN FAROLA YAMAHA XTZ 125 BLANCO', 69, 138, 'REDPLAS', 'TERMOPLASTICOS', 69, 'REDPLAS', TRUE),
  ('2292407', 'CARENAJE SIN FAROLA YAMAHA XTZ 125 AZUL LAPIZ', 179, 357, 'REDPLAS', 'TERMOPLASTICOS', 179, 'REDPLAS', TRUE),
  ('2292421', 'CARENAJE BASE EXTERNO YAMAHA XTZ 150 NEGRO', 21, 41, 'SPEED HARD', NULL, 21, 'SPEED HARD', TRUE),
  ('2292423', 'CARENAJE BASE EXTERNO YAMAHA XTZ 150 ARENA', 8, 16, 'SPEED HARD', NULL, 8, 'SPEED HARD', TRUE),
  ('2292425', 'CARENAJE BASE EXTERNO YAMAHA XTZ 150 BLANCO', 14, 28, 'SPEED HARD', NULL, 14, 'SPEED HARD', TRUE),
  ('2292427', 'CARENAJE BASE EXTERNO YAMAHA XTZ 150 AZUL LAPIZ', 40, 80, 'SPEED HARD', NULL, 40, 'SPEED HARD', TRUE),
  ('2292428', 'CARENAJE BASE INTERNO YAMAHA XTZ 150 NEGRO', 77, 154, 'SPEED HARD', NULL, 77, 'SPEED HARD', TRUE),
  ('2292429', 'VISOR DE CARENAJE YAMAHA XTZ 150 NEGRO HUMO', 83, 166, 'SPEED HARD', NULL, 83, 'SPEED HARD', TRUE),
  ('2392401', 'CORTAVIENTOS YAMAHA XTZ ENDURO TS CR NEGRO', 87, 174, 'DIFEL', 'TERMOPLASTICOS', 87, 'DIFEL', TRUE),
  ('2392405', 'CORTAVIENTOS YAMAHA XTZ ENDURO TS CR BLANCO', 71, 141, 'DIFEL', 'TERMOPLASTICOS', 71, 'DIFEL', TRUE),
  ('2392407', 'CORTAVIENTOS YAMAHA XTZ ENDURO TS CR AZUL LAPIZ', 176, 352, 'DIFEL', 'TERMOPLASTICOS', 176, 'DIFEL', TRUE),
  ('2420201', 'COLA DE SILLIN BAJAJ BOXER CT 100 NEGRO', 101, 202, 'REDPLAS', 'DIFEL', 101, 'REDPLAS', TRUE),
  ('2420202', 'COLA DE SILLIN BAJAJ BOXER CT 100 ROJO', 18, 36, 'REDPLAS', 'DIFEL', 18, 'REDPLAS', TRUE),
  ('2420204', 'COLA DE SILLIN BAJAJ BOXER CT 100 AZUL', 23, 45, 'REDPLAS', 'DIFEL', 23, 'REDPLAS', TRUE),
  ('2420205', 'COLA DE SILLIN BAJAJ BOXER CT 100 BLANCO', 12, 24, 'REDPLAS', 'DIFEL', 12, 'REDPLAS', TRUE),
  ('2420206', 'COLA DE SILLIN BAJAJ BOXER CT 100 GRIS', 27, 54, 'REDPLAS', 'DIFEL', 27, 'REDPLAS', TRUE),
  ('2421501', 'COLA DE SILLIN BAJAJ PULSAR NS-200 NEGRO', 27, 55, 'REDPLAS', 'DIFEL', 27, 'REDPLAS', TRUE),
  ('2421502', 'COLA DE SILLIN BAJAJ PULSAR NS-200 ROJO PLENO', 2, 5, 'ORIGINAL', NULL, 2, 'ORIGINAL', TRUE),
  ('2421503', 'COLA DE SILLIN BAJAJ PULSAR NS-200 ROJO CHERRY', 3, 6, 'ORIGINAL', NULL, 3, 'ORIGINAL', TRUE),
  ('2421505', 'COLA DE SILLIN BAJAJ PULSAR NS-200 BLANCO', 2, 4, 'ORIGINAL', NULL, 2, 'ORIGINAL', TRUE),
  ('2421506', 'COLA DE SILLIN BAJAJ PULSAR NS-200 GRIS', 1, 1, 'ORIGINAL', NULL, 1, 'ORIGINAL', TRUE),
  ('2421507', 'COLA DE SILLIN BAJAJ PULSAR NS-200 AZUL', 3, 5, 'ORIGINAL', NULL, 3, 'ORIGINAL', TRUE),
  ('2421511', 'COLA DE SILLIN BAJAJ PULSAR 180 II UG/GT NEGRO', 83, 167, 'REDPLAS', 'DIFEL', 83, 'REDPLAS', TRUE),
  ('2421515', 'COLA DE SILLIN BAJAJ PULSAR 180 II UG/GT BLANCO', 11, 21, 'REDPLAS', 'DIFEL', 11, 'REDPLAS', TRUE),
  ('2421516', 'COLA DE SILLIN BAJAJ PULSAR 180 II UG/GT GRIS', 5, 10, 'REDPLAS', 'DIFEL', 5, 'REDPLAS', TRUE),
  ('2421517', 'COLA DE SILLIN BAJAJ PULSAR 180 II UG/GT AZUL', 26, 51, 'REDPLAS', 'DIFEL', 26, 'REDPLAS', TRUE),
  ('2421518', 'COLA DE SILLIN BAJAJ PULSAR 180 II UG/GT VERDE', 18, 36, 'REDPLAS', 'DIFEL', 18, 'REDPLAS', TRUE),
  ('2421521', 'COLA DE SILLIN BAJAJ PULSAR 180 I M.VIEJO NEGRO', 6, 11, 'ORIGINAL', NULL, 6, 'ORIGINAL', TRUE),
  ('2421611', 'TAPA DE TANQUE ALETA BAJAJ PULSAR 180 II GT NEGRO', 62, 124, 'KALCOS', 'TERMOPLASTICOS', 62, 'KALCOS', TRUE),
  ('2421621', 'TAPA DE TANQUE BAJAJ PULSAR 220 GT NEGRO', 14, 28, 'SPEED HARD', NULL, 14, 'SPEED HARD', TRUE),
  ('2521611', 'GUARDABARRO DELANTERO BAJAJ PULSAR 180 UG NEGRO', 64, 128, 'REDPLAS', 'TERMOPLASTICOS', 64, 'REDPLAS', TRUE),
  ('2521612', 'GUARDABARRO DELANTERO BAJAJ PULSAR 180 UG ROJO', 8, 16, 'SPEED HARD', 'DIFEL', 8, 'SPEED HARD', TRUE),
  ('2521615', 'GUARDABARRO DELANTERO BAJAJ PULSAR 180 UG BLANCO', 14, 29, 'REDPLAS', 'DIFEL', 14, 'REDPLAS', TRUE),
  ('2521616', 'GUARDABARRO DELANTERO BAJAJ PULSAR 180 UG GRIS', 4, 9, 'ORIGINAL', 'DIFEL', 4, 'ORIGINAL', TRUE),
  ('2521617', 'GUARDABARRO DELANTERO BAJAJ PULSAR 180 UG AZUL PERLADO', 25, 51, 'REDPLAS', 'DIFEL', 25, 'REDPLAS', TRUE),
  ('2521618', 'GUARDABARRO DELANTERO BAJAJ PULSAR 180 UG VERDE', 18, 36, 'REDPLAS', 'DIFEL', 18, 'REDPLAS', TRUE),
  ('2521620', 'GUARDABARRO DELANTERO BAJAJ PULSAR NS 160 NEGRO CARBONO', 4, 8, 'SPEED HARD', NULL, 4, 'SPEED HARD', TRUE),
  ('2521621', 'GUARDABARRO DELANTERO BAJAJ PULSAR NS 200 NEGRO CARBONO', 24, 48, 'REDPLAS', NULL, 24, 'REDPLAS', TRUE),
  ('2521631', 'GUARDABARRO DELANTERO BAJAJ PULSAR-BOXER CT 100 PLATINO NEGRO', 105, 211, 'REDPLAS', 'TERMOPLASTICOS', 105, 'REDPLAS', TRUE),
  ('2521632', 'GUARDABARRO DELANTERO BAJAJ PULSAR-BOXER CT 100 PLATINO ROJO', 17, 34, 'REDPLAS', 'TERMOPLASTICOS', 17, 'REDPLAS', TRUE),
  ('2521635', 'GUARDABARRO DELANTERO BAJAJ PULSAR-BOXER CT 100 PLATINO BLANCO', 12, 25, 'REDPLAS', 'TERMOPLASTICOS', 12, 'REDPLAS', TRUE),
  ('2521636', 'GUARDABARRO DELANTERO BAJAJ PULSAR-BOXER CT 100 PLATINO GRIS', 30, 59, 'REDPLAS', 'TERMOPLASTICOS', 30, 'REDPLAS', TRUE),
  ('2521637', 'GUARDABARRO DELANTERO BAJAJ PULSAR-BOXER CT 100 PLATINO AZUL OSCURO', 24, 47, 'REDPLAS', 'DIFEL', 24, 'REDPLAS', TRUE),
  ('2592411', 'GUARDABARRO DELANTERO YAMAHA XTZ 125 NEGRO', 90, 180, 'REDPLAS', 'TERMOPLASTICOS', 90, 'REDPLAS', TRUE),
  ('2592415', 'GUARDABARRO DELANTERO YAMAHA XTZ 125 BLANCO', 62, 124, 'REDPLAS', 'TERMOPLASTICOS', 62, 'REDPLAS', TRUE),
  ('2592417', 'GUARDABARRO DELANTERO YAMAHA XTZ 125 AZUL LAPIZ', 180, 360, 'REDPLAS', 'TERMOPLASTICOS', 180, 'REDPLAS', TRUE),
  ('2592421', 'GUARDABARRO DELANTERO YAMAHA XTZ 150 NEGRO', 40, 79, 'KALCOS', NULL, 40, 'KALCOS', TRUE),
  ('2592423', 'GUARDABARRO DELANTERO YAMAHA XTZ 150 ARENA', 7, 14, 'SPEED HARD', NULL, 7, 'SPEED HARD', TRUE),
  ('2592425', 'GUARDABARRO DELANTERO YAMAHA XTZ 150 BLANCO', 7, 15, 'KALCOS', NULL, 7, 'KALCOS', TRUE),
  ('2592427', 'GUARDABARRO DELANTERO YAMAHA XTZ 150 AZUL', 27, 55, 'KALCOS', NULL, 27, 'KALCOS', TRUE),
  ('2592441', 'GUARDABARRO KIT SUPERLANDER UNIVERSAL ENDURO (GBA Y PROTECTOR H) NEGRO', 56, 112, 'SPEED HARD', NULL, 56, 'SPEED HARD', TRUE),
  ('2592442', 'GUARDABARRO KIT SUPERLANDER UNIVERSAL ENDURO (GBA Y PROTECTOR H) ROJO', 17, 34, 'SPEED HARD', NULL, 17, 'SPEED HARD', TRUE),
  ('2592445', 'GUARDABARRO KIT SUPERLANDER UNIVERSAL ENDURO (GBA Y PROTECTOR H) BLANCO', 21, 41, 'SPEED HARD', NULL, 21, 'SPEED HARD', TRUE),
  ('2592447', 'GUARDABARRO KIT SUPERLANDER UNIVERSAL ENDURO (GBA Y PROTECTOR H) AZUL LAPIZ', 11, 22, 'SPEED HARD', NULL, 11, 'SPEED HARD', TRUE),
  ('2620201', 'GUARDABARRO TRASERO PORTA PLACA BAJAJ BOXER CT 100 NEGRO', 35, 69, 'REDPLAS', 'DIFEL', 35, 'REDPLAS', TRUE),
  ('2621621', 'GUARDABARRO TRASERO PORTA PLACA BAJAJ PULSAR 180 NEGRO', 24, 49, 'SPEED HARD', NULL, 24, 'SPEED HARD', TRUE),
  ('2692401', 'GUARDABARRO TRASERO YAMAHA XTZ 125 NEGRO', 85, 169, 'REDPLAS', 'TERMOPLASTICOS', 85, 'REDPLAS', TRUE),
  ('2692405', 'GUARDABARRO TRASERO YAMAHA XTZ 125 BLANCO', 69, 139, 'REDPLAS', 'TERMOPLASTICOS', 69, 'REDPLAS', TRUE),
  ('2692407', 'GUARDABARRO TRASERO YAMAHA XTZ 125 AZUL LAPIZ', 179, 359, 'REDPLAS', 'TERMOPLASTICOS', 179, 'REDPLAS', TRUE),
  ('2692411', 'GUARDABARRO TRASERO YAMAHA XTZ 125 PORTA PLACA NEGRO', 72, 144, 'REDPLAS', 'TERMOPLASTICOS', 72, 'REDPLAS', TRUE),
  ('2692429', 'GUARDABARRO TRASERO YAMAHA XTZ 150 PORTA PLACA NEGRO', 2, 4, 'SPEED HARD', NULL, 2, 'SPEED HARD', TRUE),
  ('2720201', 'TAPAS LATERALES BAJAJ BOXER CT 100 NEGRO', 102, 204, 'REDPLAS', 'TERMOPLASTICOS', 102, 'REDPLAS', TRUE),
  ('2720202', 'TAPAS LATERALES BAJAJ BOXER CT 100 ROJO', 17, 35, 'REDPLAS', 'DIFEL', 17, 'REDPLAS', TRUE),
  ('2720204', 'TAPAS LATERALES BAJAJ BOXER CT 100 AZUL OSCURO', 22, 44, 'REDPLAS', 'DIFEL', 22, 'REDPLAS', TRUE),
  ('2720205', 'TAPAS LATERALES BAJAJ BOXER CT 100 BLANCO', 12, 25, 'REDPLAS', 'DIFEL', 12, 'REDPLAS', TRUE),
  ('2720206', 'TAPAS LATERALES BAJAJ BOXER CT 100 GRIS', 27, 55, 'REDPLAS', 'DIFEL', 27, 'REDPLAS', TRUE),
  ('2721601', 'TAPAS LATERALES BAJAJ PULSAR 180-200-220 NEGRO', 103, 207, 'DIFEL', 'TERMOPLASTICOS', 103, 'DIFEL', TRUE),
  ('2721611', 'TAPAS LATERALES BAJAJ PULSAR 200 NS NEGRO', 30, 60, 'ORIGINAL', NULL, 30, 'ORIGINAL', TRUE),
  ('2721621', 'TAPAS LATERALES BAJAJ PULSAR 180 I M.VIEJO NEGRO', 6, 12, 'ORIGINAL', NULL, 6, 'ORIGINAL', TRUE),
  ('2792401', 'TAPAS LATERALES YAMAHA XTZ 125 NEGRO', 105, 210, 'REDPLAS', 'TERMOPLASTICOS', 105, 'REDPLAS', TRUE),
  ('2792405', 'TAPAS LATERALES YAMAHA XTZ 125 BLANCO', 101, 201, 'REDPLAS', 'TERMOPLASTICOS', 101, 'REDPLAS', TRUE),
  ('2792407', 'TAPAS LATERALES YAMAHA XTZ 125 AZUL LAPIZ', 131, 261, 'REDPLAS', 'TERMOPLASTICOS', 131, 'REDPLAS', TRUE),
  ('2792411', 'TAPA TANQUE YAMAHA XTZ 125 NEGRO', 85, 171, 'REDPLAS', 'TERMOPLASTICOS', 85, 'REDPLAS', TRUE),
  ('2792415', 'TAPA TANQUE YAMAHA XTZ 125 BLANCO', 69, 138, 'REDPLAS', 'TERMOPLASTICOS', 69, 'REDPLAS', TRUE),
  ('2792417', 'TAPA TANQUE YAMAHA XTZ 125 AZUL LAPIZ', 179, 359, 'REDPLAS', 'TERMOPLASTICOS', 179, 'REDPLAS', TRUE),
  ('2792431', 'TAPAS LATERALES YAMAHA XTZ 150 (IMTAL261)', 11, 22, 'OKLA', NULL, 11, 'OKLA', TRUE),
  ('2792441', 'TAPA TANQUE YAMAHA XTZ 150 NEGRO', 20, 41, 'SPEED HARD', NULL, 20, 'SPEED HARD', TRUE),
  ('2792443', 'TAPA TANQUE YAMAHA XTZ 150 ARENA', 8, 15, 'SPEED HARD', NULL, 8, 'SPEED HARD', TRUE),
  ('2792445', 'TAPA TANQUE YAMAHA XTZ 150 BLANCO', 15, 30, 'SPEED HARD', NULL, 15, 'SPEED HARD', TRUE),
  ('2792447', 'TAPA TANQUE YAMAHA XTZ 150 AZUL LAPIZ', 43, 87, 'SPEED HARD', NULL, 43, 'SPEED HARD', TRUE),
  ('2821601', 'MONJA CUBIERTA DE VELOCIMETRO BAJAJ PULSAR 180 UG /GT (Fibra Carbono) Negro', 17, 34, 'KALCOS', 'TERMOPLASTICOS', 17, 'KALCOS', TRUE),
  ('2821611', 'MONJA CUBIERTA DE VELOCIMETRO BAJAJ PULSAR 200 NS NEGRO', 1, 1, 'DIFEL', NULL, 1, 'DIFEL', TRUE),
  ('2892401', 'PROTECTOR BARRA TIPO H NEGRO', 7, 15, 'KALCOS', 'DIFEL', 7, 'KALCOS', TRUE),
  ('2892411', 'PROTECTOR BARRA TIPO H CON ACERO YAMAHA NEGRO', 2, 4, 'KALCOS', NULL, 2, 'KALCOS', TRUE),
  ('2921605', 'VISOR DE CARENAJE BAJAJ PULSAR 200 NS NEGRO HUMO (IMVIS20)', 23, 46, 'REDPLAS', NULL, 23, 'REDPLAS', TRUE),
  ('2990631', 'TAPA LATERAL DE EXOSTO YAMAHA XTZ 150 NEGRO', 2, 3, 'SPEED HARD', NULL, 2, 'SPEED HARD', TRUE),
  ('3221621', 'CARENAJE CON FAROLA BAJAJ PULSAR 200 NS NEGRO', 5, 9, 'REDPLAS', NULL, 5, 'REDPLAS', TRUE),
  ('3221631', 'CARENAJE CON TAPAS LATERALES BAJAJ PULSAR 200 NS NEGRO', 23, 45, 'REDPLAS', NULL, 23, 'REDPLAS', TRUE),
  ('3421612', 'COLA DE SILLIN BAJAJ PULSAR 180 II UG/GT ROJO', 8, 16, 'ORIGINAL', NULL, 8, 'ORIGINAL', TRUE),
  ('3421632', 'TAPA DE TANQUE BAJAJ PULSAR 180 II GT PINT ROJO', 9, 18, 'KALCOS', 'ORIGINAL', 9, 'KALCOS', TRUE),
  ('3421635', 'TAPA DE TANQUE BAJAJ PULSAR 180 II GT PINT BLANCO', 13, 25, 'KALCOS', 'ORIGINAL', 13, 'KALCOS', TRUE),
  ('3421636', 'TAPA DE TANQUE BAJAJ PULSAR 180 II GT PINT GRIS', 4, 8, 'KALCOS', 'ORIGINAL', 4, 'KALCOS', TRUE),
  ('3421637', 'TAPA DE TANQUE BAJAJ PULSAR 180 II GT PINT AZUL PERLA', 24, 47, 'KALCOS', 'ORIGINAL', 24, 'KALCOS', TRUE),
  ('3421638', 'TAPA DE TANQUE BAJAJ PULSAR 180 II GT PINT VERDE ESMERALDA', 16, 31, 'KALCOS', 'ORIGINAL', 16, 'KALCOS', TRUE),
  ('3421656', 'TAPA DE TANQUE BAJAJ PULSAR NS-200/160 PINT NEGRO', 20, 41, 'SPEED HARD', NULL, 20, 'SPEED HARD', TRUE),
  ('3421657', 'TAPA DE TANQUE BAJAJ PULSAR NS-200/160 PINT ROJO', 3, 6, 'SPEED HARD', NULL, 3, 'SPEED HARD', TRUE),
  ('3421658', 'TAPA DE TANQUE BAJAJ PULSAR NS-200/160 PINT ROJO CHERRY', 4, 7, 'SPEED HARD', NULL, 4, 'SPEED HARD', TRUE),
  ('3421659', 'TAPA DE TANQUE BAJAJ PULSAR NS-200/160 PINT BLANCO', 3, 5, 'SPEED HARD', NULL, 3, 'SPEED HARD', TRUE),
  ('3421660', 'TAPA DE TANQUE BAJAJ PULSAR NS-200/160 PINT AZUL', 3, 6, 'SPEED HARD', NULL, 3, 'SPEED HARD', TRUE),
  ('3721617', 'TAPAS LATERALES BAJAJ PULSAR 180 200 UG PINT AZUL', 21, 42, 'TERMOPLASTICOS', 'ORIGINAL', 21, 'TERMOPLASTICOS', TRUE),
  ('3721618', 'TAPAS LATERALES BAJAJ PULSAR 180 200 UG PINT VERDE', 17, 34, 'TERMOPLASTICOS', 'ORIGINAL', 17, 'TERMOPLASTICOS', TRUE),
  ('5980803', 'CALCOMANIAS BAJAJ PULSAR 180 COPA', 1, 1, 'LUJOS Y CALCOMANIAS', NULL, 1, 'LUJOS Y CALCOMANIAS', TRUE),
  ('5980804', 'CALCOMANIAS BAJAJ PULSAR 220', 16, 31, 'LUJOS Y CALCOMANIAS', NULL, 16, 'LUJOS Y CALCOMANIAS', TRUE),
  ('5980806', 'CALCOMANIAS BAJAJ PULSAR NS 160', 3, 6, 'LUJOS Y CALCOMANIAS', NULL, 3, 'LUJOS Y CALCOMANIAS', TRUE),
  ('5980807', 'CALCOMANIAS BAJAJ PULSAR NS 200', 23, 45, 'LUJOS Y CALCOMANIAS', NULL, 23, 'LUJOS Y CALCOMANIAS', TRUE),
  ('5980808', 'CALCOMANIAS BAJAJ BOXER CT-100 AÑO 2023', 10, 20, 'LUJOS Y CALCOMANIAS', NULL, 10, 'LUJOS Y CALCOMANIAS', TRUE),
  ('5980809', 'CALCOMANIAS EMBLEMA CROMADO BAJAJ BOXER CT -100', 2, 3, 'LUJOS Y CALCOMANIAS', NULL, 2, 'LUJOS Y CALCOMANIAS', TRUE),
  ('5980810', 'CALCOMANIA TORNASOL BAJAJ BOXER CT-100 SURTIDOS', 1, 1, 'LUJOS Y CALCOMANIAS', NULL, 1, 'LUJOS Y CALCOMANIAS', TRUE),
  ('5980815', 'CALCOMANIA TORNASOL YAMAHA XTZ 125 SURTIDOS', 1, 3, 'LUJOS Y CALCOMANIAS', NULL, 1, 'LUJOS Y CALCOMANIAS', TRUE),
  ('5980903', 'CALCOMANIAS BAJAJ BOXER CT-100 COLORES SURTIDOS', 170, 339, 'LUJOS Y CALCOMANIAS', NULL, 170, 'LUJOS Y CALCOMANIAS', TRUE),
  ('5980904', 'CALCOMANIAS BAJAJ PULSAR GT COLORES SURTIDOS', 120, 240, 'LUJOS Y CALCOMANIAS', NULL, 120, 'LUJOS Y CALCOMANIAS', TRUE),
  ('5980907', 'CALCOMANIAS YAMAHA XTZ 125 COLORES SURTIDOS', 419, 839, 'LUJOS Y CALCOMANIAS', NULL, 419, 'LUJOS Y CALCOMANIAS', TRUE),
  ('5980908', 'CALCOMANIAS ENBLEMA PULSAR NS / 180', 4, 9, 'LUJOS Y CALCOMANIAS', NULL, 4, 'LUJOS Y CALCOMANIAS', TRUE),
  ('4620201', 'FAROLA BAJAJ BOXER CT 100', 31, 63, 'OKLA', 'REDPLAS', 31, 'OKLA', TRUE),
  ('4621603', 'FAROLA BAJAJ PULSAR UG 160/180/200/220', 20, 41, 'OKLA', 'REDPLAS', 20, 'OKLA', TRUE),
  ('4692401', 'FAROLA YAMAHA XTZ 125', 24, 48, 'OKLA', 'REDPLAS', 24, 'OKLA', TRUE)
ON CONFLICT (sku) DO UPDATE
SET product_name = EXCLUDED.product_name,
    minimum_stock = EXCLUDED.minimum_stock,
    maximum_stock = EXCLUDED.maximum_stock,
    primary_supplier = EXCLUDED.primary_supplier,
    secondary_supplier = EXCLUDED.secondary_supplier,
    reorder_point = EXCLUDED.reorder_point,
    supplier = EXCLUDED.supplier,
    active = TRUE,
    updated_at = NOW();

CREATE OR REPLACE FUNCTION public.audit_reorder_watchlist_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  affected public.reorder_watchlist;
BEGIN
  affected := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  INSERT INTO public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    details
  )
  VALUES (
    auth.uid(),
    CASE TG_OP
      WHEN 'INSERT' THEN 'replenishment_product_added'
      WHEN 'UPDATE' THEN 'replenishment_product_updated'
      ELSE 'replenishment_product_removed'
    END,
    'reorder_watchlist',
    affected.id::TEXT,
    JSONB_BUILD_OBJECT(
      'sku', affected.sku,
      'product_name', affected.product_name,
      'minimum_stock', affected.minimum_stock,
      'maximum_stock', affected.maximum_stock,
      'primary_supplier', affected.primary_supplier,
      'secondary_supplier', affected.secondary_supplier
    )
  );

  RETURN affected;
END;
$function$;

REVOKE UPDATE ON public.reorder_watchlist FROM authenticated;
GRANT UPDATE (
  source_id,
  product_name,
  supplier,
  reorder_point,
  minimum_stock,
  maximum_stock,
  primary_supplier,
  secondary_supplier,
  active,
  notes,
  updated_by
) ON public.reorder_watchlist TO authenticated;

CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_orders_number_not_blank CHECK (BTRIM(order_number) <> ''),
  CONSTRAINT purchase_orders_supplier_not_blank CHECK (BTRIM(supplier_name) <> '')
);

CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  available_at_creation NUMERIC(14, 2) NOT NULL,
  minimum_stock NUMERIC(14, 2) NOT NULL,
  maximum_stock NUMERIC(14, 2) NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_order_items_sku_not_blank CHECK (BTRIM(sku) <> ''),
  CONSTRAINT purchase_order_items_name_not_blank CHECK (BTRIM(product_name) <> ''),
  CONSTRAINT purchase_order_items_thresholds_valid
    CHECK (minimum_stock >= 0 AND maximum_stock >= minimum_stock),
  UNIQUE (order_id, sku)
);

CREATE INDEX purchase_orders_status_created_idx
  ON public.purchase_orders (status, created_at DESC);
CREATE INDEX purchase_orders_supplier_idx
  ON public.purchase_orders (supplier_name, created_at DESC);
CREATE INDEX purchase_order_items_order_idx
  ON public.purchase_order_items (order_id);
CREATE INDEX purchase_order_items_sku_idx
  ON public.purchase_order_items (sku);

CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE OR REPLACE FUNCTION public.validate_purchase_order_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'draft' AND NEW.status IN ('ordered', 'cancelled'))
    OR (OLD.status = 'ordered' AND NEW.status IN ('received', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid purchase order status transition';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER purchase_orders_validate_transition
  BEFORE UPDATE OF status ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_purchase_order_transition();

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchase_orders_select ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (public.can_read_inventory());

CREATE POLICY purchase_orders_update ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (public.can_upload_inventory())
  WITH CHECK (
    public.can_upload_inventory()
    AND updated_by = (SELECT auth.uid())
  );

CREATE POLICY purchase_order_items_select ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (public.can_read_inventory());

REVOKE ALL ON public.purchase_orders FROM anon, authenticated;
REVOKE ALL ON public.purchase_order_items FROM anon, authenticated;
GRANT SELECT ON public.purchase_orders TO authenticated;
GRANT UPDATE (supplier_name, status, notes, updated_by)
  ON public.purchase_orders TO authenticated;
GRANT SELECT ON public.purchase_order_items TO authenticated;

CREATE OR REPLACE FUNCTION public.create_purchase_orders(p_orders JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  actor_id UUID := auth.uid();
  order_payload JSONB;
  item_payload JSONB;
  new_order_id UUID;
  new_order_number TEXT;
  created_orders JSONB := '[]'::JSONB;
  item_count INTEGER;
BEGIN
  IF actor_id IS NULL OR NOT public.can_upload_inventory() THEN
    RAISE EXCEPTION 'Uploader permission required';
  END IF;

  IF p_orders IS NULL
    OR JSONB_TYPEOF(p_orders) <> 'array'
    OR JSONB_ARRAY_LENGTH(p_orders) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'One to twenty supplier orders are required';
  END IF;

  FOR order_payload IN SELECT value FROM JSONB_ARRAY_ELEMENTS(p_orders)
  LOOP
    IF NULLIF(BTRIM(order_payload->>'supplierName'), '') IS NULL
      OR JSONB_TYPEOF(order_payload->'items') <> 'array'
      OR JSONB_ARRAY_LENGTH(order_payload->'items') = 0 THEN
      RAISE EXCEPTION 'Each order needs a supplier and at least one item';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM JSONB_ARRAY_ELEMENTS(order_payload->'items') AS items(item)
      WHERE NULLIF(BTRIM(item->>'sku'), '') IS NULL
        OR NULLIF(BTRIM(item->>'productName'), '') IS NULL
        OR COALESCE((item->>'quantity')::INTEGER, 0) NOT BETWEEN 1 AND 1000000
        OR COALESCE((item->>'minimumStock')::NUMERIC, -1) < 0
        OR COALESCE((item->>'maximumStock')::NUMERIC, -1)
          < COALESCE((item->>'minimumStock')::NUMERIC, 0)
    ) THEN
      RAISE EXCEPTION 'Every order item needs valid product and quantity data';
    END IF;

    SELECT COUNT(DISTINCT item->>'sku')
    INTO item_count
    FROM JSONB_ARRAY_ELEMENTS(order_payload->'items') AS items(item);

    IF item_count <> JSONB_ARRAY_LENGTH(order_payload->'items') THEN
      RAISE EXCEPTION 'The same SKU cannot be repeated in one supplier order';
    END IF;

    new_order_id := gen_random_uuid();
    new_order_number := 'PED-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
      UPPER(SUBSTRING(REPLACE(new_order_id::TEXT, '-', '') FROM 1 FOR 6));

    INSERT INTO public.purchase_orders (
      id,
      order_number,
      supplier_name,
      status,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      new_order_id,
      new_order_number,
      BTRIM(order_payload->>'supplierName'),
      'draft',
      NULLIF(BTRIM(order_payload->>'notes'), ''),
      actor_id,
      actor_id
    );

    FOR item_payload IN
      SELECT value FROM JSONB_ARRAY_ELEMENTS(order_payload->'items')
    LOOP
      INSERT INTO public.purchase_order_items (
        order_id,
        sku,
        product_name,
        quantity,
        available_at_creation,
        minimum_stock,
        maximum_stock,
        created_by
      )
      VALUES (
        new_order_id,
        BTRIM(item_payload->>'sku'),
        BTRIM(item_payload->>'productName'),
        (item_payload->>'quantity')::INTEGER,
        COALESCE((item_payload->>'available')::NUMERIC, 0),
        (item_payload->>'minimumStock')::NUMERIC,
        (item_payload->>'maximumStock')::NUMERIC,
        actor_id
      );
    END LOOP;

    INSERT INTO public.audit_events (
      actor_id,
      action,
      entity_type,
      entity_id,
      details
    )
    VALUES (
      actor_id,
      'purchase_order_created',
      'purchase_order',
      new_order_id::TEXT,
      JSONB_BUILD_OBJECT(
        'order_number', new_order_number,
        'supplier', BTRIM(order_payload->>'supplierName'),
        'items', item_count
      )
    );

    created_orders := created_orders || JSONB_BUILD_ARRAY(
      JSONB_BUILD_OBJECT(
        'id', new_order_id,
        'orderNumber', new_order_number,
        'supplierName', BTRIM(order_payload->>'supplierName'),
        'itemCount', item_count
      )
    );
  END LOOP;

  RETURN created_orders;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_purchase_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_events (
      actor_id,
      action,
      entity_type,
      entity_id,
      details
    )
    VALUES (
      auth.uid(),
      'purchase_order_status_changed',
      'purchase_order',
      NEW.id::TEXT,
      JSONB_BUILD_OBJECT(
        'order_number', NEW.order_number,
        'from', OLD.status,
        'to', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER purchase_orders_audit_status
  AFTER UPDATE OF status ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_purchase_order_status_change();

REVOKE EXECUTE ON FUNCTION public.create_purchase_orders(JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_purchase_orders(JSONB)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.validate_purchase_order_transition()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_purchase_order_status_change()
  FROM PUBLIC, anon, authenticated;
