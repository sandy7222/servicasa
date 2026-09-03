import React from 'react';
import { LANDING_STEPS } from './landingSteps';

export const HowItWorksSection: React.FC = () => {
  return (
    <section className="py-16 sm:py-20 bg-slate-100/70 border-y border-slate-200" id="como-funciona">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Cómo funciona</h2>
          <p className="text-sm text-slate-600 mt-2">Un proceso simple, transparente y seguro.</p>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-6">
          <div
            className="hidden md:block absolute top-9 left-[12.5%] right-[12.5%] h-0.5 bg-slate-300"
            aria-hidden="true"
          />
          {LANDING_STEPS.map((st) => (
            <div key={st.step} className="relative flex flex-col items-center text-center gap-3">
              <div className="w-[4.5rem] h-[4.5rem] rounded-full bg-white border-4 border-slate-100 shadow-md flex items-center justify-center text-[#003875] relative z-10">
                {st.icon}
              </div>
              <h3 className="font-bold text-sm text-slate-900">
                {st.step}. {st.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-[16rem]">{st.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
