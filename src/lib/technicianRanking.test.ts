import { describe, expect, it } from 'vitest';
import type { Technician } from '../types';
import { bestEligibleTechnician, countTechniciansInZone, sortTechniciansSuggested } from './technicianRanking';

function tech(partial: Partial<Technician> & Pick<Technician, 'id' | 'name'>): Technician {
  return {
    specialty: 'Plomería',
    specialties: [],
    phone: '',
    email: `${partial.id}@test.com`,
    rating: 0,
    avatarBg: '#000',
    activeOrdersCount: 0,
    completedOrdersCount: 0,
    zone: '',
    province: '',
    ...partial,
  };
}

const order = { id: 'ord-1', scheduledDate: '2026-09-24', clientLat: -34.7, clientLng: -58.3 };

describe('technicianRanking', () => {
  const near = tech({
    id: 'near',
    name: 'Cerca',
    rating: 3,
    workZoneLat: -34.7,
    workZoneLng: -58.3,
    workZoneRadiusKm: 20,
  });
  const farRated = tech({
    id: 'far',
    name: 'Lejos',
    rating: 5,
    totalRatingsCount: 12,
    workZoneLat: -34.9,
    workZoneLng: -58.6,
    workZoneRadiusKm: 10,
  });
  const ctx = {
    order,
    orders: [],
    availability: { near: true, far: true },
    eligibility: { near: { canReceive: true }, far: { canReceive: true } },
  };

  it('prioriza quien está en zona sobre quien tiene mejor rating afuera', () => {
    const sorted = sortTechniciansSuggested([farRated, near], ctx);
    expect(sorted.map((item) => item.id)).toEqual(['near', 'far']);
  });

  it('elige al mejor habilitado y cuenta zona', () => {
    expect(bestEligibleTechnician([farRated, near], ctx)?.id).toBe('near');
    expect(countTechniciansInZone([near, farRated], order)).toBe(1);
  });

  it('no recomienda a quien no está habilitado', () => {
    const blocked = {
      ...ctx,
      eligibility: { near: { canReceive: false }, far: { canReceive: true } },
    };
    expect(bestEligibleTechnician([near, farRated], blocked)?.id).toBe('far');
  });
});
