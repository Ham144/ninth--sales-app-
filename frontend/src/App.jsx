import React from "react";
import { Outlet } from "react-router";
import Navigation from "./components/Navigation";
import { Toaster } from "sonner";
import "./index.css";

function App() {
  return (
    <div className="font-sans  w-screen h-full ">
      <Toaster position="top-center" />
      <div className="z-0 w-full flex flex-col  ">
        <Navigation children={<Outlet />} />
      </div>
    </div>
  );
}

export default App;
