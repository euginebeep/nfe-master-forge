import { describe, expect, it } from "vitest";
import {
  classificarSolubilidade,
  politicaPreMix,
  sugerirProporcao,
} from "@/lib/premix-politica";

describe("classificarSolubilidade", () => {
  it("marca lipossolúveis", () => {
    expect(classificarSolubilidade("Colecalciferol (Vitamina D3)")).toBe("LIPO");
    expect(classificarSolubilidade("Betacaroteno")).toBe("LIPO");
    expect(classificarSolubilidade("Fitomenadiona (Vitamina K1)")).toBe("LIPO");
  });

  it("marca hidrossolúveis", () => {
    expect(classificarSolubilidade("Cianocobalamina")).toBe("HIDRO");
    expect(classificarSolubilidade("Biotina")).toBe("HIDRO");
    expect(classificarSolubilidade("Cromo (picolinato)")).toBe("HIDRO");
  });
});

describe("sugerirProporcao", () => {
  it("escolhe a menor diluição pesável (≥10 mg)", () => {
    expect(sugerirProporcao(0.05).fator).toBe(1000); // D3 50 mcg
    expect(sugerirProporcao(0.00994).fator).toBe(10000); // B12
    expect(sugerirProporcao(0.045).fator).toBe(1000); // biotina
    expect(sugerirProporcao(0.25).fator).toBe(100); // cromo
    expect(sugerirProporcao(2.74).fator).toBe(10); // riboflavina
    expect(sugerirProporcao(0.21).fator).toBe(100); // melatonina
  });
});

describe("politicaPreMix", () => {
  it("D3 → LIPO 1:1000", () => {
    const r = politicaPreMix({
      nome: "Colecalciferol",
      limite_unidade: "mcg",
      limite_max_num: 50,
    });
    expect(r.exige_premix).toBe(true);
    expect(r.solubilidade).toBe("LIPO");
    expect(r.fator_diluicao_sugerido).toBe(1000);
    expect(r.precisa_antioxidante).toBe(true);
  });

  it("Cianocobalamina → HIDRO 1:10000", () => {
    const r = politicaPreMix({
      nome: "Cianocobalamina",
      limite_unidade: "mcg",
      limite_max_num: 9.94,
    });
    expect(r.exige_premix).toBe(true);
    expect(r.solubilidade).toBe("HIDRO");
    expect(r.fator_diluicao_sugerido).toBe(10000);
  });

  it("Riboflavina → 1:10", () => {
    const r = politicaPreMix({
      nome: "Riboflavina",
      limite_unidade: "mg",
      limite_max_num: 2.74,
    });
    expect(r.exige_premix).toBe(true);
    expect(r.fator_diluicao_sugerido).toBe(10);
  });

  it("magnésio alto → não exige", () => {
    const r = politicaPreMix({
      nome: "Magnésio",
      limite_unidade: "mg",
      limite_max_num: 260,
    });
    expect(r.exige_premix).toBe(false);
  });
});
