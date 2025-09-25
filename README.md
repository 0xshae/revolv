# Revolv - Self-Repaying Loans on Aptos, backed by the safety of a diversified liquidity pool

A revolutionary DeFi protocol built on Aptos that combines multi-token liquidity provision with automated lending mechanisms. Users can deposit various tokens (APT, USDC, SUI) into a unified vault, receive rLP tokens, and use them as collateral for automated loans with yield-based repayment.

# Pitch Deck - https://www.canva.com/design/DAGz7nyJg7w/0MXdjse9g2O-fBJw8wSWhQ/edit?utm_content=DAGz7nyJg7w&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton

## Key Features

- **Multi-Token Liquidity Pool**: Deposit APT, USDC, and SUI into a unified vault
- **Proportional LP Token Minting**: Receive rLP tokens based on your contribution to the pool
- **Automated Lending**: Use rLP tokens as collateral to borrow USDC
- **Yield-Based Auto-Repayment**: Loans automatically repay using generated yield
- **Real-Time Price Oracle**: Dynamic pricing for accurate LTV calculations
- **Token Whitelisting**: Secure token management with admin controls

## Architecture Overview

### Core Modules

1. **`revolv_vault`** - Main liquidity vault managing multi-token deposits
2. **`auto_loan_vault`** - Automated lending protocol with collateral management
3. **`oracle`** - Price feed system for token valuations
4. **`message_board`** - Communication layer for protocol updates

### Smart Contract Address
```
0x18ba7f5a68dc720fd3833fa9c2402e22ab899301424c87d41461fa7aa2415a5e
```

## How It Works

### 1. Liquidity Provision
- Users deposit tokens (APT/USDC/SUI) into the vault
- Vault calculates proportional rLP tokens based on current pool value
- rLP tokens represent ownership share in the multi-token pool
- Pool generates yield from various DeFi activities

### 2. Automated Lending
- Users deposit rLP tokens as collateral
- Oracle provides real-time rLP pricing
- Protocol enforces 50% Loan-to-Value (LTV) ratio
- Users can borrow up to 50% of their collateral value in USDC

### 3. Auto-Repayment Mechanism
- Yield generated from the liquidity pool accumulates
- Users can trigger `harvest_and_repay` function
- Yield automatically reduces outstanding debt
- Collateral remains locked until debt is fully repaid

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Aptos CLI
- Wallet with testnet APT

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd revolv-project
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create a `.env` file in the root directory:
```env
VITE_MODULE_ADDRESS=0x18ba7f5a68dc720fd3833fa9c2402e22ab899301424c87d41461fa7aa2415a5e
VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS=0x18ba7f5a68dc720fd3833fa9c2402e22ab899301424c87d41461fa7aa2415a5e
VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY=your_private_key_here
VITE_APP_NETWORK=testnet
VITE_APTOS_API_KEY=your_api_key_here
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to `http://localhost:5173`

## Deployment

### Smart Contract Deployment

1. **Compile the contracts**
```bash
npm run move:compile
```

2. **Publish to Aptos testnet**
```bash
npm run move:publish
```

3. **Initialize the modules**
- Connect your wallet to the frontend
- Navigate to the Liquidity page
- Click "Initialize Modules" to set up the vault and oracle

### Frontend Deployment

1. **Build the project**
```bash
npm run build
```

2. **Deploy to Vercel**
```bash
npm run deploy
```

## Usage Guide

### Providing Liquidity

1. **Connect your wallet** to the application
2. **Navigate to "Provide Liquidity"** page
3. **Select token** from dropdown (APT/USDC/SUI)
4. **Enter deposit amount**
5. **Click "Deposit to Vault"**
6. **Receive rLP tokens** representing your pool share

### Taking a Loan

1. **Navigate to "Auto-Loan"** page
2. **Enter rLP collateral amount** (must own rLP tokens)
3. **Enter USDC borrow amount** (max 50% of collateral value)
4. **Click "Deposit Collateral & Borrow USDC"**
5. **Monitor your loan status** in real-time

