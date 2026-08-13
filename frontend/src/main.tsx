import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { queryClient } from "./app/queryClient";
import { router } from "./app/router";
import { AuthProvider } from "./lib/auth";
import { WalletProvider } from "./lib/wallet";
import { DecryptHoverText } from "./components/DecryptHoverText";
import { ToastProvider } from "./components/ui";
import { PageLoader } from "./pages/landing/components/balary/PageLoader";
import "@fontsource-variable/mona-sans";
import "@fontsource/fira-mono/400.css";
import "@fontsource/fira-mono/700.css";
import "./styles/index.css";
import "./styles/tailwind.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PageLoader />
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <AuthProvider>
          <ToastProvider>
            <DecryptHoverText />
            <RouterProvider router={router} />
          </ToastProvider>
        </AuthProvider>
      </WalletProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
