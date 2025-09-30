import { useState } from "react";
import { Calendar } from "lucide-react";

export default function MonthPicker({ onMonthSelect }) {
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div className="relative w-full max-w-xs">
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="w-full flex items-center justify-between rounded-xl border border-gray-300 bg-white px-3 py-2 text-left shadow-sm hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <span className="text-gray-900">
          {selected !== null ? months[selected] : "Select month"}
        </span>
        <Calendar className="h-5 w-5 text-gray-500" />
      </button>

      {show && (
        <div className="absolute z-10 mt-2 w-64 rounded-xl bg-white shadow-lg border border-gray-200 p-3">
          <div className="grid grid-cols-3 gap-2">
            {months.map((m, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelected(i);
                  onMonthSelect(new Date(2025, i, 1)); // trigger callback
                  setShow(false);
                }}
                className={`rounded-lg px-2 py-1 text-sm transition-colors
                  ${
                    selected === i
                      ? "bg-indigo-500 text-white"
                      : "hover:bg-indigo-100 text-gray-700"
                  }`}
              >
                {m.substring(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
