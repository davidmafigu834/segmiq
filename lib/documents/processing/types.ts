export type ExtractedPage = {
  pageNumber: number;
  text: string;
};

export type ExtractedTable = {
  id: string;
  label: string;
  pageNumber?: number;
  rows: string[][];
};

export type ExtractionResult = {
  plainText: string;
  pages: ExtractedPage[];
  tables: ExtractedTable[];
  passwordProtected?: boolean;
  likelyScanned?: boolean;
  skipped?: boolean;
  skipReason?: string;
};

export type ExtractionErrorCode =
  | "PASSWORD_PROTECTED"
  | "UNSUPPORTED"
  | "CORRUPT"
  | "EMPTY"
  | "SCANNED_NO_TEXT";

export class DocumentExtractionError extends Error {
  code: ExtractionErrorCode;

  constructor(code: ExtractionErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "DocumentExtractionError";
  }
}
