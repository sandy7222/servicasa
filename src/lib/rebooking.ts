import type { ServiceOrder } from '../types';
import type { AssistantDraft } from './diagnosisAssistant';

export function draftFromCompletedOrder(order: Pick<ServiceOrder, 'title' | 'description' | 'serviceType' | 'workMode'>): AssistantDraft {
  return {
    serviceType: order.serviceType,
    workMode: order.workMode === 'direct' ? 'direct' : 'diagnosis',
    title: order.title,
    description: [
      order.description,
      'Pedido repetido desde un servicio anterior. El cliente quiere el mismo tipo de trabajo.',
    ]
      .filter(Boolean)
      .join('\n'),
    priority: 'media',
    subcategorySlugs: [],
    quantity: 1,
  };
}
