import { QRCodeSVG } from "qrcode.react";

interface QRCodeBlockProps {
  value: string;
  size?: number;
  label?: string;
  includeMargin?: boolean;
}

export function QRCodeBlock({ value, size = 128, label, includeMargin = true }: QRCodeBlockProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <QRCodeSVG value={value} size={size} includeMargin={includeMargin} />
      {label && (
        <span className="text-xs text-muted-foreground text-center max-w-[150px]">
          {label}
        </span>
      )}
    </div>
  );
}
