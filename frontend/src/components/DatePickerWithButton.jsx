import { Calendar, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DatePickerWithButtons = ({
  value,
  onChange,
  placeholder = "Pilih tanggal...",
  className = "",
  minDate,
  maxDate,
  disabled = false,
}) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(
    value ? new Date(value) : null
  );

  const calendarRef = useRef();

  // Update selected date when value prop changes
  useEffect(() => {
    if (value) {
      setSelectedDate(new Date(value));
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Format date to YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Format date for display
  const formatDisplayDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Navigate to previous month
  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  // Get days in month
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get first day of month
  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  // Handle date selection
  const handleDateSelect = (date) => {
    // Validate against min/max dates if provided
    if (minDate && date < new Date(minDate)) return;
    if (maxDate && date > new Date(maxDate)) return;

    setSelectedDate(date);
    onChange(formatDate(date));
    setShowCalendar(false);
  };

  // Quick selection buttons
  const handleToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
    onChange(formatDate(today));
    setShowCalendar(false);
  };

  const handleTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow);
    setCurrentMonth(tomorrow);
    onChange(formatDate(tomorrow));
    setShowCalendar(false);
  };

  const handleNextWeek = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setSelectedDate(nextWeek);
    setCurrentMonth(nextWeek);
    onChange(formatDate(nextWeek));
    setShowCalendar(false);
  };

  const handleClear = () => {
    setSelectedDate(null);
    onChange("");
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayIndex = getFirstDayOfMonth(year, month);
    const days = [];

    // Previous month's days
    const prevMonthDays = getDaysInMonth(year, month - 1);
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        isSelected:
          selectedDate && formatDate(date) === formatDate(selectedDate),
      });
    }

    // Current month's days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: formatDate(date) === formatDate(today),
        isSelected:
          selectedDate && formatDate(date) === formatDate(selectedDate),
        isDisabled:
          (minDate && date < new Date(minDate)) ||
          (maxDate && date > new Date(maxDate)),
      });
    }

    // Next month's days
    const totalCells = 42; // 6 weeks
    const nextMonthDays = totalCells - days.length;
    for (let i = 1; i <= nextMonthDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        isSelected:
          selectedDate && formatDate(date) === formatDate(selectedDate),
      });
    }

    return days;
  };

  // Days of week (Indonesian)
  const weekDays = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const days = generateCalendarDays();

  return (
    <div className={`relative ${className}`} ref={calendarRef}>
      {/* Input Field */}
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={selectedDate ? formatDisplayDate(selectedDate) : ""}
          readOnly
          onClick={() => !disabled && setShowCalendar(!showCalendar)}
          disabled={disabled}
          className={`w-full px-4 py-3 pr-32 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
            disabled
              ? "opacity-60 cursor-not-allowed bg-gray-50"
              : "cursor-pointer"
          } ${showCalendar ? "ring-2 ring-indigo-500 border-indigo-500" : ""}`}
        />

        {/* Calendar Icon and Clear Button */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {selectedDate && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              title="Hapus tanggal"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setShowCalendar(!showCalendar)}
            disabled={disabled}
            className={`p-1.5 rounded-lg transition-colors ${
              disabled ? "cursor-not-allowed" : "hover:bg-gray-100"
            }`}
          >
            <Calendar
              className={`w-5 h-5 ${
                showCalendar ? "text-indigo-600" : "text-gray-400"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Calendar Dropdown */}
      {showCalendar && !disabled && (
        <div className="absolute z-50 mt-2 w-full max-w-sm bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-fadeIn bottom-0">
          {/* Calendar Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="text-lg font-semibold text-gray-900">
                  {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </div>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <button
                type="button"
                onClick={handleToday}
                className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors font-medium"
              >
                Hari Ini
              </button>
            </div>

            {/* Quick Selection Buttons */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={handleTomorrow}
                className="flex-1 px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors font-medium"
              >
                Besok
              </button>
              <button
                type="button"
                onClick={handleNextWeek}
                className="flex-1 px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors font-medium"
              >
                7 Hari Lagi
              </button>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day, index) => (
                <div
                  key={day}
                  className={`text-center text-sm font-medium py-2 ${
                    index === 0 ? "text-red-500" : "text-gray-600"
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    day.isCurrentMonth &&
                    !day.isDisabled &&
                    handleDateSelect(day.date)
                  }
                  disabled={!day.isCurrentMonth || day.isDisabled}
                  className={`
                      aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all
                      ${
                        !day.isCurrentMonth || day.isDisabled
                          ? "text-gray-400 cursor-default"
                          : "hover:bg-gray-100"
                      }
                      ${
                        day.isSelected
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : day.isToday
                          ? "border-2 border-indigo-200"
                          : ""
                      }
                      ${index % 7 === 0 ? "text-red-500" : ""}
                    `}
                >
                  {day.date.getDate()}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Date Display */}
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Tanggal terpilih:</div>
                <div className="font-semibold text-gray-900">
                  {selectedDate
                    ? formatDisplayDate(selectedDate)
                    : "Belum dipilih"}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {selectedDate && formatDate(selectedDate)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={handleToday}
          disabled={disabled}
          className="flex-1 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Hari Ini
        </button>
        <button
          type="button"
          onClick={handleTomorrow}
          disabled={disabled}
          className="flex-1 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Besok
        </button>
        <button
          type="button"
          onClick={handleNextWeek}
          disabled={disabled}
          className="flex-1 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          7 Hari Lagi
        </button>
      </div>
    </div>
  );
};

export default DatePickerWithButtons;
