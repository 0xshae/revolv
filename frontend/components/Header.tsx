import { WalletSelector } from "./WalletSelector";

export function Header() {
  return (
    <div className="flex items-center justify-between px-6 py-6 max-w-screen-xl mx-auto w-full flex-wrap">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-light text-white tracking-tight">Revolv</h1>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <WalletSelector />
      </div>
    </div>
  );
}
