import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  ChevronRight,
  ChevronLeft,
  PieChart,
  LogsIcon,
  DownloadCloud,
} from "lucide-react";
import { useUserInfo } from "@/store";

export default function OverdueSideBarMenu({ children }) {
  const menuItems = [
    { name: "Overdue List", path: "/overdue/list", icon: LogsIcon },
    { name: "Statistics", path: "/overdue/statistics", icon: PieChart },
    {
      name: "Overdue Downloader",
      path: "/overdue/downloader",
      icon: DownloadCloud,
    },
  ];

  const { userInfo } = useUserInfo();
  const [isOpen, setIsOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(64);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(64);

  const toggleSidebar = () => {
    const newWidth = isOpen ? 64 : 256;
    setSidebarWidth(newWidth);
    setIsOpen(!isOpen);
  };

  const handleMouseDown = (e) => {
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(sidebarWidth);
    document.body.style.cursor = "ew-resize";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isResizing) return;
    const newWidth = startWidth + e.clientX - startX;
    const clampedWidth = Math.max(64, Math.min(newWidth, 512));
    setSidebarWidth(clampedWidth);
    setIsOpen(clampedWidth > 100);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    document.body.style.cursor = "";
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    return () => {
      // Cleanup event listeners
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div className="sticky top-0 z-20 h-screen flex">
      <aside
        className={`relative backdrop shadow-lg border-r border-gray-200 py-6 px-4 flex flex-col transition-all duration-300 ease-in-out z-20 ${
          isOpen ? "w-64" : "w-16"
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <div
            className={`transition-opacity duration-300 ${
              isOpen ? "opacity-100" : "opacity-0 hidden"
            }`}
          >
            <h3 className="text-xl font-light text-gray-800 text-center">
              Overdue Menu
            </h3>
          </div>
        </div>

        <div
          className="absolute top-4 -right-3 w-6 h-6 bg-gray-200 hover:bg-gray-300 cursor-pointer rounded-full shadow-md flex items-center justify-center transition-colors"
          onMouseDown={handleMouseDown}
          onClick={(e) => {
            e.stopPropagation();
            toggleSidebar();
          }}
        >
          {isOpen ? (
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-600" />
          )}
        </div>

        <nav className="flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map(({ name, icon: Icon, path }, i) => (
              <li key={name}>
                <NavLink
                  to={path}
                  className={({ isActive }) =>
                    `flex items-center p-2 rounded-lg transition-all duration-200 ${
                      userInfo.role != "supertenant" &&
                      name == "supertenant" &&
                      "hidden"
                    } ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-600 hover:bg-gray-100"
                    }`
                  }
                  title={!isOpen ? name : ""}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span
                    className={`ml-3 truncate transition-opacity duration-300 ${
                      isOpen ? "opacity-100" : "opacity-0 hidden"
                    }`}
                  >
                    {name}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 p-6 pb-20 overflow-y-auto">{children}</div>
    </div>
  );
}
