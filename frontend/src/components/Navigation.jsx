import React from "react";
import { useLocation, useNavigate } from "react-router";
import {
  HomeIcon,
  UserCheck,
  ShoppingCartIcon,
  ArrowDownUp,
  Package2,
} from "lucide-react";

const SideDrawer = ({ children }) => {
  const navigate = useNavigate();

  const path = useLocation();

  const menuItem = [
    {
      name: "Home",
      icon: <HomeIcon className="w-6 h-6" />,
      path: "/",
    },
    {
      name: "Stock",
      icon: <Package2 className="w-6 h-6" />,
      path: "/stockCheck",
    },
    {
      name: "New",
      icon: <ShoppingCartIcon className="w-6 h-6" />,
      path: "/request",
    },
    {
      name: "Process",
      icon: <ArrowDownUp className="w-6 h-6" />,
      path: "/process",
    },
    {
      name: "Profile",
      icon: <UserCheck className="w-6 h-6" />,
      path: "/profile",
    },
  ];

  const location = useLocation();

  return (
    <div className="flex  flex-col h-screen w-full ">
      <div className="relative flex flex-col h-screen w-full overflow-hidden ">
        {/* Layer background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-purple-100 to-blue-100" />

        {/* Layer blob dekorasi */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />

        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000" />

        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000" />

        {/* Konten utama */}
        <div className="h-screen z-20 overflow-auto">{children}</div>
      </div>

      {path.pathname !== "/login" &&
        path.pathname !== "/2fa/verification" &&
        path.pathname !== "/developer.integration" && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-20">
            <div
              className="flex justify-around items-center h-16 px-4 rounded-xl
                   backdrop-blur-lg bg-gradient-to-l from-pink-200 to-indigo-200"
            >
              {menuItem.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.path)}
                    className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${
                      isActive
                        ? "text-indigo-600 scale-105"
                        : "text-gray-600 hover:text-indigo-500"
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-full ${
                        isActive ? "bg-indigo-100/80" : ""
                      }`}
                    >
                      {item.icon}
                    </div>
                    <span className="text-xs mt-0.5 font-medium">
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
};

export default SideDrawer;
