import { describe, it, expect } from "vitest";
import { inverterCfopParaEntrada } from "./cfop-entrada";

describe("inverterCfopParaEntrada", () => {
  it("inverte saída interna 5→1", () => {
    expect(inverterCfopParaEntrada("5102")).toBe("1102");
    expect(inverterCfopParaEntrada("5101")).toBe("1101");
  });
  it("inverte saída interestadual 6→2", () => {
    expect(inverterCfopParaEntrada("6102")).toBe("2102");
  });
  it("mantém CFOP de entrada", () => {
    expect(inverterCfopParaEntrada("1102")).toBe("1102");
    expect(inverterCfopParaEntrada("2102")).toBe("2102");
  });
  it("trata null", () => {
    expect(inverterCfopParaEntrada(null)).toBeNull();
  });
});
