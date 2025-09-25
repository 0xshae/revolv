import { WalletSelector } from "./WalletSelector";

export function Header() {
  return (
    <div className="flex items-center justify-between px-4 py-2 max-w-screen-xl mx-auto w-full flex-wrap">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-blue-600">Revolv</h1>
        <span className="text-sm text-gray-500">DeFi Protocol</span>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <WalletSelector />
      </div>
    </div>
  );
}
