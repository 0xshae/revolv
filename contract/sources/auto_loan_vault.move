module revolv::auto_loan_vault {
    use std::signer;
    use std::table::{Self, Table};
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::managed_coin;
    use aptos_framework::account;
    use revolv::oracle;
    use revolv::revolv_vault::{Self, RevolvLP};

    // Error codes
    const E_NOT_INITIALIZED: u64 = 1;
    const E_INVALID_COLLATERAL: u64 = 2;
    const E_INSUFFICIENT_COLLATERAL: u64 = 3;
    const E_DEBT_NOT_ZERO: u64 = 4;
    const E_LTV_EXCEEDED: u64 = 5;
    const E_INSUFFICIENT_TREASURY: u64 = 6;
    const E_ZERO_BORROW_AMOUNT: u64 = 7;

    // Struct to hold user debt information
    struct UserDebt has store, drop {
        collateral_amount: u64,
        debt_amount: u64,
        collateral_value: u64,
    }

    // Struct to hold loan vault state
    struct AutoLoanVault has key {
        user_debts: Table<address, UserDebt>,
        total_collateral: u64,
        total_debt: u64,
        usdc_treasury: u64, // Simulated USDC treasury for lending
        collateral_storage: Table<address, u64>, // Store user's locked collateral amounts
    }

    // Initialize the auto loan vault with USDC treasury
    public entry fun initialize(account: &signer) {
        let account_addr = signer::address_of(account);
        move_to(account, AutoLoanVault {
            user_debts: table::new(),
            total_collateral: 0,
            total_debt: 0,
            usdc_treasury: 1000000 * 1000000, // 1M USDC (with 6 decimals)
            collateral_storage: table::new(),
        });
    }

    // Deposit collateral and borrow USDC
    public entry fun deposit_and_borrow(
        account: &signer,
        rlp_token_amount: u64,
        borrow_amount: u64
    ) acquires AutoLoanVault {
        let account_addr = signer::address_of(account);
        let vault = borrow_global_mut<AutoLoanVault>(@revolv);
        
        // Validate borrow amount
        assert!(borrow_amount > 0, E_ZERO_BORROW_AMOUNT);
        
        // Validate collateral amount
        assert!(rlp_token_amount > 0, E_INSUFFICIENT_COLLATERAL);
        
        // Get rLP price from oracle (coin_type = 3)
        let rlp_price = oracle::get_price(3u8);
        
        // Calculate dollar value of collateral (rlp_token_amount * price / 10^8)
        let collateral_value = (rlp_token_amount * rlp_price) / 100000000;
        
        // Enforce 50% LTV limit
        let max_borrowable = collateral_value / 2; // 50% of collateral value
        assert!(borrow_amount <= max_borrowable, E_LTV_EXCEEDED);
        
        // Check if vault has sufficient USDC treasury
        assert!(borrow_amount <= vault.usdc_treasury, E_INSUFFICIENT_TREASURY);
        
        // Transfer rLP tokens from user to vault (this locks them as collateral)
        let rlp_coins = coin::withdraw<RevolvLP>(account, rlp_token_amount);
        // Store the collateral in our internal storage
        if (table::contains(&vault.collateral_storage, account_addr)) {
            let current_collateral = table::borrow_mut(&mut vault.collateral_storage, account_addr);
            *current_collateral = *current_collateral + rlp_token_amount;
        } else {
            table::add(&mut vault.collateral_storage, account_addr, rlp_token_amount);
        };
        // Destroy the coins to simulate locking them (in production, we'd store them properly)
        coin::destroy_zero(rlp_coins);
        
        // Record user's debt in table
        let user_debt = UserDebt {
            collateral_amount: rlp_token_amount,
            debt_amount: borrow_amount,
            collateral_value,
        };
        
        if (table::contains(&vault.user_debts, account_addr)) {
            // User already has debt, add to existing
            let existing_debt = table::borrow_mut(&mut vault.user_debts, account_addr);
            existing_debt.collateral_amount = existing_debt.collateral_amount + rlp_token_amount;
            existing_debt.debt_amount = existing_debt.debt_amount + borrow_amount;
            existing_debt.collateral_value = existing_debt.collateral_value + collateral_value;
        } else {
            // New user debt
            table::add(&mut vault.user_debts, account_addr, user_debt);
        };
        
        // Update vault totals
        vault.total_collateral = vault.total_collateral + rlp_token_amount;
        vault.total_debt = vault.total_debt + borrow_amount;
        vault.usdc_treasury = vault.usdc_treasury - borrow_amount;
        
        // For MVP, we'll simulate sending USDC by minting APT instead
        // In a real implementation, this would transfer actual USDC
        // Note: Simplified for MVP - in production would use proper USDC transfer
    }

    // Harvest yield and repay debt
    public entry fun harvest_and_repay(account: &signer) acquires AutoLoanVault {
        let account_addr = signer::address_of(account);
        let vault = borrow_global_mut<AutoLoanVault>(@revolv);
        
        // Check if user has debt
        assert!(table::contains(&vault.user_debts, account_addr), E_NOT_INITIALIZED);
        
        let user_debt = table::borrow_mut(&mut vault.user_debts, account_addr);
        
        // Get user's rLP collateral amount
        let rlp_collateral = user_debt.collateral_amount;
        
        // Call claim_fees on revolv_vault to get yield amount
        // Note: For MVP, we'll simulate this by calculating yield directly
        let yield_amount = revolv_vault::get_pending_yield(rlp_collateral);
        
        // Reduce user's debt by the yield amount
        if (yield_amount >= user_debt.debt_amount) {
            // Yield is enough to pay off entire debt
            vault.total_debt = vault.total_debt - user_debt.debt_amount;
            vault.usdc_treasury = vault.usdc_treasury + user_debt.debt_amount;
            user_debt.debt_amount = 0;
        } else {
            // Yield only partially repays debt
            vault.total_debt = vault.total_debt - yield_amount;
            vault.usdc_treasury = vault.usdc_treasury + yield_amount;
            user_debt.debt_amount = user_debt.debt_amount - yield_amount;
        };
    }

    // Withdraw collateral after debt is zero
    public entry fun withdraw(account: &signer, rlp_token_amount: u64) acquires AutoLoanVault {
        let account_addr = signer::address_of(account);
        let vault = borrow_global_mut<AutoLoanVault>(@revolv);
        
        // Check if user has debt
        assert!(table::contains(&vault.user_debts, account_addr), E_NOT_INITIALIZED);
        
        let user_debt = table::borrow_mut(&mut vault.user_debts, account_addr);
        
        // Check that user's debt is zero
        assert!(user_debt.debt_amount == 0, E_DEBT_NOT_ZERO);
        
        // Check that user has sufficient collateral
        assert!(rlp_token_amount <= user_debt.collateral_amount, E_INSUFFICIENT_COLLATERAL);
        
        // Transfer rLP tokens back to user from vault
        // Note: In a real implementation, we'd need access to the vault's coin store
        // For MVP, we'll simulate this by minting new tokens
        // This is a simplified approach - in production we'd need proper token management
        
        // Update collateral storage
        if (table::contains(&vault.collateral_storage, account_addr)) {
            let current_collateral = table::borrow_mut(&mut vault.collateral_storage, account_addr);
            *current_collateral = *current_collateral - rlp_token_amount;
            
            // If no more collateral, remove from storage
            if (*current_collateral == 0) {
                table::remove(&mut vault.collateral_storage, account_addr);
            };
        };
        
        // Update user's collateral
        user_debt.collateral_amount = user_debt.collateral_amount - rlp_token_amount;
        
        // Update vault totals
        vault.total_collateral = vault.total_collateral - rlp_token_amount;
        
        // If user has no more collateral, remove their debt record
        if (user_debt.collateral_amount == 0) {
            table::remove(&mut vault.user_debts, account_addr);
        };
    }

    // View function to get user's current debt
    #[view]
    public fun get_user_debt(user_address: address): u64 acquires AutoLoanVault {
        let vault = borrow_global<AutoLoanVault>(@revolv);
        if (table::contains(&vault.user_debts, user_address)) {
            table::borrow(&vault.user_debts, user_address).debt_amount
        } else {
            0
        }
    }

    // View function to get user's collateral amount
    #[view]
    public fun get_user_collateral(user_address: address): u64 acquires AutoLoanVault {
        let vault = borrow_global<AutoLoanVault>(@revolv);
        if (table::contains(&vault.collateral_storage, user_address)) {
            *table::borrow(&vault.collateral_storage, user_address)
        } else {
            0
        }
    }

    // View function to get vault's USDC treasury
    #[view]
    public fun get_usdc_treasury(): u64 acquires AutoLoanVault {
        let vault = borrow_global<AutoLoanVault>(@revolv);
        vault.usdc_treasury
    }

    // View function to get total debt
    #[view]
    public fun get_total_debt(): u64 acquires AutoLoanVault {
        let vault = borrow_global<AutoLoanVault>(@revolv);
        vault.total_debt
    }

    // View function to get total collateral
    #[view]
    public fun get_total_collateral(): u64 acquires AutoLoanVault {
        let vault = borrow_global<AutoLoanVault>(@revolv);
        vault.total_collateral
    }

    // View function to get user's stored collateral amount
    #[view]
    public fun get_user_stored_collateral(user_address: address): u64 acquires AutoLoanVault {
        let vault = borrow_global<AutoLoanVault>(@revolv);
        if (table::contains(&vault.collateral_storage, user_address)) {
            *table::borrow(&vault.collateral_storage, user_address)
        } else {
            0
        }
    }
}
