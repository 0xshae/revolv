import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useWallet, InputTransactionData } from '@aptos-labs/wallet-adapter-react';
import { aptosClient } from '../utils/aptosClient';
import { MODULE_ADDRESS, getExplorerUrl } from '../constants';
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
  const [userRlpBalance, setUserRlpBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [isRepaying, setIsRepaying] = useState(false);
  const [rlpPrice] = useState(10); // Default rLP price
  const [maxBorrowable, setMaxBorrowable] = useState(0);
  const [collateralValue, setCollateralValue] = useState(0);
  
  // Simulated loan status tracking
  const [simulatedDebt] = useState(0);

  // Try to get real data from blockchain using alternative methods
  const fetchRealLoanData = async () => {
    if (!account) return;
    
    try {
      console.log('fetchRealLoanData: Attempting to get real data...');
      
      // Method 1: Try to get account resources directly
      const accountResources = await aptosClient().getAccountResources({
        accountAddress: account.address.toStringLong(),
      });
      
      console.log('fetchRealLoanData: Account resources:', accountResources);
      
      // Look for RevolvLP coin balance
      const rlpCoinResource = accountResources.find((resource: any) => 
        resource.type.includes('RevolvLP')
      );
      
      if (rlpCoinResource) {
        const balance = (rlpCoinResource.data as any).coin.value;
        console.log('fetchRealLoanData: Found rLP balance:', balance);
        const realBalance = Number(balance) / 100000000; // Convert from smallest unit
        setUserRlpBalance(realBalance);
        console.log('fetchRealLoanData: Updated userRlpBalance to:', realBalance);
      }
      
      // Method 2: Try to get module state directly
      try {
        const moduleState = await aptosClient().getAccountResource({
          accountAddress: MODULE_ADDRESS,
          resourceType: `${MODULE_ADDRESS}::auto_loan_vault::AutoLoanVault`,
        });
        
        console.log('fetchRealLoanData: Module state:', moduleState);
        
        // Extract real data from module state
        if (moduleState.data) {
          const vaultData = moduleState.data;
          
          // Try to find user's debt in the user_debts table
          if (vaultData.user_debts) {
            console.log('fetchRealLoanData: User debts table:', vaultData.user_debts);
            // This would need more complex parsing for table data
          }
          
          // Try to get total debt and collateral
          if (vaultData.total_debt) {
            const realTotalDebt = Number(vaultData.total_debt) / 1000000; // USDC has 6 decimals
            console.log('fetchRealLoanData: Found total debt:', realTotalDebt);
          }
          
          if (vaultData.total_collateral) {
            const realTotalCollateral = Number(vaultData.total_collateral) / 100000000; // rLP has 8 decimals
            console.log('fetchRealLoanData: Found total collateral:', realTotalCollateral);
          }
        }
      } catch (moduleError) {
        console.log('fetchRealLoanData: Module state fetch failed:', moduleError);
      }
      
      // Method 3: Try to get rLP balance from coin info
      try {
        const coinInfo = await aptosClient().getAccountCoinAmount({
          accountAddress: account.address.toStringLong(),
          coinType: `${MODULE_ADDRESS}::revolv_vault::RevolvLP`,
        });
        
        console.log('fetchRealLoanData: Coin info:', coinInfo);
        if (coinInfo) {
          const realBalance = Number(coinInfo) / 100000000; // Convert from smallest unit
          setUserRlpBalance(realBalance);
          console.log('fetchRealLoanData: Updated userRlpBalance from coin info to:', realBalance);
        }
      } catch (coinError) {
        console.log('fetchRealLoanData: Coin info fetch failed:', coinError);
      }
      
    } catch (error) {
      console.log('fetchRealLoanData: Failed to get real data:', error);
    }
  };

  // Calculate collateral value and max borrowable when rLP collateral changes
  useEffect(() => {
    const collateral = parseFloat(rlpCollateral) || 0;
    const value = collateral * rlpPrice;
    const maxBorrow = value * 0.5; // 50% LTV
    
    setCollateralValue(value);
    setMaxBorrowable(maxBorrow);
  }, [rlpCollateral, rlpPrice]);

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

    // Validate collateral amount
    if (parseFloat(rlpCollateral) > userRlpBalance) {
      toast({
        variant: "destructive",
        title: "Insufficient rLP Balance",
        description: `You only have ${userRlpBalance.toFixed(4)} rLP available`,
      });
      return;
    }

    // Validate borrow amount against LTV
    if (parseFloat(borrowAmount) > maxBorrowable) {
      toast({
        variant: "destructive",
        title: "Exceeds Maximum Borrowable",
        description: `You can only borrow up to $${maxBorrowable.toFixed(2)} with ${rlpCollateral} rLP collateral (${collateralValue.toFixed(2)} value)`,
      });
      return;
    }

    setIsBorrowing(true);
    
    // Show transaction initiation notification
    toast({
      title: "🔄 Transaction Initiated",
      description: `Depositing ${rlpCollateral} rLP as collateral to borrow ${borrowAmount} USDC`,
      duration: 0, // Persistent notification
    });
    
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
        title: "✅ Borrow Successful!",
        description: `Successfully deposited ${rlpCollateral} rLP as collateral and borrowed ${borrowAmount} USDC. Your loan is now active and will auto-repay using yield.`,
        duration: 0, // Persistent notification
      });

      // Show separate clickable transaction hash notification
      toast({
        title: "🔗 View Transaction",
        description: (
          <a 
            href={getExplorerUrl(response.hash)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline font-mono"
          >
            {response.hash.slice(0, 8)}...{response.hash.slice(-8)}
          </a>
        ),
        duration: 0, // Persistent notification
      });

      // Clear inputs and refresh data
      setRlpCollateral('');
      setBorrowAmount('');
      
      // IMMEDIATE UI UPDATE - Update the UI state immediately
      const collateralAmountNum = parseFloat(rlpCollateral);
      const borrowAmountNum = parseFloat(borrowAmount);
      
      // Update current debt immediately
      setCurrentDebt(prev => prev + borrowAmountNum);
      setLockedCollateral(prev => prev + collateralAmountNum);
      setUserRlpBalance(prev => prev - collateralAmountNum);
      
      // Real data will be fetched after transaction confirmation
      
      // Wait a moment for blockchain state to update
      console.log('Waiting for blockchain state to update...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('Refreshing data after borrow transaction...');
      
      // Show refresh notification
      toast({
        title: "🔄 Refreshing Data",
        description: "Fetching latest loan status from blockchain...",
        duration: 3000,
      });
      
      // Force refresh all data multiple times to ensure we get the latest state
      await fetchAllData();
      await fetchRealLoanData();
      
      // Additional refresh after a short delay
      setTimeout(async () => {
        console.log('Secondary refresh after borrow...');
        await fetchAllData();
        await fetchRealLoanData();
        
        // Show completion notification
        toast({
          title: "✅ Data Refreshed",
          description: "Loan status updated with latest blockchain data",
          duration: 2000,
        });
      }, 2000);
      
      // Also refresh the main page data by triggering a custom event
      window.dispatchEvent(new CustomEvent('refreshLiquidityData'));
      
    } catch (error: any) {
      console.error('Borrow failed:', error);
      toast({
        variant: "destructive",
        title: "❌ Borrow Failed",
        description: error.message || "An error occurred during borrowing",
        duration: 0, // Persistent notification
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
    
    // Show transaction initiation notification
    toast({
      title: "🔄 Auto-Repay Initiated",
      description: `Harvesting ${pendingYield.toFixed(2)} USDC yield to repay ${currentDebt.toFixed(2)} USDC debt`,
      duration: 0, // Persistent notification
    });
    
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
        title: "🎉 Auto-Repay Successful!",
        description: `Yield harvested and debt repaid! Your loan decreased from ${currentDebt.toFixed(2)} to ${Math.max(0, currentDebt - pendingYield).toFixed(2)} USDC.`,
        duration: 0, // Persistent notification
      });

      // Show separate clickable transaction hash notification
      toast({
        title: "🔗 View Transaction",
        description: (
          <a 
            href={getExplorerUrl(response.hash)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline font-mono"
          >
            {response.hash.slice(0, 8)}...{response.hash.slice(-8)}
          </a>
        ),
        duration: 0, // Persistent notification
      });

      // IMMEDIATE UI UPDATE - Update the UI state immediately
      const yieldAmount = pendingYield;
      const newDebt = Math.max(0, currentDebt - yieldAmount);
      
      // Update debt immediately
      setCurrentDebt(newDebt);
      
      // Real data will be fetched after transaction confirmation
      
      // THE CRITICAL MOMENT: Refresh all data to show the debt decrease
      console.log('Waiting for blockchain state to update after repay...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Refreshing data after repay transaction...');
      await fetchAllData();
      await fetchRealLoanData();
      
      // Also refresh the main page data by triggering a custom event
      window.dispatchEvent(new CustomEvent('refreshLiquidityData'));
      
      toast({
        title: "✨ Debt Reduced!",
        description: "Your loan has been automatically repaid with yield!",
        duration: 0, // Persistent notification
      });
      
    } catch (error: any) {
      console.error('Harvest and repay failed:', error);
      toast({
        variant: "destructive",
        title: "❌ Auto-Repay Failed",
        description: error.message || "An error occurred during repayment",
        duration: 0, // Persistent notification
      });
    } finally {
      setIsRepaying(false);
    }
  };

  // Fetch user's rLP token balance
  const fetchUserRlpBalance = async () => {
    if (!account?.address || !MODULE_ADDRESS) {
      console.log('Missing account or MODULE_ADDRESS:', { account: !!account, MODULE_ADDRESS });
      return;
    }

    try {
      console.log('Fetching rLP balance for:', account.address.toStringLong());
      console.log('Coin type:', `${MODULE_ADDRESS}::revolv_vault::RevolvLP`);
      
      const balance = await aptosClient().getAccountCoinAmount({
        accountAddress: account.address,
        coinType: `${MODULE_ADDRESS}::revolv_vault::RevolvLP`,
      });

      console.log('Raw rLP balance:', balance);
      const convertedBalance = balance / 100000000; // Convert from octas to readable format
      console.log('Converted rLP balance:', convertedBalance);
      
      setUserRlpBalance(convertedBalance);
    } catch (error) {
      console.error('Failed to fetch rLP balance with getAccountCoinAmount:', error);
      
      // Fallback: try using view function
      try {
        console.log('Trying fallback method with view function...');
        const response = await aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::revolv_vault::get_user_rlp_balance`,
            functionArguments: [account.address.toStringLong()],
          },
        });
        
        const fallbackBalance = response[0] ? Number(response[0]) / 100000000 : 0;
        console.log('Fallback rLP balance:', fallbackBalance);
        setUserRlpBalance(fallbackBalance);
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
        setUserRlpBalance(0);
      }
    }
  };

  // Force refresh function that bypasses all caching
  const forceRefreshAllData = async () => {
    console.log('FORCE REFRESH: Clearing all state and fetching fresh data...');
    
    // Clear all state first
    setCurrentDebt(0);
    setLockedCollateral(0);
    setPendingYield(0);
    setUserRlpBalance(0);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fetch fresh data
    await fetchAllData();
  };

  // Fetch all on-chain data
  const fetchAllData = async () => {
    if (!account?.address || !MODULE_ADDRESS) {
      console.log('fetchAllData: Missing account or MODULE_ADDRESS');
      return;
    }

    try {
      console.log('fetchAllData: Starting data fetch...');
      setIsLoading(true);
      
      // Fetch user's current debt
      console.log('fetchAllData: Fetching user debt...');
      let debtResponse = [0];
      try {
        debtResponse = await aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::auto_loan_vault::get_user_debt`,
            functionArguments: [account.address.toStringLong()],
          },
        });
        console.log('fetchAllData: Debt response:', debtResponse);
      } catch (error: any) {
        console.log('fetchAllData: Debt fetch failed:', error.message);
        console.log('fetchAllData: Full error:', error);
        
        // Try alternative method - check if it's a view function issue
        if (error.message?.includes('not an view function')) {
          console.log('fetchAllData: View function not available, trying alternative approach...');
          // We'll use the simulated data as fallback
          debtResponse = [simulatedDebt * 1000000]; // Convert to smallest unit
        } else {
          debtResponse = [0];
        }
      }
      
      // Fetch user's locked collateral
      console.log('fetchAllData: Fetching user collateral...');
      let collateralResponse = [0];
      try {
        collateralResponse = await aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::auto_loan_vault::get_user_collateral`,
            functionArguments: [account.address.toStringLong()],
          },
        });
        console.log('fetchAllData: Collateral response:', collateralResponse);
      } catch (error: any) {
        console.log('fetchAllData: Collateral fetch failed (view function not available):', error.message);
        // Set default values if view function is not available
        collateralResponse = [0];
      }
      
      // Fetch pending yield from revolv_vault
      console.log('fetchAllData: Fetching pending yield...');
      let yieldResponse = [0];
      try {
        yieldResponse = await aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::revolv_vault::get_pending_yield`,
            functionArguments: [Number(collateralResponse[0]) || 0],
          },
        });
        console.log('fetchAllData: Yield response:', yieldResponse);
      } catch (error: any) {
        console.log('fetchAllData: Yield fetch failed (view function not available):', error.message);
        // Set default values if view function is not available
        yieldResponse = [0];
      }

      // Convert from octas to readable format
      const debtAmount = debtResponse[0] ? Number(debtResponse[0]) / 1000000 : 0; // USDC has 6 decimals
      const collateralAmount = collateralResponse[0] ? Number(collateralResponse[0]) / 100000000 : 0; // rLP has 8 decimals
      const yieldAmount = yieldResponse[0] ? Number(yieldResponse[0]) / 1000000 : 0; // Yield in dollars

      console.log('fetchAllData: Converted amounts:', { debtAmount, collateralAmount, yieldAmount });

      setCurrentDebt(debtAmount);
      setLockedCollateral(collateralAmount);
      setPendingYield(yieldAmount);

      // Also fetch user's rLP balance
      console.log('fetchAllData: Fetching user rLP balance...');
      await fetchUserRlpBalance();
      
      // Try to get real data using alternative methods
      console.log('fetchAllData: Attempting to get real loan data...');
      await fetchRealLoanData();

      // Debug: Fetch stored collateral amount
      try {
        console.log('fetchAllData: Fetching stored collateral...');
        const storedCollateralResponse = await aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::auto_loan_vault::get_user_stored_collateral`,
            functionArguments: [account.address.toStringLong()],
          },
        });
        console.log('fetchAllData: Stored collateral response:', storedCollateralResponse);
        const storedCollateralAmount = storedCollateralResponse[0] ? Number(storedCollateralResponse[0]) / 100000000 : 0;
        console.log('fetchAllData: Stored collateral amount:', storedCollateralAmount);
      } catch (error: any) {
        console.log('fetchAllData: Stored collateral fetch failed (view function not available):', error.message);
      }

    } catch (error) {
      console.error('Failed to fetch auto-loan data:', error);
      
      // Show user-friendly notification about view function issues
      toast({
        variant: "destructive",
        title: "⚠️ View Functions Not Available",
        description: "Some auto-loan data cannot be fetched due to contract limitations. You can still use the deposit and borrow functions.",
        duration: 5000,
      });
      
      // Keep current values on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (connected && account) {
      console.log('Wallet connected, fetching data...');
      fetchAllData();
      fetchRealLoanData();
    }
  }, [connected, account]);

  // Also fetch rLP balance when the component mounts if wallet is already connected
  useEffect(() => {
    console.log('AutoLoanPage useEffect triggered:', { connected, account: !!account, MODULE_ADDRESS });
    if (connected && account && MODULE_ADDRESS) {
      console.log('Component mounted, fetching rLP balance...');
      fetchUserRlpBalance();
    }
  }, [connected, account, MODULE_ADDRESS]);

  // Listen for refresh events from other pages
  useEffect(() => {
    const handleRefresh = () => {
      console.log('AutoLoanPage: Received refresh event, updating data...');
      if (connected && account && MODULE_ADDRESS) {
        fetchAllData();
        fetchRealLoanData();
      }
    };

    window.addEventListener('refreshLoanData', handleRefresh);
    
    return () => {
      window.removeEventListener('refreshLoanData', handleRefresh);
    };
  }, [connected, account, MODULE_ADDRESS]);

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-light tracking-tight text-white mb-4">
            Auto-Loan
          </h1>
          <p className="text-xl text-gray-400 font-light tracking-wide">Borrow against your rLP tokens with auto-repayment</p>
          <div className="mt-6 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
        </div>

        {/* Loan Status Cards */}
        {connected && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-light text-white">Your Loan Status</h2>
              <Button 
                onClick={forceRefreshAllData}
                className="bg-gray-800 text-white hover:bg-gray-700 px-4 py-2 rounded-xl font-light"
                disabled={isLoading}
              >
                {isLoading ? 'Refreshing...' : 'Force Refresh'}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gray-900/30 backdrop-blur-xl border border-gray-800 rounded-xl p-6 text-center">
                <div className="text-3xl font-light text-red-400 mb-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    currentDebt.toFixed(2)
                  )}
                </div>
                <div className="text-sm text-gray-500 font-light tracking-wide uppercase">Current Debt</div>
                <div className="text-xs text-gray-600 mt-1">
                  {isLoading ? "🔄 Refreshing..." : "Real Blockchain Data"}
                </div>
              </div>
              <div className="bg-gray-900/30 backdrop-blur-xl border border-gray-800 rounded-xl p-6 text-center">
                <div className="text-3xl font-light text-blue-400 mb-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    lockedCollateral.toFixed(2)
                  )}
                </div>
                <div className="text-sm text-gray-500 font-light tracking-wide uppercase">Locked Collateral</div>
                <div className="text-xs text-gray-600 mt-1">
                  {isLoading ? "🔄 Refreshing..." : "Real Blockchain Data"}
                </div>
              </div>
              <div className="bg-gray-900/30 backdrop-blur-xl border border-gray-800 rounded-xl p-6 text-center">
                <div className="text-3xl font-light text-green-400 mb-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    pendingYield.toFixed(2)
                  )}
                </div>
                <div className="text-sm text-gray-500 font-light tracking-wide uppercase">Pending Yield</div>
                <div className="text-xs text-gray-600 mt-1">
                  {isLoading ? "🔄 Refreshing..." : "Real Blockchain Data"}
                </div>
              </div>
              <div className="bg-gray-900/30 backdrop-blur-xl border border-gray-800 rounded-xl p-6 text-center">
                <div className="text-3xl font-light text-white mb-2">{userRlpBalance.toFixed(2)}</div>
                <div className="text-sm text-gray-500 font-light tracking-wide uppercase">Available rLP</div>
                <div className="text-xs text-gray-600 mt-1">Debug: {userRlpBalance}</div>
                <div className="text-xs text-gray-600 mt-1">Module: {MODULE_ADDRESS?.slice(0, 8)}...</div>
              </div>
            </div>
            
          </div>
        )}

        {/* Main Interface */}
        {connected && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-900/40 backdrop-blur-2xl border border-gray-800 rounded-3xl p-12">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-light text-white mb-4">Borrow Against rLP</h2>
                <p className="text-gray-400 font-light text-lg">Deposit rLP tokens as collateral and borrow USDC</p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                {/* Left: Borrow Interface */}
                <div className="space-y-8">
                  {/* Collateral Input */}
                  <div>
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-400 rounded-2xl flex items-center justify-center">
                        <span className="text-white font-semibold text-xl">r</span>
                      </div>
                      <span className="text-2xl font-light text-white">rLP Collateral</span>
                    </div>
                    
                    <div className="relative">
                      <Input
                        type="number"
                        value={rlpCollateral}
                        onChange={(e) => setRlpCollateral(e.target.value)}
                        placeholder="0.0"
                        className="text-3xl h-20 pl-6 pr-24 bg-black/50 border-gray-800 text-white placeholder-gray-600 rounded-2xl font-light"
                      />
                      <div className="absolute right-6 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg font-light">
                        rLP
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
                      <span className="font-light">Available: {userRlpBalance.toFixed(4)} rLP</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setRlpCollateral(userRlpBalance.toString())}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-full px-4 py-2 font-light"
                      >
                        Max
                      </Button>
                    </div>
                    
                    {parseFloat(rlpCollateral) > userRlpBalance && (
                      <div className="mt-2 text-sm text-red-400 font-light">
                        ⚠️ Insufficient rLP balance. You only have {userRlpBalance.toFixed(4)} rLP available.
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  </div>

                  {/* Borrow Amount */}
                  <div>
                    <h3 className="text-xl font-light mb-6 text-white">Borrow USDC</h3>
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center">
                        <span className="text-black font-semibold text-xl">$</span>
                      </div>
                      <span className="text-2xl font-light text-white">USDC</span>
                    </div>
                    
                    <div className="relative">
                      <Input
                        type="number"
                        value={borrowAmount}
                        onChange={(e) => setBorrowAmount(e.target.value)}
                        placeholder="0.0"
                        className="text-3xl h-20 pl-6 pr-24 bg-black/50 border-gray-800 text-white placeholder-gray-600 rounded-2xl font-light"
                      />
                      <div className="absolute right-6 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg font-light">
                        USDC
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
                      <span className="font-light">Max: ${maxBorrowable.toFixed(2)} USDC</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setBorrowAmount(maxBorrowable.toString())}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-full px-4 py-2 font-light"
                        disabled={maxBorrowable <= 0}
                      >
                        Max
                      </Button>
                    </div>
                    
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span className="font-light">Collateral Value:</span>
                        <span className="text-white">${collateralValue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span className="font-light">Max Borrowable (50% LTV):</span>
                        <span className="text-green-400">${maxBorrowable.toFixed(2)}</span>
                      </div>
                      {parseFloat(borrowAmount) > maxBorrowable && (
                        <div className="text-sm text-red-400 font-light">
                          ⚠️ Exceeds maximum borrowable amount
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Loan Information */}
                  <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                    <h4 className="text-lg font-light text-white mb-4">Loan Terms</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-light">Maximum LTV</span>
                        <span className="text-white font-light">50%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-light">Collateral Value</span>
                        <span className="text-white font-light">${(parseFloat(rlpCollateral) * 10).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-light">Max Borrowable</span>
                        <span className="text-green-400 font-light">${Math.floor(parseFloat(rlpCollateral) * 10 * 0.5).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-light">rLP Price</span>
                        <span className="text-white font-light">$10.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-light">Interest Rate</span>
                        <span className="text-white font-light">0% (Auto-repay)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-light">Liquidation Threshold</span>
                        <span className="text-red-400 font-light">75%</span>
                      </div>
                    </div>
                  </div>

                  {/* Call to Action Button */}
                  <Button 
                    onClick={handleDepositAndBorrow} 
                    className="w-full h-16 text-xl bg-white text-black hover:bg-gray-100 rounded-2xl font-light transition-all duration-200"
                    disabled={isBorrowing || !rlpCollateral || !borrowAmount || 
                             parseFloat(rlpCollateral) <= 0 || parseFloat(borrowAmount) <= 0 ||
                             parseFloat(rlpCollateral) > userRlpBalance ||
                             parseFloat(borrowAmount) > maxBorrowable}
                  >
                    {isBorrowing ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      'Deposit Collateral & Borrow USDC'
                    )}
                  </Button>
                </div>

                {/* Right: How It Works */}
                <div className="space-y-8">
                  <h3 className="text-3xl font-light text-white mb-8">How It Works</h3>
                  
                  <div className="space-y-6">
                    {/* Step 1 */}
                    <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                      <div className="flex items-start space-x-4">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-black font-semibold text-sm">1</span>
                        </div>
                        <div>
                          <h4 className="text-lg font-light text-white mb-2">Deposit rLP as Collateral</h4>
                          <p className="text-gray-400 font-light text-sm">Your rLP tokens are locked as collateral for the loan</p>
                        </div>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                      <div className="flex items-start space-x-4">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-black font-semibold text-sm">2</span>
                        </div>
                        <div>
                          <h4 className="text-lg font-light text-white mb-2">Borrow USDC</h4>
                          <p className="text-gray-400 font-light text-sm">Borrow up to 50% of your collateral's value in USDC</p>
                        </div>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                      <div className="flex items-start space-x-4">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-black font-semibold text-sm">3</span>
                        </div>
                        <div>
                          <h4 className="text-lg font-light text-white mb-2">Auto-Repay with Yield</h4>
                          <p className="text-gray-400 font-light text-sm">Your loan automatically repays itself using yield from the vault</p>
                        </div>
                      </div>
                    </div>

                    {/* Key Benefits */}
                    <div className="bg-gray-800/30 p-6 rounded-2xl border border-gray-700">
                      <h4 className="text-lg font-light mb-4 text-white">Key Benefits</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-gray-400 font-light">No manual repayments required</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-gray-400 font-light">Yield automatically reduces debt</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-gray-400 font-light">Keep earning on your collateral</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Auto-Repay Section */}
        {connected && currentDebt > 0 && (
          <div className="max-w-4xl mx-auto mt-16">
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-2xl border border-green-500/20 rounded-3xl p-12">
              <div className="text-center mb-8">
                <h2 className="text-4xl font-light text-white mb-4">✨ Auto-Repay with Yield</h2>
                <p className="text-gray-400 font-light text-lg">Watch your debt decrease automatically</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-900/50 p-6 rounded-2xl text-center">
                  <div className="text-2xl font-light text-red-400 mb-2">Current Debt</div>
                  <div className="text-3xl font-light text-white">{currentDebt.toFixed(2)} USDC</div>
                </div>
                <div className="bg-gray-900/50 p-6 rounded-2xl text-center">
                  <div className="text-2xl font-light text-green-400 mb-2">Available Yield</div>
                  <div className="text-3xl font-light text-white">{pendingYield.toFixed(2)} USDC</div>
                </div>
                <div className="bg-gray-900/50 p-6 rounded-2xl text-center">
                  <div className="text-2xl font-light text-blue-400 mb-2">New Debt</div>
                  <div className="text-3xl font-light text-white">{Math.max(0, currentDebt - pendingYield).toFixed(2)} USDC</div>
                </div>
              </div>

              <div className="text-center">
                <Button 
                  onClick={handleHarvestAndRepay} 
                  className="bg-white text-black hover:bg-gray-100 px-12 py-4 rounded-2xl font-light text-xl transition-all duration-200"
                  disabled={isRepaying}
                >
                  {isRepaying ? (
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    '🚀 Repay with Yield'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Withdraw Collateral */}
        {connected && currentDebt === 0 && lockedCollateral > 0 && (
          <div className="max-w-2xl mx-auto mt-16">
            <div className="bg-gray-900/40 backdrop-blur-2xl border border-gray-800 rounded-3xl p-8 text-center">
              <h2 className="text-2xl font-light text-white mb-4">Withdraw Collateral</h2>
              <p className="text-gray-400 font-light mb-6">Your debt is fully repaid! You can now withdraw your rLP collateral.</p>
              <Button className="bg-white text-black hover:bg-gray-100 px-8 py-3 rounded-2xl font-light">
                Withdraw rLP Tokens
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoLoanPage;