/**
 * Espelho da matemática de converter_para_unidade (SQL).
 * Prova do Furo 6: D3 60 μg vs limite 50 μg deve EXCEDER quando ambos em mg.
 */

import { describe, expect, it } from "vitest";

function converterParaUnidade(
  valor: number,
  de: string,
  para: string,
): number | null {
  const norm = (u: string) => {
    let x = u
      .toLowerCase()
      .trim()
      .replace(/µ/g, "u")
      .replace(/μ/g, "u");
    if (x === "ug" || x === "mcg" || /^u.?g$/.test(x)) x = "mcg";
    return x;
  };
  const d = norm(de);
  const p = norm(para);
  if (!["mg", "mcg", "g"].includes(d) || !["mg", "mcg", "g"].includes(p)) {
    return null;
  }
  let mg = d === "mg" ? valor : d === "mcg" ? valor / 1000 : valor * 1000;
  if (p === "mg") return mg;
  if (p === "mcg") return mg * 1000;
  return mg / 1000;
}

describe("converter_para_unidade (Furo 6)", () => {
  it("60 μg → 0,06 mg; limite 50 μg → 0,05 mg → EXCEDE", () => {
    const doseMg = converterParaUnidade(60, "mcg", "mg")!;
    const limMg = converterParaUnidade(50, "mcg", "mg")!;
    expect(doseMg).toBeCloseTo(0.06, 10);
    expect(limMg).toBeCloseTo(0.05, 10);
    expect(doseMg > limMg).toBe(true); // sem conversão: 60 > 50 também, mas 0.06 > 50 seria falso
  });

  it("sem conversão mg vs mcg (bug antigo): 0,06 mg > 50 mcg → falso negativo", () => {
    // Bug: comparar dose já em mg contra limite_max_num em mcg
    expect(0.06 > 50).toBe(false); // passaria errado
    expect(converterParaUnidade(60, "mcg", "mg")! > converterParaUnidade(50, "mcg", "mg")!).toBe(
      true,
    );
  });

  it("grupo 4-8: 45 μg > 37,5 μg → EXCEDE; adulto 45 < 50 → ok", () => {
    const dose = converterParaUnidade(45, "mcg", "mg")!;
    const limCrianca = converterParaUnidade(37.5, "mcg", "mg")!;
    const limAdulto = converterParaUnidade(50, "mcg", "mg")!;
    expect(dose > limCrianca).toBe(true);
    expect(dose > limAdulto).toBe(false);
  });

  it("unidade desconhecida → null (SEM_UNIDADE_LIMITE)", () => {
    expect(converterParaUnidade(10, "UI", "mg")).toBeNull();
    expect(converterParaUnidade(10, "", "mg")).toBeNull();
  });
});
