import OverdueApi from "@/api/OverdueApi";
import OverdueSideBarMenu from "@/components/OverdueSideBarMenu";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/monthpicker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, CalendarRange } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

const OverdueDownloader = () => {
  const [selectedMonth, setSelectedMonth] = useState();
  const [includeCustomerDetail, setIncludeCustomerDetail] = useState(true);

  // Get available months
  const { data: availableMonths, isLoading: isLoadingMonths } = useQuery({
    queryKey: ["availableMonths"],
    queryFn: async () => {
      const response = await OverdueApi.getAvailableMonths();
      return response.data;
    },
  });
  // Auto-select bulan terbaru yang tersedia data
  useEffect(() => {
    if (
      availableMonths?.data &&
      availableMonths.data.length > 0 &&
      !selectedMonth
    ) {
      const latestMonth = availableMonths.data[0];
      const monthDate = new Date(latestMonth.year, latestMonth.month - 1);
      setSelectedMonth(monthDate);
    }
  }, [availableMonths, selectedMonth]);

  const { mutateAsync: handleDownloadByMonth, isPending: isDownloading } =
    useMutation({
      mutationKey: ["downloadOverdue"],
      mutationFn: async () =>
        await OverdueApi.downloadCsv({
          selectedMonth,
          includeCustomerDetail,
        }),
      onSuccess: (data) => {
        const url = window.URL.createObjectURL(new Blob([data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "overdue.csv");
        document.body.appendChild(link);
        link.click();
        toast.success("Download berhasil!");
      },
      onError: (err) => {
        toast.error(err?.response?.data?.message || "Gagal download data");
      },
    });

  return (
    <OverdueSideBarMenu>
      <div className="max-w-7xl mx-auto p-6 space-y-6 flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
          <h2 className="text-3xl title">Overdue Downloader</h2>
        </div>

        {/* Info bulan yang tersedia */}
        {availableMonths && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">
              Bulan yang tersedia data:
            </h3>
            <div className="flex flex-wrap gap-2">
              {availableMonths.data?.map((month, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {month.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Warning jika bulan yang dipilih tidak ada data */}
        {selectedMonth && availableMonths && (
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-yellow-800">
              <strong>Note:</strong> (Cara mendownload) jika ingin mendownload
              (Bulan yang tersedia data) pada bulan 7 maka pilih bulan 8.
            </p>
          </div>
        )}

        <div className="flex max-md:flex-col gap-4 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !selectedMonth && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedMonth ? (
                  format(selectedMonth, "MMM yyyy")
                ) : (
                  <span>Pilih bulan</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <MonthPicker
                onMonthSelect={setSelectedMonth}
                selectedMonth={selectedMonth}
              />
            </PopoverContent>
          </Popover>
          <div className="form-control max-md:w-full  border-2 border-dashed border-blue-300 rounded-lg">
            <label className="cursor-pointer  label gap-x-2">
              <span className="label-text border border-dashed text-blue-500">
                Include Customer Detail
              </span>
              <input
                onChange={() =>
                  setIncludeCustomerDetail(!includeCustomerDetail)
                }
                checked={includeCustomerDetail}
                type="checkbox"
                className="checkbox checked:bg-blue-500 text-5xl"
              />
            </label>
          </div>{" "}
        </div>

        <button
          disabled={isDownloading || !selectedMonth}
          onClick={handleDownloadByMonth}
          className="btn backdrop rounded-lg"
        >
          {isDownloading ? "Downloading..." : "Start Collect and Download"}
        </button>
      </div>
    </OverdueSideBarMenu>
  );
};

export default OverdueDownloader;
