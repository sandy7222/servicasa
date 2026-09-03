import React from 'react';
import { LANDING_STEPS } from './landingSteps';

export const HowItWorksSection: React.FC = () => {
  return (
    <section className="py-16 sm:py-20 bg-[#F1F5FB]" id="como-funciona">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Cómo funciona</h2>
          <p className="text-base text-slate-500 mt-2.5">Pedirlo es tan fácil como parece.</p>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-y-10 gap-x-6">
          <div
            className="hidden md:block absolute top-9 left-[12.5%] right-[12.5%] h-px bg-slate-300/70"
            aria-hidden="true"
          />
          {LANDING_STEPS.map((st) => (
            <div key={st.step} className="relative flex flex-col items-center text-center gap-3">
              <div className="w-[4.5rem] h-[4.5rem] rounded-full bg-white border border-slate-200/80 shadow-[0_4px_16px_-8px_rgba(15,23,42,0.15)] flex items-center justify-center text-[#003875] relative z-10 [&>svg]:w-6 [&>svg]:h-6">
                {st.icon}
              </div>
              <span className="text-xs font-bold text-teal-600 tracking-wide">
                {st.step.padStart(2, '0')}
              </span>
              <h3 className="font-bold text-[15px] text-slate-900 -mt-1.5">{st.title}</h3>
              <p className="text-[13px] text-slate-500 leading-relaxed max-w-[14rem]">{st.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
