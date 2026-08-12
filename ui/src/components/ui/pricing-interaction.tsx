import NumberFlow from "@number-flow/react";
import { useState } from "react";

export function PricingInteraction({
  starterMonth,
  starterAnnual,
  proMonth,
  proAnnual,
  onChange,
}: {
  starterMonth: number;
  starterAnnual: number;
  proMonth: number;
  proAnnual: number;
  onChange?: (active: number, period: number) => void;
}) {
  const [active, setActive] = useState(0);
  const [period, setPeriod] = useState(0);

  const handleChangePlan = (index: number) => {
    setActive(index);
    onChange?.(index, period);
  };
  const handleChangePeriod = (index: number) => {
    setPeriod(index);
    onChange?.(active, index);
  };

  const prices = [
    { starter: starterMonth, pro: proMonth },
    { starter: starterAnnual, pro: proAnnual },
  ];

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 rounded-[32px] border-2 bg-white p-3 shadow-md">
      <div className="relative flex w-full items-center rounded-full bg-slate-100 p-1.5">
        <button
          className="z-20 w-full rounded-full p-1.5 font-semibold text-slate-800"
          onClick={() => handleChangePeriod(0)}
        >
          Monthly
        </button>
        <button
          className="z-20 w-full rounded-full p-1.5 font-semibold text-slate-800"
          onClick={() => handleChangePeriod(1)}
        >
          Yearly
        </button>
        <div
          className="absolute inset-0 z-10 flex w-1/2 items-center justify-center p-1.5"
          style={{
            transform: `translateX(${period * 100}%)`,
            transition: "transform 0.3s",
          }}
        >
          <div className="h-full w-full rounded-full bg-white shadow-sm" />
        </div>
      </div>

      <div className="relative flex w-full flex-col items-center justify-center gap-3">
        {[
          { label: "Free", price: 0, sub: "/month", popular: false, idx: 0 },
          {
            label: "Starter",
            price: prices[period].starter,
            sub: period === 0 ? "/month" : "/month",
            popular: true,
            idx: 1,
          },
          {
            label: "Pro",
            price: prices[period].pro,
            sub: period === 0 ? "/month" : "/month",
            popular: false,
            idx: 2,
          },
        ].map((p) => (
          <div
            key={p.idx}
            className="flex w-full cursor-pointer items-center justify-between rounded-2xl border-2 border-gray-400 p-4"
            onClick={() => handleChangePlan(p.idx)}
          >
            <div className="flex flex-col items-start">
              <p className="flex items-center gap-2 text-xl font-semibold text-gray-950">
                {p.label}
                {p.popular && (
                  <span className="block rounded-lg bg-yellow-100 px-2 py-1 text-sm text-yellow-950">
                    Popular
                  </span>
                )}
              </p>
              <p className="text-md text-slate-500">
                {p.idx === 0 ? (
                  <span className="font-medium text-black">$0.00</span>
                ) : (
                  <span className="flex items-center font-medium text-black">
                    <NumberFlow value={p.price} />$
                  </span>
                )}
                {p.sub}
              </p>
            </div>
            <div
              className="mt-0.5 flex size-6 items-center justify-center rounded-full border-2 border-slate-500 p-1"
              style={{
                borderColor: active === p.idx ? "#000" : "#64748b",
                transition: "border-color 0.3s",
              }}
            >
              <div
                className="size-3 rounded-full bg-black"
                style={{
                  opacity: active === p.idx ? 1 : 0,
                  transition: "opacity 0.3s",
                }}
              />
            </div>
          </div>
        ))}

        {/* Highlight box that slides */}
        <div
          className="absolute left-0 top-0 h-[88px] w-full rounded-2xl border-[3px] border-black"
          style={{
            transform: `translateY(${active * 88 + 12 * active}px)`,
            transition: "transform 0.3s",
          }}
        />
      </div>

      <button className="w-full rounded-full bg-black p-3 text-lg text-white transition-transform duration-300 active:scale-95">
        Get Started
      </button>
    </div>
  );
}
