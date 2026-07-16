import { describe, expect, it } from "vitest";
import {
  encontrarConversaoConservadora,
  type ConversaoUnidadeRow,
} from "@/lib/unidades";

const rows: ConversaoUnidadeRow[] = [
  {
    id: "1",
    substancia: "Vitamina D3",
    fator_ui_para_mg: 0.000025,
    conversao_ui_mcg: 0.025,
    fonte_tecnica: "USP — 1 UI = 0,025 mcg",
    ativo: true,
  },
  {
    id: "2",
    substancia: "Vitamina B12",
    fator_ui_para_mg: 0,
    conversao_ui_mcg: null,
    fonte_tecnica: null,
    ativo: true,
  },
  {
    id: "3",
    substancia: "Vitamina A",
    fator_ui_para_mg: 0.0003,
    conversao_ui_mcg: 0.3,
    fonte_tecnica: "IN 28 — 1 UI = 0,3 mcg",
    ativo: true,
  },
];

describe("encontrarConversaoConservadora", () => {
  it("casa Vitamina D3 exatamente", () => {
    const r = encontrarConversaoConservadora("Vitamina D3", rows);
    expect(r.status).toBe("ok");
    expect(r.row?.substancia).toBe("Vitamina D3");
    expect(r.row?.conversao_ui_mcg).toBe(0.025);
  });

  it("casa por id de vitamina (D3)", () => {
    const r = encontrarConversaoConservadora("Colecalciferol D3", rows);
    expect(r.status).toBe("ok");
    expect(r.row?.substancia).toBe("Vitamina D3");
  });

  it("não casa mineral sem linha", () => {
    const r = encontrarConversaoConservadora("Zinco quelato", rows);
    expect(r.status).toBe("indisponivel");
  });
});

describe("conversão UI → mcg (matemática)", () => {
  it("2000 UI D3 = 50 mcg", () => {
    const fator = 0.025;
    expect(2000 * fator).toBe(50);
  });
});
