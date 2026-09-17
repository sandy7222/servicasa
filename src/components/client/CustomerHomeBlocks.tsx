import React from 'react';
import { useApp } from '../../context/AppContext';
import { groupHomeBlockRuns, visibleCustomerHomeBlocks } from '../../lib/homeBlocks';
import type { ServiceOrder } from '../../types';
import { CustomerHomeCards } from './CustomerHomeCards';
import {
  CustomerActiveServiceCard,
  CustomerBannerCard,
  findActiveCustomerOrder,
} from './CustomerPromoBanner';

/** Recorrido único de banners + tarjetas del home del cliente, ordenado
 * por displayOrder compartido. Las tarjetas consecutivas se agrupan en una
 * sola grilla. Si hay servicio en curso, ese card reemplaza TODO el bloque. */
export const CustomerHomeBlocks: React.FC<{ orders: ServiceOrder[] }> = ({ orders }) => {
  const { homeBanners, homeCards } = useApp();
  const activeOrder = findActiveCustomerOrder(orders);
  if (activeOrder) {
    return <CustomerActiveServiceCard order={activeOrder} />;
  }

  const runs = groupHomeBlockRuns(visibleCustomerHomeBlocks(homeBanners, homeCards));
  if (runs.length === 0) return null;

  return (
    <div className="space-y-4">
      {runs.map((run) =>
        run.type === 'banner' ? (
          <div key={`banner-run-${run.items[0].id}`} className="space-y-4">
            {run.items.map((banner) => (
              <CustomerBannerCard key={banner.id} banner={banner} />
            ))}
          </div>
        ) : (
          <CustomerHomeCards key={`card-run-${run.items[0].id}`} cards={run.items} />
        )
      )}
    </div>
  );
};
