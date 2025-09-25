export const NETWORK = import.meta.env.VITE_APP_NETWORK ?? "testnet";
export const MODULE_ADDRESS = import.meta.env.VITE_MODULE_ADDRESS;
export const APTOS_API_KEY = import.meta.env.VITE_APTOS_API_KEY;

// Generate explorer URL for transaction hash
export const getExplorerUrl = (txHash: string) => {
  const baseUrl = NETWORK === "mainnet" 
    ? "https://explorer.aptoslabs.com" 
    : "https://explorer.aptoslabs.com";
  return `${baseUrl}/txn/${txHash}?network=${NETWORK}`;
};
