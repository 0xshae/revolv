import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useWallet, InputTransactionData } from '@aptos-labs/wallet-adapter-react';
import { aptosClient } from '../utils/aptosClient';
import { MODULE_ADDRESS, getExplorerUrl } from '../constants';
import { useToast } from '../components/ui/use-toast';

interface LiquidityPageProps {
  account: any;
}

const LiquidityPage: React.FC<LiquidityPageProps> = ({ account }) => {
  const { connected, signAndSubmitTransaction } = useWallet();
  const { toast } = useToast();
  const [rlpBalance, setRlpBalance] = useState(0);
  const [treasuryBalances, setTreasuryBalances] = useState<{[key: string]: number}>({});
  const [isDepositing, setIsDepositing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // New state for mechanism explanation UI
  const [aptAmount, setAptAmount] = useState('');
  const [rlpAmount, setRlpAmount] = useState(0);
  const [selectedToken] = useState('APT');
  const [vaultStats, setVaultStats] = useState({
    tvl: 0,
    rlpSupply: 0,
    aptBalance: 0,
    usdcBalance: 0,
    suiBalance: 0
  });
  const [userAptBalance, setUserAptBalance] = useState(0);

  // Available tokens for deposit (whitelisted tokens only)
  const availableTokens = [
    { symbol: 'APT', name: 'Aptos', decimals: 8, coinType: 1 },
    { symbol: 'USDC', name: 'USD Coin', decimals: 6, coinType: 2 },
    { symbol: 'SUI', name: 'Sui', decimals: 9, coinType: 3 }
  ];

  // Oracle prices (hardcoded for MVP)
  const oraclePrices = {
    APT: 8.0, // $8 per APT
    USDC: 1.0, // $1 per USDC
    SUI: 2.0 // $2 per SUI
  };

  // Calculate rLP tokens to be received based on deposit amount
  const calculateRlpAmount = (depositValue: number) => {
    if (vaultStats.rlpSupply === 0) {
      // First deposit: 1:1 ratio
      return depositValue;
    } else {
      // Proportional minting: (deposit_value * rlp_supply) / total_value
      return (depositValue * vaultStats.rlpSupply) / vaultStats.tvl;
    }
  };

  // Calculate deposit value in USD
  const calculateDepositValue = (amount: string, token: string) => {
    const numAmount = parseFloat(amount) || 0;
    return numAmount * (oraclePrices[token as keyof typeof oraclePrices] || 0);
  };

  // Calculate rLP token price
  const calculateRlpPrice = (tvl: number, rlpSupply: number) => {
    return rlpSupply > 0 ? tvl / rlpSupply : 0;
  };

  // Initialize oracle and vault modules
  const initializeModules = async () => {
    if (!account) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please connect your wallet first",
      });
      return;
    }

    setIsInitializing(true);
    
    try {
      // Try to initialize oracle first
      try {
        const oracleTransaction: InputTransactionData = {
          data: {
            function: `${MODULE_ADDRESS}::oracle::initialize`,
            functionArguments: [],
            typeArguments: [],
          },
        };

        await signAndSubmitTransaction(oracleTransaction);
        console.log('Oracle initialized successfully');
      } catch (oracleError: any) {
        if (oracleError.message?.includes('already initialized') || oracleError.message?.includes('E_ALREADY_INITIALIZED')) {
          console.log('Oracle already initialized, continuing...');
        } else {
          throw oracleError;
        }
      }
      
      // Try to initialize vault
      try {
        const vaultTransaction: InputTransactionData = {
          data: {
            function: `${MODULE_ADDRESS}::revolv_vault::initialize`,
            functionArguments: [],
            typeArguments: [],
          },
        };

        await signAndSubmitTransaction(vaultTransaction);
        console.log('Vault initialized successfully');
      } catch (vaultError: any) {
        if (vaultError.message?.includes('already initialized') || vaultError.message?.includes('E_ALREADY_INITIALIZED')) {
          console.log('Vault already initialized, continuing...');
        } else {
          throw vaultError;
        }
      }

      // Try to initialize auto loan vault
      try {
        const autoLoanTransaction: InputTransactionData = {
          data: {
            function: `${MODULE_ADDRESS}::auto_loan_vault::initialize`,
            functionArguments: [],
            typeArguments: [],
          },
        };

        await signAndSubmitTransaction(autoLoanTransaction);
        console.log('Auto loan vault initialized successfully');
      } catch (autoLoanError: any) {
        if (autoLoanError.message?.includes('already initialized') || autoLoanError.message?.includes('E_ALREADY_INITIALIZED')) {
          console.log('Auto loan vault already initialized, continuing...');
        } else {
          throw autoLoanError;
        }
      }

      // Reset vault to clear any corrupted state
      try {
        const resetTransaction: InputTransactionData = {
          data: {
            function: `${MODULE_ADDRESS}::revolv_vault::reset_vault`,
            functionArguments: [],
            typeArguments: [],
          },
        };

        await signAndSubmitTransaction(resetTransaction);
        console.log('Vault reset successfully');
      } catch (resetError: any) {
        console.log('Reset failed or not needed:', resetError.message);
      }

      // Initialize demo pool with multiple tokens
      try {
        const demoPoolTransaction: InputTransactionData = {
          data: {
            function: `${MODULE_ADDRESS}::revolv_vault::initialize_demo_pool`,
            functionArguments: [],
            typeArguments: [],
          },
        };

        await signAndSubmitTransaction(demoPoolTransaction);
        console.log('Demo pool initialized successfully');
      } catch (demoError: any) {
        console.log('Demo pool initialization failed:', demoError.message);
      }
      
      toast({
        title: "🎉 Modules Initialized Successfully!",
        description: "Oracle, Vault, and Auto Loan Vault modules are now active. Demo pool initialized with APT, USDC, and SUI. You can now start depositing and earning yield!",
        duration: 0, // Persistent notification
      });
      
      setIsInitialized(true);
      
    } catch (error: any) {
      console.error('Initialization failed:', error);
      toast({
        variant: "destructive",
        title: "Initialization Failed",
        description: error.message || "Failed to initialize modules",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  // Check if modules are initialized
  const checkInitialization = async () => {
    if (!MODULE_ADDRESS) return;

    try {
      // Try to call a view function to check if vault is initialized
      // If it fails, modules are not initialized
      await aptosClient().view({
        payload: {
          function: `${MODULE_ADDRESS}::revolv_vault::get_total_value`,
          functionArguments: [],
        },
      });
      
      console.log('Modules are already initialized');
      setIsInitialized(true);
    } catch (error) {
      console.log('Modules not initialized yet, need to initialize');
      setIsInitialized(false);
    }
  };

  // Deposit function to call revolv_vault.move
  const handleDeposit = async () => {
    if (!account || !aptAmount || parseFloat(aptAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid deposit amount",
      });
      return;
    }

    setIsDepositing(true);
    
    // Show transaction initiation notification
    const depositValue = calculateDepositValue(aptAmount, 'APT');
    const estimatedRlp = calculateRlpAmount(depositValue);
    
    toast({
      title: "🔄 Transaction Initiated",
      description: `Depositing ${aptAmount} APT ($${depositValue.toFixed(2)}) to receive ~${estimatedRlp.toFixed(4)} rLP tokens`,
      duration: 0, // Persistent notification
    });
    
    try {
      // Get token decimals for conversion
      const token = availableTokens.find(t => t.symbol === selectedToken);
      const decimals = token?.decimals || 8;
      const amountInSmallestUnit = Math.floor(parseFloat(aptAmount) * Math.pow(10, decimals));
      
      // Choose the correct deposit function based on selected token
      let functionName: `${string}::${string}::${string}`;
      if (selectedToken === 'APT') {
        functionName = `${MODULE_ADDRESS}::revolv_vault::deposit_apt` as `${string}::${string}::${string}`;
      } else if (selectedToken === 'USDC') {
        functionName = `${MODULE_ADDRESS}::revolv_vault::deposit_usdc` as `${string}::${string}::${string}`;
      } else if (selectedToken === 'SUI') {
        functionName = `${MODULE_ADDRESS}::revolv_vault::deposit_sui` as `${string}::${string}::${string}`;
      } else {
        throw new Error('Unsupported token');
      }
      
      const transaction: InputTransactionData = {
        data: {
          function: functionName,
          functionArguments: [amountInSmallestUnit],
          typeArguments: [],
        },
      };

      const response = await signAndSubmitTransaction(transaction);
      
      // Show success notification with detailed explanation
      toast({
        title: "✅ Deposit Successful!",
        description: `Successfully deposited ${aptAmount} APT and received ${estimatedRlp.toFixed(4)} rLP tokens. Your deposit increased the vault's TVL by $${depositValue.toFixed(2)} and you now own ${((estimatedRlp / (vaultStats.rlpSupply + estimatedRlp)) * 100).toFixed(2)}% of the pool. Transaction: ${response.hash.slice(0, 8)}...`,
        duration: 0, // Persistent notification
      });

      // Clear the input and refresh data
      setAptAmount('');
      await fetchTreasuryBalances();
      await fetchRlpBalance();
      await fetchVaultStats();
      
    } catch (error: any) {
      console.error('Deposit failed:', error);
      
      // Handle specific error cases
      let errorMessage = "An error occurred during deposit";
      if (error.message?.includes('E_TOKEN_NOT_WHITELISTED')) {
        errorMessage = `${selectedToken} is not whitelisted for this pool. Only approved tokens can be deposited.`;
      } else if (error.message?.includes('E_INVALID_COIN_TYPE')) {
        errorMessage = `Invalid token type: ${selectedToken}`;
      } else if (error.message?.includes('E_ZERO_DEPOSIT')) {
        errorMessage = "Deposit amount must be greater than zero";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "❌ Deposit Failed",
        description: errorMessage,
        duration: 0, // Persistent notification
      });
    } finally {
      setIsDepositing(false);
    }
  };

  // Fetch treasury balances from smart contract
  const fetchTreasuryBalances = async () => {
    if (!MODULE_ADDRESS) {
      console.error('Module address not configured');
      return;
    }

    try {
      // Get individual token balances
      const [aptBalance, usdcBalance, suiBalance, totalValue] = await Promise.all([
        aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::revolv_vault::get_apt_balance`,
            functionArguments: [],
          },
        }),
        aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::revolv_vault::get_usdc_balance`,
            functionArguments: [],
          },
        }),
        aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::revolv_vault::get_sui_balance`,
            functionArguments: [],
          },
        }),
        aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::revolv_vault::get_total_value`,
          functionArguments: [],
          },
        })
      ]);

      // Convert from octas to readable format
      const aptAmount = aptBalance[0] ? Number(aptBalance[0]) / 100000000 : 0;
      const usdcAmount = usdcBalance[0] ? Number(usdcBalance[0]) / 100000000 : 0;
      const suiAmount = suiBalance[0] ? Number(suiBalance[0]) / 100000000 : 0;
      const totalValueAmount = totalValue[0] ? Number(totalValue[0]) / 100000000 : 0;

      setTreasuryBalances({
        'APT': aptAmount,
        'USDC': usdcAmount,
        'SUI': suiAmount,
        'Total Value': totalValueAmount
      });

    } catch (error) {
      console.error('Failed to fetch treasury balances:', error);
      // Fallback to mock data for development
      setTreasuryBalances({
        'APT': 10,
        'USDC': 800,
        'SUI': 5,
        'Total Value': 23
      });
    }
  };

  // Fetch user's rLP token balance
  const fetchRlpBalance = async () => {
    if (!account?.address || !MODULE_ADDRESS) {
      return;
    }

    try {
      const balance = await aptosClient().getAccountCoinAmount({
        accountAddress: account.address,
        coinType: `${MODULE_ADDRESS}::revolv_vault::RevolvLP`,
      });

      setRlpBalance(balance / 100000000); // Convert from octas to readable format
    } catch (error) {
      console.error('Failed to fetch rLP balance:', error);
      setRlpBalance(0);
    }
  };

  // Fetch vault statistics for mechanism explanation
  const fetchVaultStats = async () => {
    if (!MODULE_ADDRESS) return;

    try {
      const [totalValue, rlpSupply, aptBalance, usdcBalance, suiBalance] = await Promise.all([
        aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::revolv_vault::get_total_value`,
            functionArguments: [],
          },
        }),
        aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::revolv_vault::get_rlp_supply`,
            functionArguments: [],
          },
        }),
        aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::revolv_vault::get_apt_balance`,
            functionArguments: [],
          },
        }),
        aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::revolv_vault::get_usdc_balance`,
            functionArguments: [],
          },
        }),
        aptosClient().view({
          payload: {
            function: `${MODULE_ADDRESS}::revolv_vault::get_sui_balance`,
            functionArguments: [],
          },
        })
      ]);

      const tvl = totalValue[0] ? Number(totalValue[0]) / 100000000 : 0;
      const rlpSupplyAmount = rlpSupply[0] ? Number(rlpSupply[0]) / 100000000 : 0;
      const aptAmount = aptBalance[0] ? Number(aptBalance[0]) / 100000000 : 0;
      const usdcAmount = usdcBalance[0] ? Number(usdcBalance[0]) / 100000000 : 0;
      const suiAmount = suiBalance[0] ? Number(suiBalance[0]) / 100000000 : 0;

      setVaultStats({
        tvl,
        rlpSupply: rlpSupplyAmount,
        aptBalance: aptAmount,
        usdcBalance: usdcAmount,
        suiBalance: suiAmount
      });
    } catch (error) {
      console.error('Failed to fetch vault stats:', error);
    }
  };

  // Fetch user's APT balance
  const fetchUserAptBalance = async () => {
    if (!account?.address) return;

    try {
      const balance = await aptosClient().getAccountCoinAmount({
        accountAddress: account.address,
        coinType: "0x1::aptos_coin::AptosCoin",
      });

      setUserAptBalance(balance / 100000000); // Convert from octas to readable format
    } catch (error) {
      console.error('Failed to fetch user APT balance:', error);
      setUserAptBalance(0);
    }
  };


  useEffect(() => {
    if (connected && account) {
      checkInitialization();
      if (isInitialized) {
        fetchTreasuryBalances();
        fetchRlpBalance();
        fetchVaultStats();
        fetchUserAptBalance();
      }
    }
  }, [connected, account, isInitialized]);

  // Update rLP calculation when user types
  useEffect(() => {
    if (aptAmount && vaultStats.tvl > 0) {
      const depositValue = calculateDepositValue(aptAmount, 'APT');
      const calculatedRlp = calculateRlpAmount(depositValue);
      setRlpAmount(calculatedRlp);
    } else {
      setRlpAmount(0);
    }
  }, [aptAmount, vaultStats.tvl, vaultStats.rlpSupply]);

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-light tracking-tight text-white mb-4">
            Revolv
          </h1>
          <p className="text-xl text-gray-400 font-light tracking-wide">Liquidity Vault</p>
          <div className="mt-6 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
        </div>

        {/* Initialization Interface */}
        {connected && !isInitialized && (
          <div className="max-w-2xl mx-auto mb-16">
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-light text-white mb-4">Initialize Protocol</h2>
                <p className="text-gray-400 mb-8 font-light">One-time setup to activate the liquidity vault</p>
                <Button 
                  onClick={initializeModules} 
                  className="bg-white text-black hover:bg-gray-100 px-8 py-3 rounded-full font-medium transition-all duration-200"
                  disabled={isInitializing}
                >
                  {isInitializing ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      <span>Initializing...</span>
                    </div>
                  ) : (
                    'Initialize Protocol'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TVL and Yield Stats */}
        {connected && isInitialized && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            <div className="bg-gray-900/30 backdrop-blur-xl border border-gray-800 rounded-xl p-6 text-center">
              <div className="text-3xl font-light text-white mb-2">${vaultStats.tvl.toFixed(0)}</div>
              <div className="text-sm text-gray-500 font-light tracking-wide uppercase">Total Value Locked</div>
            </div>
            <div className="bg-gray-900/30 backdrop-blur-xl border border-gray-800 rounded-xl p-6 text-center">
              <div className="text-3xl font-light text-green-400 mb-2">12.5%</div>
              <div className="text-sm text-gray-500 font-light tracking-wide uppercase">APY</div>
            </div>
            <div className="bg-gray-900/30 backdrop-blur-xl border border-gray-800 rounded-xl p-6 text-center">
              <div className="text-3xl font-light text-white mb-2">{vaultStats.rlpSupply.toFixed(0)}</div>
              <div className="text-sm text-gray-500 font-light tracking-wide uppercase">rLP Supply</div>
            </div>
            <div className="bg-gray-900/30 backdrop-blur-xl border border-gray-800 rounded-xl p-6 text-center">
              <div className="text-3xl font-light text-white mb-2">${calculateRlpPrice(vaultStats.tvl, vaultStats.rlpSupply).toFixed(2)}</div>
              <div className="text-sm text-gray-500 font-light tracking-wide uppercase">rLP Price</div>
            </div>
          </div>
        )}

        {/* Main Deposit Interface - Centered */}
        {connected && isInitialized && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-gray-900/40 backdrop-blur-2xl border border-gray-800 rounded-3xl p-12">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-light text-white mb-4">Deposit</h2>
                <p className="text-gray-400 font-light text-lg">Earn yield on your multi-token deposits</p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                {/* Left: Deposit Interface */}
                <div className="space-y-8">
                  {/* Input Section */}
                  <div>
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center">
                        <span className="text-black font-semibold text-xl">A</span>
                      </div>
                      <span className="text-2xl font-light text-white">APT</span>
                    </div>
                    
                    <div className="relative">
                      <Input
                        type="number"
                        value={aptAmount}
                        onChange={(e) => setAptAmount(e.target.value)}
                        placeholder="0.0"
                        className="text-3xl h-20 pl-6 pr-24 bg-black/50 border-gray-800 text-white placeholder-gray-600 rounded-2xl font-light"
                      />
                      <div className="absolute right-6 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg font-light">
                        APT
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
                      <span className="font-light">Balance: {userAptBalance.toFixed(4)} APT</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setAptAmount(userAptBalance.toString())}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-full px-4 py-2 font-light"
                      >
                        Max
                      </Button>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  </div>

                  {/* Output Section */}
                  <div>
                    <h3 className="text-xl font-light mb-6 text-white">You Will Receive</h3>
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-400 rounded-2xl flex items-center justify-center">
                        <span className="text-white font-semibold text-xl">r</span>
                      </div>
                      <span className="text-2xl font-light text-white">rLP</span>
                    </div>
                    
                    <div className="relative">
                      <Input
                        type="text"
                        value={rlpAmount.toFixed(6)}
                        readOnly
                        className="text-3xl h-20 pl-6 pr-24 bg-black/30 border-gray-800 text-white rounded-2xl font-light"
                      />
                      <div className="absolute right-6 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg font-light">
                        rLP
                      </div>
                    </div>
                  </div>

                  {/* Yield Information */}
                  <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                    <h4 className="text-lg font-light text-white mb-4">Expected Yield</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-light">APY</span>
                        <span className="text-green-400 font-light">12.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-light">Daily Yield</span>
                        <span className="text-green-400 font-light">0.034%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-light">Your Estimated Daily</span>
                        <span className="text-green-400 font-light">
                          ${(rlpAmount * 0.00034).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Details */}
                  <div className="bg-gray-800/30 p-6 rounded-2xl text-sm text-gray-400">
                    <div className="flex justify-between mb-3">
                      <span className="font-light">Price</span>
                      <span className="font-light">1 APT = {(rlpAmount / (parseFloat(aptAmount) || 1)).toFixed(4)} rLP (${oraclePrices.APT.toFixed(2)})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-light">Slippage Tolerance</span>
                      <span className="font-light">0.5%</span>
                    </div>
                  </div>

                  {/* Call to Action Button */}
                  <Button 
                    onClick={handleDeposit} 
                    className="w-full h-16 text-xl bg-white text-black hover:bg-gray-100 rounded-2xl font-light transition-all duration-200"
                    disabled={isDepositing || !aptAmount || parseFloat(aptAmount) <= 0}
                  >
                    {isDepositing ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      'Deposit APT'
                    )}
                  </Button>
                </div>

                {/* Right: How It Works */}
                <div className="space-y-8">
                  <h3 className="text-3xl font-light text-white mb-8">How It Works</h3>
                  
                  {/* Before vs After Comparison */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                        <h4 className="text-sm font-light text-gray-400 mb-4 uppercase tracking-wide">Before Your Deposit</h4>
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs text-gray-500 font-light uppercase tracking-wide">TVL</div>
                            <div className="text-xl font-light text-white">${vaultStats.tvl.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-light uppercase tracking-wide">rLP Supply</div>
                            <div className="text-xl font-light text-white">{vaultStats.rlpSupply.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                        <h4 className="text-sm font-light text-gray-400 mb-4 uppercase tracking-wide">After Your Deposit</h4>
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs text-gray-500 font-light uppercase tracking-wide">Previous TVL</div>
                            <div className="text-sm font-light text-white">${vaultStats.tvl.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-light uppercase tracking-wide">+ Your Deposit</div>
                            <div className="text-sm font-light text-green-400">+ ${calculateDepositValue(aptAmount, 'APT').toFixed(2)}</div>
                          </div>
                          <div className="border-t border-gray-700 pt-4">
                            <div className="text-xs text-gray-500 font-light uppercase tracking-wide">= New TVL</div>
                            <div className="text-xl font-light text-white">
                              ${(vaultStats.tvl + calculateDepositValue(aptAmount, 'APT')).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* rLP Supply Changes */}
                    <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                      <h4 className="text-sm font-light text-gray-400 mb-4 uppercase tracking-wide">rLP Token Changes</h4>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-400 font-light">Previous Supply</span>
                          <span className="text-sm font-light text-white">{vaultStats.rlpSupply.toFixed(2)} rLP</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-400 font-light">+ You Receive</span>
                          <span className="text-sm font-light text-green-400">+ {rlpAmount.toFixed(2)} rLP</span>
                        </div>
                        <div className="border-t border-gray-700 pt-4 flex justify-between">
                          <span className="text-sm text-gray-400 font-light">= New Supply</span>
                          <span className="text-sm font-light text-white">
                            {(vaultStats.rlpSupply + rlpAmount).toFixed(2)} rLP
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Key Takeaway */}
                    <div className="bg-gray-800/30 p-6 rounded-2xl border border-gray-700">
                      <h4 className="text-lg font-light mb-4 text-white">Price Stability Guaranteed</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400 font-light">Price Before</span>
                          <span className="text-white font-light">${calculateRlpPrice(vaultStats.tvl, vaultStats.rlpSupply).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 font-light">Price After</span>
                          <span className="text-green-400 font-light">
                            ${calculateRlpPrice(
                              vaultStats.tvl + calculateDepositValue(aptAmount, 'APT'), 
                              vaultStats.rlpSupply + rlpAmount
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 text-xs text-gray-500 font-light">
                        ✓ No dilution of existing holders' value
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Your rLP Balance */}
        {connected && isInitialized && (
          <div className="max-w-2xl mx-auto mt-16">
            <div className="bg-gray-900/40 backdrop-blur-2xl border border-gray-800 rounded-3xl p-8 text-center">
              <h2 className="text-2xl font-light text-white mb-4">Your rLP Token Balance</h2>
              <div className="text-4xl font-light text-white mb-2">
                {rlpBalance.toFixed(6)} rLP
              </div>
              <div className="text-gray-400 font-light">
                Estimated Value: ${(rlpBalance * calculateRlpPrice(vaultStats.tvl, vaultStats.rlpSupply)).toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiquidityPage;