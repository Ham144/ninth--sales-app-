import { months } from "@/api/constant";
import OverdueApi from "@/api/OverdueApi";
import OverdueSideBarMenu from "@/components/OverdueSideBarMenu";
import { useQuery } from "@tanstack/react-query";
import React from "react";

const OverdueStatistics = () => {
  // Get available months
  // Get available months
  const { data: availableMonths = [], isLoading: isLoadingMonths } = useQuery({
    queryKey: ["availableMonths"],
    queryFn: async () => {
      const response = await OverdueApi.getAvailableMonths();
      return response.data.data; // ✅ ambil langsung array
    },
  });

  // Susun data per tahun
  const grouped = availableMonths?.length
    ? availableMonths?.reduce((acc, item) => {
        if (!acc[item.year]) acc[item.year] = {};
        acc[item.year][item.month] = item.count;
        return acc;
      }, {})
    : [];

  // Cari max untuk normalisasi warna
  const maxCount =
    availableMonths.length > 0
      ? Math.max(...availableMonths.map((d) => d.count))
      : 1;

  const getColor = (count) => {
    if (!count) return "bg-gray-100";
    if (count <= 5) return "bg-blue-100";
    if (count <= 10) return "bg-blue-300 text-white";
    if (count <= 20) return "bg-blue-500 text-white";
    return "bg-blue-700 text-white";
  };

  return (
    <OverdueSideBarMenu>
      <div className="container mx-auto p-6 space-y-6 flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between gap-4 items-center"></div>

        {/* main */}
        <div className="max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-lg">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-800 mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Overdue Heat Map
            </h2>
            <p className="text-gray-500">
              Visualisasi data overdue per bulan dalam setahun
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-md">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <th className="p-4 text-left font-semibold text-gray-700 border-b border-gray-200">
                    Year
                  </th>
                  {months.map((m, idx) => (
                    <th
                      key={idx}
                      className="p-3 text-xs font-medium text-gray-600 text-center border-b border-gray-200 uppercase tracking-wider"
                    >
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(grouped)
                  .sort((a, b) => b - a)
                  .map((year) => (
                    <tr
                      key={year}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="p-4 font-bold text-gray-700 border-b border-gray-100 bg-gray-50 sticky left-0">
                        {year}
                      </td>
                      {months.map((_, idx) => {
                        const count = grouped[year][idx + 1];
                        return (
                          <td
                            key={idx}
                            className={`w-14 h-14 text-center cursor-pointer transition-all duration-200 transform hover:scale-110 rounded-lg border border-gray-100 ${getColor(
                              count
                            )} font-medium`}
                            title={
                              count
                                ? `${count} data pada ${months[idx]} ${year}`
                                : "Tidak ada data"
                            }
                          >
                            <div className="flex items-center justify-center h-full">
                              {count || ""}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Legenda:</span>
              <div className="flex space-x-1">
                <div className="w-5 h-5 rounded bg-gray-100"></div>
                <div className="w-5 h-5 rounded bg-blue-100"></div>
                <div className="w-5 h-5 rounded bg-blue-300"></div>
                <div className="w-5 h-5 rounded bg-blue-500"></div>
                <div className="w-5 h-5 rounded bg-blue-700"></div>
              </div>
            </div>
            <div className="text-sm text-gray-500">*Klik sel untuk detail</div>
          </div>
        </div>
      </div>
    </OverdueSideBarMenu>
  );
};

export default OverdueStatistics;
