-- Fix: Tornar coluna room_name opcional (nullable)

ALTER TABLE public.ambiental_sensores 
ALTER COLUMN room_name DROP NOT NULL;
