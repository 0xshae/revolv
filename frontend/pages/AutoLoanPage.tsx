import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useWallet, InputTransactionData } from '@aptos-labs/wallet-adapter-react';
import { aptosClient } from '../utils/aptosClient';
import { MODULE_ADDRESS } from '../constants';
import { useToast } from '../components/ui/use-toast';

interface AutoLoanPageProps {
  account: any;
}

const AutoLoanPage: React.FC<AutoLoanPageProps> = ({ account }) => {
  const { connected, signAndSubmitTransaction } = useWallet();
  const { toast } = useToast();
  const [rlpCollateral, setRlpCollateral] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [currentDebt, setCurrentDebt] = useState(0);
  const [lockedCollateral, setLockedCollateral] = useState(0);
  const [pendingYield, setPendingYield] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [isRepaying, setIsRepaying] = useState(false);

  // Deposit and borrow function to call auto_loan_vault.move
  const handleDepositAndBorrow = async () => {
    if (!account || !rlpCollateral || !borrowAmount || 
        parseFloat(rlpCollateral) <= 0 || parseFloat(borrowAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter valid collateral and borrow amounts",
      });
      return;
    }

    setIsBorrowing(true);
    
    try {
      const collateralAmount = Math.floor(parseFloat(rlpCollateral) * 100000000); // Convert to octas
      const borrowAmountOctas = Math.floor(parseFloat(borrowAmount) * 1000000); // USDC has 6 decimals
      
      const transaction: InputTransactionData = {
        data: {
          function: `${MODULE_ADDRESS}::auto_loan_vault::deposit_and_borrow`,
          functionArguments: [collateralAmount, borrowAmountOctas],
          typeArguments: [],
        },
      };

      const response = await signAndSubmitTransaction(transaction);
      
      toast({
        title: "Success",
        description: `Borrow transaction submitted! Hash: ${response.hash}`,
      });

      // Clear inputs and refresh data
      setRlpCollateral('');
      setBorrowAmount('');
      await fetchAllData();
      
    } catch (error: any) {
      console.error('Borrow failed:', error);
      toast({
        variant: "destructive",
        title: "Borrow Failed",
        description: error.message || "An error occurred during borrowing",
      });
    } finally {
      setIsBorrowing(false);
    }
  };

  // Harvest and repay function - THE "WOW" MOMENT!
  const handleHarvestAndRepay = async () => {
    if (!account) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please connect your wallet",
      });
      return;
    }

    setIsRepaying(true);
    
    try {
      const transaction: InputTransactionData = {
        data: {
          function: `${MODULE_ADDRESS}::auto_loan_vault::harvest_and_repay`,
          functionArguments: [],
          typeArguments: [],
        },
      };

      const response = await signAndSubmitTransaction(transaction);
      
      toast({
        title: "🎉 Success!",
        description: `Yield harvested and debt repaid! Hash: ${response.hash}`,
      });

      // THE CRITICAL MOMENT: Refresh all data to show the debt decrease
      await fetchAllData();
      
      toast({
        title: "✨ Debt Reduced!",
        description: "Your loan has been automatically repaid with yield!",
      });
      
    } catch (error: any) {
      console.error('Harvest and repay failed:', error);
      toast({
        variant: "destructive",
        title: "Repay Failed",
        description: error.message || "An error occurred during repayment",
      });
    } finally {
      setIsRepaying(false);
    }
  };

  // Fetch all on-chain data
  const fetchAllData = async () => {
    if (!account?.address || !MODULE_ADDRESS) {
      return;
    }

    try {
      setIsLoading(true);
      
      // Fetch user's current debt
      const debtResponse = await aptosClient().view({
        payload: {
          function: `${MODULE_ADDRESS}::auto_loan_vault::get_user_debt`,
          functionArguments: [account.address.toStringLong()],
        },
      });
      
      // Fetch user's locked collateral
      const collateralResponse = await aptosClient().view({
        payload: {
          function: `${MODULE_ADDRESS}::auto_loan_vault::get_user_collateral`,
          functionArguments: [account.address.toStringLong()],
        },
      });
      
      // Fetch pending yield from revolv_vault
      const yieldResponse = await aptosClient().view({
        payload: {
          function: `${MODULE_ADDRESS}::revolv_vault::get_pending_yield`,
          functionArguments: [Number(collateralResponse[0]) || 0],
        },
      });

      // Convert from octas to readable format
      const debtAmount = debtResponse[0] ? Number(debtResponse[0]) / 1000000 : 0; // USDC has 6 decimals
      const collateralAmount = collateralResponse[0] ? Number(collateralResponse[0]) / 100000000 : 0; // rLP has 8 decimals
      const yieldAmount = yieldResponse[0] ? Number(yieldResponse[0]) / 1000000 : 0; // Yield in dollars

      setCurrentDebt(debtAmount);
      setLockedCollateral(collateralAmount);
      setPendingYield(yieldAmount);

    } catch (error) {
      console.error('Failed to fetch auto-loan data:', error);
      // Keep current values on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (connected && account) {
      fetchAllData();
    }
  }, [connected, account]);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Revolv Auto-Loan</h1>
      
      {/* Wallet Connection Status */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Wallet Status</h2>
        {!connected ? (
          <div className="text-orange-600 font-medium">
            ⚠️ Please connect your wallet using the button in the header
          </div>
        ) : (
          <div className="text-green-600 font-medium">
            ✅ Wallet Connected: {account?.address?.toStringLong()?.slice(0, 8)}...
          </div>
        )}
      </Card>

      {/* Deposit and Borrow Interface */}
      {connected && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Deposit Collateral & Borrow</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rlp-collateral">rLP Tokens to Deposit as Collateral</Label>
              <Input
                id="rlp-collateral"
                type="number"
                value={rlpCollateral}
                onChange={(e) => setRlpCollateral(e.target.value)}
                placeholder="Enter rLP amount"
              />
            </div>
            <div>
              <Label htmlFor="borrow-amount">USDC Amount to Borrow</Label>
              <Input
                id="borrow-amount"
                type="number"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                placeholder="Enter USDC amount"
              />
            </div>
            <div className="text-sm text-gray-600">
              <p>• Maximum LTV: 50% (you can borrow up to 50% of your collateral's value)</p>
              <p>• Collateral value: {parseInt(rlpCollateral) * 10} USDC (rLP price: $10)</p>
              <p>• Maximum borrowable: {Math.floor(parseInt(rlpCollateral) * 10 * 0.5)} USDC</p>
            </div>
            <Button 
              onClick={handleDepositAndBorrow} 
              className="w-full"
              disabled={isBorrowing || !rlpCollateral || !borrowAmount || 
                       parseFloat(rlpCollateral) <= 0 || parseFloat(borrowAmount) <= 0}
            >
              {isBorrowing ? 'Processing...' : 'Deposit Collateral & Borrow USDC'}
            </Button>
          </div>
        </Card>
      )}

      {/* Current Debt Display */}
      {connected && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Loan Status</h2>
          {isLoading ? (
            <div className="text-center py-4">
              <div className="text-gray-500">Loading loan data...</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Current Debt:</span>
                <span className="text-3xl font-bold text-red-600">
                  {currentDebt.toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Locked Collateral:</span>
                <span className="text-xl font-semibold text-blue-600">
                  {lockedCollateral.toFixed(2)} rLP
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Pending Yield:</span>
                <span className="text-xl font-semibold text-green-600">
                  {pendingYield.toFixed(2)} USDC
                </span>
              </div>
              <div className="text-sm text-gray-600 mt-4">
                Your loan will automatically repay itself using yield from the Revolv Vault
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Repay with Yield Button - THE "WOW" MOMENT */}
      {connected && currentDebt > 0 && (
        <Card className="p-6 border-2 border-green-200 bg-green-50">
          <h2 className="text-xl font-semibold mb-4 text-green-800">✨ Auto-Repay with Yield</h2>
          <div className="space-y-4">
            <div className="bg-green-100 p-4 rounded-lg">
              <p className="text-green-800 font-medium mb-2">
                🎯 This is the magic moment! Watch your debt decrease in real-time:
              </p>
              <ul className="text-green-700 text-sm space-y-1">
                <li>• Current debt: <span className="font-bold">{currentDebt.toFixed(2)} USDC</span></li>
                <li>• Available yield: <span className="font-bold">{pendingYield.toFixed(2)} USDC</span></li>
                <li>• New debt after repayment: <span className="font-bold">{Math.max(0, currentDebt - pendingYield).toFixed(2)} USDC</span></li>
              </ul>
            </div>
            <Button 
              onClick={handleHarvestAndRepay} 
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 text-lg"
              disabled={isRepaying}
            >
              {isRepaying ? '🔄 Processing...' : '🚀 Repay with Yield'}
            </Button>
            {isRepaying && (
              <div className="text-center text-green-600 font-medium">
                ✨ Harvesting yield and reducing your debt...
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Withdraw Collateral */}
      {connected && currentDebt === 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Withdraw Collateral</h2>
          <div className="space-y-4">
            <p className="text-gray-600">
              Your debt is fully repaid! You can now withdraw your rLP collateral.
            </p>
            <Button className="w-full">
              Withdraw rLP Tokens
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AutoLoanPage;
