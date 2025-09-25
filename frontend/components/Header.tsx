import { WalletSelector } from "./WalletSelector";

interface HeaderProps {
  onNavigateToLiquidity?: () => void;
}

export function Header({ onNavigateToLiquidity }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-6 max-w-screen-xl mx-auto w-full flex-wrap">
      <div className="flex items-center gap-4">
        <button 
          onClick={onNavigateToLiquidity}
          className="text-3xl font-light text-white tracking-tight hover:text-gray-300 transition-colors cursor-pointer"
        >
          Revolv
        </button>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <WalletSelector />
      </div>
    </div>
  );
}
