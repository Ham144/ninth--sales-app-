import React from "react";
import { useLocation, useNavigate } from "react-router";
import {
  HomeIcon,
  UserCheck,
  ShoppingCartIcon,
  ArrowDownUp,
} from "lucide-react";

const SideDrawer = ({ children }) => {
  const navigate = useNavigate();

  const menuItem = [
    {
      name: "Home",
      icon: <HomeIcon className="w-6 h-6" />,
      path: "/",
    },
    {
      name: "New Request",
      icon: <ShoppingCartIcon className="w-6 h-6" />,
      path: "/request",
    },
    {
      name: "process",
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
    <div className="flex flex-col h-screen w-full ">
      <main className="flex-1 overflow-y-auto w-full min-w-0 pb-16">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-300 shadow-lg z-50">
        <div className="flex justify-around items-center h-16 px-2">
          {menuItem.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
                  isActive
                    ? "text-primary"
                    : "text-base-content/60 hover:text-primary"
                }`}
              >
                {item.icon}
                <span className="text-xs mt-1 font-medium">{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SideDrawer;
