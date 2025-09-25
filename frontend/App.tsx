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
// Revolv Pages
import LiquidityPage from "./pages/LiquidityPage";
import AutoLoanPage from "./pages/AutoLoanPage";

function App() {
  const { connected, account } = useWallet();
  const [currentPage, setCurrentPage] = useState<'liquidity' | 'auto-loan'>('liquidity');

  return (
    <div className="min-h-screen bg-black">
      <Header onNavigateToLiquidity={() => setCurrentPage('liquidity')} />
      
      {/* Navigation */}
      <div className="flex justify-center mb-8 pt-8">
        <div className="flex space-x-1 bg-gray-900/50 backdrop-blur-xl border border-gray-800 p-1 rounded-2xl">
          <Button
            variant={currentPage === 'liquidity' ? 'default' : 'ghost'}
            onClick={() => setCurrentPage('liquidity')}
            className={`px-8 py-3 rounded-xl font-light transition-all duration-200 ${
              currentPage === 'liquidity' 
                ? 'bg-white text-black hover:bg-gray-100' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            Provide Liquidity
          </Button>
          <Button
            variant={currentPage === 'auto-loan' ? 'default' : 'ghost'}
            onClick={() => setCurrentPage('auto-loan')}
            className={`px-8 py-3 rounded-xl font-light transition-all duration-200 ${
              currentPage === 'auto-loan' 
                ? 'bg-white text-black hover:bg-gray-100' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
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
    </div>
  );
}

export default App;
