// Types for the vendored qrcode-generator (src/vendor/qrcode.js, MIT, Kazuhiko Arase).
interface QRCode {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
  createSvgTag(cellSize?: number, margin?: number): string;
}
declare const qrcode: (typeNumber: number, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H') => QRCode;
export default qrcode;
