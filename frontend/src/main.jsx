import { createRoot } from "react-dom/client";
import "./index.css";
import { Route, RouterProvider, createRoutesFromElements } from "react-router";
import React from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Profile from "./pages/Profile.jsx";
import NotFound from "./pages/not-found.jsx";
import AllAccounts from "./pages/AllAccounts.jsx";
import LevelWrapper from "./components/LevelWrapper";
import Config from "./pages/Config";
import SuperTenantPage from "./pages/SuperTenantPage";
import ProductManagement from "./pages/ProductManagement";
import RequestPage from "./pages/RequestPage";
import ProcessPage from "./pages/ProcessPage";
import AccountManagement from "./pages/AccountManagement";
import CustomerManagement from "./pages/CustomerManagement";
import OverduePage from "./pages/OverduePage";
// import RegisterPage from "./pages/RegisterPage";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<App />}>
      <Route path="/" element={<LevelWrapper />}>
        <Route index={true} path="/" element={<Home />} />

        {/* menu User awam */}
        <Route path="/profile" element={<Profile />} />
        <Route path="/request" element={<RequestPage />} />
        <Route path="/process" element={<ProcessPage />} />
        <Route path="/overdue" element={<OverduePage />} />

        {/* menu IT and admin */}
        <Route path="/management/product" element={<ProductManagement />} />
        <Route path="/management/customer" element={<CustomerManagement />} />
        <Route path="/management/account" element={<AccountManagement />} />
        <Route path="/management/config" element={<Config />} />
        <Route path="/supertenant/management" element={<SuperTenantPage />} />
        <Route path="/all_account" element={<AllAccounts />} />
      </Route>
      <Route index={true} path="/login" element={<Login />} />
      {/* <Route index={true} path="/register" element={<RegisterPage />} /> */}

      <Route path="*" element={<NotFound />} />
    </Route>
  )
);

const queryClient = new QueryClient();

createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);
