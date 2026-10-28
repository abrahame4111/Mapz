import { describe, expect, it } from 'vitest';
import { pairUrl, qrSvg } from './qr';

describe('pairing QR', () => {
  it('points the phone at the pairing page with the code filled in', () => {
    expect(pairUrl('K7M2QX')).toBe('https://mapz-b9u.pages.dev/pair?code=K7M2QX');
  });

  it('renders an SVG', () => {
    const svg = qrSvg(pairUrl('K7M2QX'));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
  });
});
