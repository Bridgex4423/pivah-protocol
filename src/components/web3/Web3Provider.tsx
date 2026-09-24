import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import type { ReactNode } from "react";
import { useState } from "react";

import { getWagmiConfig } from "@/lib/wagmi";

export function Web3Provider({ children }: { children: ReactNode }) {
  const [config] = useState(() => getWagmiConfig());

  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider
        modalSize="compact"
        theme={darkTheme({
          accentColor: "oklch(0.62 0.222 295)",
          accentColorForeground: "white",
          borderRadius: "large",
          overlayBlur: "small",
        })}
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
