import { describe, it, expect } from 'vitest';
import { calculatePolygonAreaSqMiles, validateAoiArea } from '@server/services/routing/area';

describe('Polygon Area and AOI Validation Tests', () => {
  it('returns 0 area for rings with fewer than 3 points', () => {
    expect(calculatePolygonAreaSqMiles([])).toBe(0);
    expect(calculatePolygonAreaSqMiles([[-86.81, 33.51]])).toBe(0);
  });

  it('calculates approximate area for a small corridor ring in Birmingham, AL', () => {
    // ~1 mile x 0.2 mile rectangle
    const ring: [number, number][] = [
      [-86.8104, 33.5186],
      [-86.7904, 33.5186],
      [-86.7904, 33.5216],
      [-86.8104, 33.5216],
      [-86.8104, 33.5186],
    ];

    const area = calculatePolygonAreaSqMiles(ring);
    expect(area).toBeGreaterThan(0.1);
    expect(area).toBeLessThan(1.5);
  });

  it('validates polygon within the configured 10 mi² limit', () => {
    const smallRing: [number, number][] = [
      [-86.8104, 33.5186],
      [-86.7904, 33.5186],
      [-86.7904, 33.5216],
      [-86.8104, 33.5216],
      [-86.8104, 33.5186],
    ];

    const check = validateAoiArea(smallRing, 10);
    expect(check.valid).toBe(true);
    expect(check.areaSqMiles).toBeLessThan(10);
  });

  it('rejects oversized polygon exceeding limit', () => {
    // 50 x 50 mile polygon
    const hugeRing: [number, number][] = [
      [-87.5, 33.0],
      [-86.5, 33.0],
      [-86.5, 34.0],
      [-87.5, 34.0],
      [-87.5, 33.0],
    ];

    const check = validateAoiArea(hugeRing, 10);
    expect(check.valid).toBe(false);
    expect(check.areaSqMiles).toBeGreaterThan(100);
  });
});
