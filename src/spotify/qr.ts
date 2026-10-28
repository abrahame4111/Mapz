import qrcode from '../vendor/qrcode';

/** Address the phone opens after scanning. The pairing page reads `code` from it and continues by itself. */
export const PAIR_PAGE_URL = 'https://mapz-b9u.pages.dev/pair';

export function pairUrl(code: string): string {
  return `${PAIR_PAGE_URL}?code=${encodeURIComponent(code)}`;
}

/** Self-contained SVG of the QR code (dark modules on white, with the quiet zone phones need to scan it). */
export function qrSvg(text: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag(4, 4);
}
