import { describe, expect, it } from 'vitest';
import { distanceKm, distanceToOrderKm, isWithinWorkZone } from './technicianDistance';

describe('distanceKm', () => {
  it('distancia cero entre el mismo punto', () => {
    expect(distanceKm({ lat: -34.6037, lng: -58.3816 }, { lat: -34.6037, lng: -58.3816 })).toBeCloseTo(0, 5);
  });

  it('referencia real de la charla: Glew a Capital ~34km', () => {
    // Glew (-34.8459, -58.4055) a Plaza de Mayo, CABA (-34.6083, -58.3712).
    const km = distanceKm({ lat: -34.8459, lng: -58.4055 }, { lat: -34.6083, lng: -58.3712 });
    expect(km).toBeGreaterThan(25);
    expect(km).toBeLessThan(40);
  });
});

describe('distanceToOrderKm', () => {
  const order = { clientLat: -34.6037, clientLng: -58.3816 };
  const technician = { workZoneLat: -34.6083, workZoneLng: -58.3712 };

  it('calcula la distancia cuando ambos tienen coordenadas', () => {
    expect(distanceToOrderKm(order, technician)).not.toBeNull();
  });

  it('null si a la orden le falta geocodificar', () => {
    expect(distanceToOrderKm({ clientLat: undefined, clientLng: undefined }, technician)).toBeNull();
    expect(distanceToOrderKm({ clientLat: null, clientLng: null }, technician)).toBeNull();
  });

  it('null si el técnico todavía no declaró su Zona de trabajo', () => {
    expect(distanceToOrderKm(order, { workZoneLat: undefined, workZoneLng: undefined })).toBeNull();
  });
});

describe('isWithinWorkZone', () => {
  const order = { clientLat: -34.6037, clientLng: -58.3816 };

  it('true si la distancia es menor o igual al radio declarado', () => {
    const technician = { workZoneLat: -34.6083, workZoneLng: -58.3712, workZoneRadiusKm: 15 };
    expect(isWithinWorkZone(order, technician)).toBe(true);
  });

  it('false si la distancia supera el radio declarado', () => {
    const technician = { workZoneLat: -34.6083, workZoneLng: -58.3712, workZoneRadiusKm: 1 };
    expect(isWithinWorkZone(order, technician)).toBe(false);
  });

  it('false (nunca true) si falta cualquier dato', () => {
    expect(isWithinWorkZone(order, { workZoneLat: undefined, workZoneLng: undefined, workZoneRadiusKm: undefined })).toBe(false);
    expect(isWithinWorkZone({ clientLat: undefined, clientLng: undefined }, { workZoneLat: -34.6083, workZoneLng: -58.3712, workZoneRadiusKm: 60 })).toBe(false);
  });
});
