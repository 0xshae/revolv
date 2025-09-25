import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState } from "react";
// Internal Components
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { WalletDetails } from "@/components/WalletDetails";
import { NetworkInfo } from "@/components/NetworkInfo";
import { AccountInfo } from "@/components/AccountInfo";
import { TransferAPT } from "@/components/TransferAPT";
import { MessageBoard } from "@/components/MessageBoard";
import { TopBanner } from "@/components/TopBanner";
// Revolv Pages
import LiquidityPage from "./pages/LiquidityPage";
import AutoLoanPage from "./pages/AutoLoanPage";

function App() {
  const { connected, account } = useWallet();
  const [currentPage, setCurrentPage] = useState<'liquidity' | 'auto-loan'>('liquidity');

  return (
    <>
      <TopBanner />
      <Header />
      
      {/* Navigation */}
      <div className="flex justify-center mb-6">
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
          <Button
            variant={currentPage === 'liquidity' ? 'default' : 'ghost'}
            onClick={() => setCurrentPage('liquidity')}
            className="px-6"
          >
            Provide Liquidity
          </Button>
          <Button
            variant={currentPage === 'auto-loan' ? 'default' : 'ghost'}
            onClick={() => setCurrentPage('auto-loan')}
            className="px-6"
          >
            Auto-Loan
          </Button>
        </div>
      </div>

      {/* Page Content */}
      {currentPage === 'liquidity' ? (
        <LiquidityPage account={account} />
      ) : (
        <AutoLoanPage account={account} />
      )}

      {/* Original Demo Components (Hidden by default) */}
      {false && connected && (
        <div className="flex items-center justify-center flex-col">
          <Card>
            <CardContent className="flex flex-col gap-10 pt-6">
              <WalletDetails />
              <NetworkInfo />
              <AccountInfo />
              <TransferAPT />
              <MessageBoard />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

export default App;