### Repaying Debt

1. **Wait for yield to accumulate** in the vault
2. **Click "Harvest & Repay"** button
3. **Yield automatically reduces** your outstanding debt
4. **Withdraw collateral** once debt reaches zero

## Smart Contract Functions

### revolv_vault.move

#### Core Functions
- **`deposit_apt(account, amount)`** - Deposit APT and receive rLP tokens
- **`deposit_usdc(account, amount)`** - Deposit USDC and receive rLP tokens  
- **`deposit_sui(account, amount)`** - Deposit SUI and receive rLP tokens
- **`get_pending_yield(collateral_amount)`** - Calculate yield for given collateral

#### View Functions
- **`get_total_value()`** - Returns total value locked in vault
- **`get_rlp_supply()`** - Returns total rLP tokens in circulation
- **`get_apt_balance()`** - Returns APT balance in vault
- **`get_usdc_balance()`** - Returns USDC balance in vault
- **`get_sui_balance()`** - Returns SUI balance in vault

### auto_loan_vault.move

#### Core Functions
- **`deposit_and_borrow(account, rlp_amount, borrow_amount)`** - Lock rLP as collateral and borrow USDC
- **`harvest_and_repay(account)`** - Use yield to repay outstanding debt
- **`withdraw(account, rlp_amount)`** - Withdraw collateral after debt repayment

#### View Functions
- **`get_user_debt(user_address)`** - Returns user's current debt amount
- **`get_user_collateral(user_address)`** - Returns user's locked collateral
- **`get_user_stored_collateral(user_address)`** - Returns stored collateral amount
- **`get_total_debt()`** - Returns total debt across all users
- **`get_total_collateral()`** - Returns total collateral locked

### oracle.move

#### Core Functions
- **`initialize(account)`** - Initialize the oracle module
- **`get_price(coin_type)`** - Get price for specified token type

## Security Features

- **Token Whitelisting**: Only approved tokens can be deposited
- **LTV Enforcement**: Maximum 50% loan-to-value ratio
- **Admin Controls**: Secure token management functions
- **Input Validation**: Comprehensive parameter validation
- **State Management**: Proper resource initialization checks

## Frontend Features

- **Real-Time Updates**: Live data synchronization across pages
- **Transaction Tracking**: Clickable transaction hashes to Aptos explorer
- **Responsive Design**: Modern, mobile-friendly interface
- **Dark Theme**: Sleek web3 aesthetic with glassmorphism effects
- **Error Handling**: Comprehensive error messages and validation
- **Cross-Page Sync**: Automatic data refresh between liquidity and loan pages

## Technical Stack

### Smart Contracts
- **Move Language**: Aptos native smart contract language
- **Aptos Framework**: Core blockchain functionality
- **Table Storage**: Efficient data management

### Frontend
- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Vite**: Fast build tool and dev server
- **Aptos Wallet Adapter**: Wallet integration

### Development Tools
- **Aptos CLI**: Contract compilation and deployment
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting

## Known Issues

### Smart Contract
- **Module Name Clash**: Occurs when trying to update existing modules (requires new deployment)
- **Token Transfer Simulation**: Current implementation simulates token locking (production would need proper coin store management)
- **Oracle Price Feed**: Currently uses hardcoded prices (production would integrate with real price feeds)

### Frontend
- **State Synchronization**: Occasional delays in cross-page data updates
- **Transaction Timing**: Some transactions may require manual refresh to show updated balances
- **Error Messages**: Generic error messages from wallet adapter (working on more specific error handling)

### General
- **Network Dependency**: Requires stable Aptos testnet connection
- **Wallet Compatibility**: Limited to Aptos-compatible wallets
- **Gas Estimation**: No gas estimation for transactions (users see actual gas costs after execution)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Aptos Labs for the excellent blockchain infrastructure
- Move language community for documentation and examples
- React and TypeScript communities for the robust frontend ecosystem

---

**Built with ❤️ for the Aptos ecosystem**

For questions or support, please open an issue or contact the development team.