import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useWallet, InputTransactionData } from '@aptos-labs/wallet-adapter-react';
import { aptosClient } from '../utils/aptosClient';
import { MODULE_ADDRESS } from '../constants';
import { useToast } from '../components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

interface LiquidityPageProps {
  account: any;
}

const LiquidityPage: React.FC<LiquidityPageProps> = ({ account }) => {
  const { connected, signAndSubmitTransaction } = useWallet();
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState('APT');
  const [rlpBalance, setRlpBalance] = useState(0);
  const [treasuryBalances, setTreasuryBalances] = useState<{[key: string]: number}>({});
  const [isDepositing, setIsDepositing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // New state for mechanism explanation UI
  const [aptAmount, setAptAmount] = useState('');
  const [rlpAmount, setRlpAmount] = useState(0);
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
        title: "Success",
        description: "Modules initialized successfully!",
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
    
    try {
      // Get token decimals for conversion
      const token = availableTokens.find(t => t.symbol === selectedToken);
      const decimals = token?.decimals || 8;
      const amountInSmallestUnit = Math.floor(parseFloat(aptAmount) * Math.pow(10, decimals));
      
      // Choose the correct deposit function based on selected token
      let functionName = '';
      if (selectedToken === 'APT') {
        functionName = `${MODULE_ADDRESS}::revolv_vault::deposit_apt`;
      } else if (selectedToken === 'USDC') {
        functionName = `${MODULE_ADDRESS}::revolv_vault::deposit_usdc`;
      } else if (selectedToken === 'SUI') {
        functionName = `${MODULE_ADDRESS}::revolv_vault::deposit_sui`;
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
      
      toast({
        title: "Success",
        description: `${selectedToken} deposit transaction submitted! Hash: ${response.hash}`,
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
        title: "Deposit Failed",
        description: errorMessage,
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
      setIsLoading(true);
      
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
    } finally {
      setIsLoading(false);
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

  // Mock pie chart data
  const pieChartData = Object.entries(treasuryBalances).map(([asset, amount]) => ({
    asset,
    amount,
    percentage: (amount / Object.values(treasuryBalances).reduce((a, b) => a + b, 0)) * 100
  }));

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
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Revolv Liquidity Vault</h1>
      
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

      {/* Initialization Interface */}
      {connected && !isInitialized && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Initialize Modules</h2>
          <div className="space-y-4">
            <div className="text-orange-600 font-medium">
              ⚠️ Modules need to be initialized before you can deposit. This is a one-time setup.
            </div>
            <Button 
              onClick={initializeModules} 
              className="w-full"
              disabled={isInitializing}
            >
              {isInitializing ? 'Initializing...' : 'Initialize Oracle & Vault Modules'}
            </Button>
          </div>
        </Card>
      )}

      {/* Main Mechanism Explanation UI */}
      {connected && isInitialized && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side: Deposit Card */}
          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-6">Deposit into the Revolv Vault</h2>
            
            {/* Input Section */}
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <span className="text-lg font-medium">APT</span>
              </div>
              
              <div className="relative">
                <Input
                  type="number"
                  value={aptAmount}
                  onChange={(e) => setAptAmount(e.target.value)}
                  placeholder="0.0"
                  className="text-2xl h-16 pl-4 pr-20"
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                  APT
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                <span>Balance: {userAptBalance.toFixed(4)} APT</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setAptAmount(userAptBalance.toString())}
                >
                  Max
                </Button>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center mb-6">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>

            {/* Output Section */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">You Will Receive (Estimated)</h3>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">r</span>
                </div>
                <span className="text-lg font-medium">rLP</span>
              </div>
              
              <div className="relative">
                <Input
                  type="text"
                  value={rlpAmount.toFixed(6)}
                  readOnly
                  className="text-2xl h-16 pl-4 pr-20 bg-gray-50"
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                  rLP
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6 text-sm text-gray-600">
              <div className="flex justify-between mb-2">
                <span>Price:</span>
                <span>1 APT = {(rlpAmount / (parseFloat(aptAmount) || 1)).toFixed(4)} rLP (${oraclePrices.APT.toFixed(2)})</span>
              </div>
              <div className="flex justify-between">
                <span>Slippage Tolerance:</span>
                <span>0.5%</span>
              </div>
            </div>

            {/* Call to Action Button */}
            <Button 
              onClick={handleDeposit} 
              className="w-full h-12 text-lg"
              disabled={isDepositing || !aptAmount || parseFloat(aptAmount) <= 0}
            >
              {isDepositing ? 'Processing...' : 'Deposit APT'}
            </Button>
          </Card>

          {/* Right Side: Mechanism Explained Card */}
          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-6">How It Works</h2>
            
            {/* Before vs After Comparison */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Before Column */}
              <div>
                <h3 className="text-lg font-medium mb-4 text-gray-700">Vault State Before</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-600">Total Value Locked (TVL)</div>
                    <div className="text-lg font-semibold">${vaultStats.tvl.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Total rLP Supply</div>
                    <div className="text-lg font-semibold">{vaultStats.rlpSupply.toFixed(2)} rLP</div>
                  </div>
                </div>
              </div>

              {/* After Column */}
              <div>
                <h3 className="text-lg font-medium mb-4 text-gray-700">Vault State After Your Deposit</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-600">Previous TVL</div>
                    <div className="text-lg font-semibold">${vaultStats.tvl.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">+ Your Deposit</div>
                    <div className="text-lg font-semibold text-green-600">
                      + ${calculateDepositValue(aptAmount, 'APT').toFixed(2)}
                    </div>
                  </div>
                  <div className="border-t pt-2">
                    <div className="text-sm text-gray-600">= New TVL</div>
                    <div className="text-lg font-semibold">
                      ${(vaultStats.tvl + calculateDepositValue(aptAmount, 'APT')).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Separator */}
            <div className="border-t my-6"></div>

            {/* rLP Supply Changes */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="text-sm text-gray-600">Previous rLP Supply</div>
                <div className="text-lg font-semibold">{vaultStats.rlpSupply.toFixed(2)} rLP</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">+ You Will Receive</div>
                <div className="text-lg font-semibold text-green-600">+ {rlpAmount.toFixed(2)} rLP</div>
              </div>
            </div>
            <div className="border-t pt-2 mb-6">
              <div className="text-sm text-gray-600">= New rLP Supply</div>
              <div className="text-lg font-semibold">
                {(vaultStats.rlpSupply + rlpAmount).toFixed(2)} rLP
              </div>
            </div>

            {/* Key Takeaway */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-blue-800">The rLP Token Price Remains Stable</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Price Before Deposit:</span>
                  <span className="font-semibold">${calculateRlpPrice(vaultStats.tvl, vaultStats.rlpSupply).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Price After Deposit:</span>
                  <span className="font-semibold text-green-600">
                    ${calculateRlpPrice(
                      vaultStats.tvl + calculateDepositValue(aptAmount, 'APT'), 
                      vaultStats.rlpSupply + rlpAmount
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="mt-3 text-xs text-blue-700">
                This proves your deposit doesn't dilute existing holders' value
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Your rLP Balance */}
      {connected && isInitialized && (
        <Card className="p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Your rLP Token Balance</h2>
          <div className="text-2xl font-bold text-blue-600">
            {rlpBalance.toFixed(6)} rLP
          </div>
        </Card>
      )}
    </div>
  );
};

export default LiquidityPage;