import { z } from "zod";

export const AnvisaConstituinteSchema = z.object({
  id: z.string(),
  constituinte: z.string(),
  status: z.enum(["AUTORIZADO", "NAO_AUTORIZADO"]),
  limite: z.string().optional(),
  referencia: z.string().optional(),
});

export type AnvisaConstituinte = z.infer<typeof AnvisaConstituinteSchema>;

// Mock data based on IN 28/2018
export const ANVISA_LIMITS: AnvisaConstituinte[] = [
  { id: "1", constituinte: "Vitamina D3", status: "AUTORIZADO", limite: "2.000 UI (50 mcg)", referencia: "IN 28 Anexo IV" },
  { id: "2", constituinte: "Zinco", status: "AUTORIZADO", limite: "25 mg", referencia: "IN 28 Anexo IV" },
  { id: "3", constituinte: "Boro", status: "AUTORIZADO", limite: "6 mg", referencia: "IN 28 Anexo IV" },
  { id: "4", constituinte: "Niacina (B3)", status: "AUTORIZADO", limite: "35 mg NE", referencia: "IN 28 Anexo IV" },
  { id: "5", constituinte: "Berberina", status: "NAO_AUTORIZADO", referencia: "Não consta no Anexo I" },
  { id: "6", constituinte: "Queratina", status: "NAO_AUTORIZADO", referencia: "Não consta no Anexo I" },
  { id: "7", constituinte: "Silício Orgânico", status: "NAO_AUTORIZADO", referencia: "Não consta no Anexo I" },
  { id: "8", constituinte: "L-Tirosina", status: "AUTORIZADO", referencia: "Anexo I IN 28 (CAS 60-18-4)" },
];
