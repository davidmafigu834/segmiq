import { Download } from "lucide-react";

type ProjectPdfDownloadButtonProps = {
  pdfDownloadUrl: string;
  pdfDirectUrl: string | null;
  fileName: string;
  className?: string;
};

export function ProjectPdfDownloadButton({
  pdfDownloadUrl,
  fileName,
  className,
}: ProjectPdfDownloadButtonProps) {
  return (
    <a href={pdfDownloadUrl} download={fileName} className={className}>
      <Download size={13} aria-hidden />
      Download PDF
    </a>
  );
}
