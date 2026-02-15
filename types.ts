
export enum PrinterOutputMode {
  FACE_UP = 'FACE_UP',
  FACE_DOWN = 'FACE_DOWN'
}

export enum PaperOrientation {
  NORMAL = 'NORMAL',
  ROTATED_180 = 'ROTATED_180'
}

export interface PrinterConfig {
  outputMode: PrinterOutputMode;
  reinsertOrientation: PaperOrientation;
  flipSide: 'SHORT_EDGE' | 'LONG_EDGE';
}

export interface PDFData {
  name: string;
  size: number;
  pages: number;
  data: Uint8Array;
}

export interface PDFParts {
  odd: Uint8Array | null;
  even: Uint8Array | null;
}
