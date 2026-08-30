import { describe, it, expect } from 'vitest';
import { LatLngSchema, AnalyzeRequestSchema, GeocodeQuerySchema } from '../../server/services/fortyguard/schemas';

describe('Zod Validation and US Prefilter Bounds Tests', () => {
  describe('LatLngSchema', () => {
    it('accepts valid Alabama / US coordinates', () => {
      const birmingham = { lat: 33.5186, lng: -86.8104 };
      const montgomery = { lat: 32.3792, lng: -86.3077 };

      expect(LatLngSchema.safeParse(birmingham).success).toBe(true);
      expect(LatLngSchema.safeParse(montgomery).success).toBe(true);
    });

    it('rejects known non-US locations (Negative Geography Test)', () => {
      // Known non-US coordinate: Lat 25.2048, Lng 55.2708 (outside US bounds Lng [-126, -66])
      const nonUsLocation = { lat: 25.2048, lng: 55.2708 };
      const result = LatLngSchema.safeParse(nonUsLocation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('US bounds');
      }
    });

    it('rejects latitude outside US bounds', () => {
      const tooFarNorth = { lat: 55.0, lng: -86.8 }; // Canada
      const tooFarSouth = { lat: 15.0, lng: -86.8 }; // Central America

      expect(LatLngSchema.safeParse(tooFarNorth).success).toBe(false);
      expect(LatLngSchema.safeParse(tooFarSouth).success).toBe(false);
    });
  });

  describe('AnalyzeRequestSchema', () => {
    it('accepts valid start and destination with optional date/time', () => {
      const req = {
        start: { lat: 33.5186, lng: -86.8104 },
        destination: { lat: 33.48, lng: -86.77 },
        date: '2026-08-29',
        time: '14:00',
      };
      expect(AnalyzeRequestSchema.safeParse(req).success).toBe(true);
    });

    it('rejects invalid date format', () => {
      const req = {
        start: { lat: 33.5186, lng: -86.8104 },
        destination: { lat: 33.48, lng: -86.77 },
        date: '29/08/2026', // wrong format
      };
      expect(AnalyzeRequestSchema.safeParse(req).success).toBe(false);
    });
  });

  describe('GeocodeQuerySchema', () => {
    it('accepts search queries >= 3 characters', () => {
      expect(GeocodeQuerySchema.safeParse({ q: 'Birmingham' }).success).toBe(true);
    });

    it('rejects queries shorter than 3 characters', () => {
      expect(GeocodeQuerySchema.safeParse({ q: 'AL' }).success).toBe(false);
    });
  });
});
