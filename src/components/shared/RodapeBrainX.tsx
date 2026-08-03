import type { CSSProperties, ReactNode } from "react";
import { APP_VERSION } from "@/lib/app-version";

export type RodapeBrainXProps = {
  /** Defaults to APP_VERSION from package.json via Vite define */
  versao?: string;
  /** Sufixo após a assinatura, ex.: "Lote XYZ · OP-001" */
  extra?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** Assinatura única do BrainX em documentos impressos / PDF. */
export function RodapeBrainX({
  versao = APP_VERSION,
  extra,
  className,
  style,
}: RodapeBrainXProps) {
  return (
    <span className={className} style={style}>
      BrainX ERP · Gestão Industrial · www.brainxerp.com · v{versao}
      {extra != null && extra !== "" ? <> · {extra}</> : null}
    </span>
  );
}
