import React from 'react';
import { PhoneCall, UserCheck, MapPin, CheckCircle2 } from 'lucide-react';

export interface LandingStep {
  step: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}

// Compartido entre el modal "Cómo funciona" y el resumen en página (sección 8 de la spec).
export const LANDING_STEPS: LandingStep[] = [
  {
    step: '1',
    title: 'Solicitás el servicio',
    desc: 'Contanos qué necesitás en pocos pasos.',
    icon: <PhoneCall className="w-5 h-5" />,
  },
  {
    step: '2',
    title: 'Técnico asignado',
    desc: 'Te asignamos al mejor disponible cerca tuyo.',
    icon: <UserCheck className="w-5 h-5" />,
  },
  {
    step: '3',
    title: 'Seguimiento paso a paso',
    desc: 'Te avisamos cuando el técnico sale, llega y termina, y ves cada paso en la app.',
    icon: <MapPin className="w-5 h-5" />,
  },
  {
    step: '4',
    title: 'Trabajo terminado',
    desc: 'Calificás el servicio, con 30 días de garantía.',
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
];
