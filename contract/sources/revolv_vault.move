module revolv::revolv_vault {
    use std::signer;
    use std::string::{Self, String};
    use std::table::{Self, Table};
    use std::type_info;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::managed_coin;
    use aptos_framework::account;
    use aptos_framework::aptos_coin;
    use revolv::oracle;

    // Error codes
    const E_NOT_INITIALIZED: u64 = 1;
    const E_INVALID_COIN_TYPE: u64 = 2;
    const E_INSUFFICIENT_BALANCE: u64 = 3;
    const E_COIN_NOT_INITIALIZED: u64 = 4;
    const E_ZERO_DEPOSIT: u64 = 5;
    const E_TOKEN_NOT_WHITELISTED: u64 = 6;
    const E_UNAUTHORIZED: u64 = 7;

    // Define RevolvLP as a custom coin type
    struct RevolvLP has drop {}

    // Struct to hold vault state
    struct RevolvVault has key {
        treasury_balances: Table<String, u64>,
        total_value: u64,
        rlp_supply: u64,
        rlp_cap: coin::MintCapability<RevolvLP>,
        whitelisted_tokens: Table<u8, bool>, // Maps coin_type to whitelist status
        admin: address, // Admin address for managing whitelist
    }

    // Initialize the vault
    public entry fun initialize(account: &signer) {
        let account_addr = signer::address_of(account);
        
        // Check if vault is already initialized
        assert!(!exists<RevolvVault>(account_addr), 1); // E_ALREADY_INITIALIZED
        
        // Initialize RevolvLP coin
        let (burn_cap, freeze_cap, mint_cap) = coin::initialize<RevolvLP>(
            account,
            string::utf8(b"RevolvLP"),
            string::utf8(b"rLP"),
            8, // decimals
            true, // monitor_supply
        );
        
        // Create whitelist table and add initial tokens
        let whitelist = table::new();
        table::add(&mut whitelist, 1u8, true); // APT
        table::add(&mut whitelist, 2u8, true); // USDC
        table::add(&mut whitelist, 3u8, true); // SUI
        
        move_to(account, RevolvVault {
            treasury_balances: table::new(),
            total_value: 0,
            rlp_supply: 0,
            rlp_cap: mint_cap,
            whitelisted_tokens: whitelist,
            admin: account_addr,
        });
        
        // Destroy the burn and freeze caps as we don't need them
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_freeze_cap(freeze_cap);
    }

    // Fix vault state by setting safe values
    public entry fun fix_vault() acquires RevolvVault {
        let vault = borrow_global_mut<RevolvVault>(@revolv);
        
        // Set safe values to prevent overflow
        vault.total_value = 1000000; // Small safe value
        vault.rlp_supply = 1000000; // Small safe value
    }

    // Reset vault completely - clears all state
    public entry fun reset_vault() acquires RevolvVault {
        let vault = borrow_global_mut<RevolvVault>(@revolv);
        
        // Reset all state to initial values
        vault.total_value = 0;
        vault.rlp_supply = 0;
        
        // Clear treasury balances table
        let coin_name = string::utf8(b"APT");
        if (table::contains(&vault.treasury_balances, coin_name)) {
            table::remove(&mut vault.treasury_balances, coin_name);
        };
    }

    // Initialize pool with multiple tokens for demo purposes
    public entry fun initialize_demo_pool() acquires RevolvVault {
        let vault = borrow_global_mut<RevolvVault>(@revolv);
        
        // Pre-populate with demo tokens (simulated amounts)
        let apt_amount = 1000000000; // 10 APT
        let usdc_amount = 800000000; // 800 USDC (simulated)
        let sui_amount = 500000000;  // 5 SUI (simulated)
        
        // Add tokens to treasury balances
        table::add(&mut vault.treasury_balances, string::utf8(b"APT"), apt_amount);
        table::add(&mut vault.treasury_balances, string::utf8(b"USDC"), usdc_amount);
        table::add(&mut vault.treasury_balances, string::utf8(b"SUI"), sui_amount);
        
        // Set initial total value (sum of all token values)
        vault.total_value = apt_amount + usdc_amount + sui_amount;
        
        // Mint initial rLP supply (representing the initial pool value)
        vault.rlp_supply = vault.total_value;
    }

    // Generic deposit function for any token
    public entry fun deposit_token(account: &signer, deposit_amount: u64, coin_type: u8) acquires RevolvVault {
        let account_addr = signer::address_of(account);
        let vault = borrow_global_mut<RevolvVault>(@revolv);
        
        // Validate deposit amount
        assert!(deposit_amount > 0, E_ZERO_DEPOSIT);
        
        // Check if token is whitelisted
        assert!(table::contains(&vault.whitelisted_tokens, coin_type), E_TOKEN_NOT_WHITELISTED);
        assert!(*table::borrow(&vault.whitelisted_tokens, coin_type), E_TOKEN_NOT_WHITELISTED);
        
        // Calculate rLP tokens to mint based on current pool state
        let rlp_to_mint = if (vault.rlp_supply == 0) {
            // First deposit: mint 1:1 with deposit amount
            deposit_amount
        } else {
            // Subsequent deposits: proportional minting
            // rLP_to_mint = (deposit_amount * rlp_supply) / total_value
            let deposit_amount_128 = (deposit_amount as u128);
            let rlp_supply_128 = (vault.rlp_supply as u128);
            let total_value_128 = (vault.total_value as u128);
            
            let rlp_to_mint_128 = (deposit_amount_128 * rlp_supply_128) / total_value_128;
            (rlp_to_mint_128 as u64)
        };
        
        // Mint rLP tokens and send to user
        let rlp_coins = coin::mint<RevolvLP>(rlp_to_mint, &vault.rlp_cap);
        coin::deposit(account_addr, rlp_coins);
        
        // Update vault state
        vault.rlp_supply = vault.rlp_supply + rlp_to_mint;
        vault.total_value = vault.total_value + deposit_amount;
        
        // Update treasury balances based on coin type
        let coin_name = if (coin_type == 1u8) {
            string::utf8(b"APT")
        } else if (coin_type == 2u8) {
            string::utf8(b"USDC")
        } else if (coin_type == 3u8) {
            string::utf8(b"SUI")
        } else {
            abort std::error::invalid_argument(E_INVALID_COIN_TYPE)
        };
        
        if (table::contains(&vault.treasury_balances, coin_name)) {
            let current_balance = table::borrow_mut(&mut vault.treasury_balances, coin_name);
            *current_balance = *current_balance + deposit_amount;
        } else {
            table::add(&mut vault.treasury_balances, coin_name, deposit_amount);
        };
    }

    // Deposit function for APT - accepts APT amount and mints rLP tokens
    public entry fun deposit_apt(account: &signer, deposit_amount: u64) acquires RevolvVault {
        deposit_token(account, deposit_amount, 1u8);
    }

    // Deposit function for USDC - accepts USDC amount and mints rLP tokens
    public entry fun deposit_usdc(account: &signer, deposit_amount: u64) acquires RevolvVault {
        deposit_token(account, deposit_amount, 2u8);
    }

    // Deposit function for SUI - accepts SUI amount and mints rLP tokens
    public entry fun deposit_sui(account: &signer, deposit_amount: u64) acquires RevolvVault {
        deposit_token(account, deposit_amount, 3u8);
    }

    // Claim fees function - simulates yield generation
    public entry fun claim_fees(_account: &signer, rlp_token_amount: u64) acquires RevolvVault {
        let vault = borrow_global_mut<RevolvVault>(@revolv);
        
        // Get rLP price from oracle (coin_type = 3)
        let rlp_price = oracle::get_price(3u8);
        
        // Calculate dollar value of rLP tokens (rlp_token_amount * price / 10^8)
        let rlp_value = (rlp_token_amount * rlp_price) / 100000000;
        
        // Calculate 1% yield
        let yield_amount = rlp_value / 100;
        
        // For MVP, we'll just track the yield amount in the vault
        // In a real implementation, this would mint and send USDC
        vault.total_value = vault.total_value + yield_amount;
    }

    // View function to get treasury balances
    public fun get_treasury_balances(): Table<String, u64> acquires RevolvVault {
        let vault = borrow_global<RevolvVault>(@revolv);
        // For MVP, we'll return empty table and use individual getters
        let balances = table::new();
        balances
    }

    // Get specific coin balance from treasury
    #[view]
    public fun get_coin_balance(coin_name: String): u64 acquires RevolvVault {
        let vault = borrow_global<RevolvVault>(@revolv);
        if (table::contains(&vault.treasury_balances, coin_name)) {
            *table::borrow(&vault.treasury_balances, coin_name)
        } else {
            0
        }
    }

    // Get total vault value
    #[view]
    public fun get_total_value(): u64 acquires RevolvVault {
        let vault = borrow_global<RevolvVault>(@revolv);
        vault.total_value
    }

    // Get rLP supply
    #[view]
    public fun get_rlp_supply(): u64 acquires RevolvVault {
        let vault = borrow_global<RevolvVault>(@revolv);
        vault.rlp_supply
    }

    // Get pending yield for a user's rLP tokens
    public fun get_pending_yield(rlp_token_amount: u64): u64 {
        // Get rLP price from oracle (coin_type = 3)
        let rlp_price = oracle::get_price(3u8);
        
        // Calculate dollar value of rLP tokens (rlp_token_amount * price / 10^8)
        let rlp_value = (rlp_token_amount * rlp_price) / 100000000;
        
        // Calculate 1% yield
        let yield_amount = rlp_value / 100;
        
        // Return yield amount in dollars (no decimals conversion needed for display)
        yield_amount
    }

    // Get APT balance from treasury
    #[view]
    public fun get_apt_balance(): u64 acquires RevolvVault {
        let vault = borrow_global<RevolvVault>(@revolv);
        let coin_name = string::utf8(b"APT");
        if (table::contains(&vault.treasury_balances, coin_name)) {
            *table::borrow(&vault.treasury_balances, coin_name)
        } else {
            0
        }
    }

    // Get USDC balance from treasury
    #[view]
    public fun get_usdc_balance(): u64 acquires RevolvVault {
        let vault = borrow_global<RevolvVault>(@revolv);
        let coin_name = string::utf8(b"USDC");
        if (table::contains(&vault.treasury_balances, coin_name)) {
            *table::borrow(&vault.treasury_balances, coin_name)
        } else {
            0
        }
    }

    // Get SUI balance from treasury
    #[view]
    public fun get_sui_balance(): u64 acquires RevolvVault {
        let vault = borrow_global<RevolvVault>(@revolv);
        let coin_name = string::utf8(b"SUI");
        if (table::contains(&vault.treasury_balances, coin_name)) {
            *table::borrow(&vault.treasury_balances, coin_name)
        } else {
            0
        }
    }

    // Admin function to add token to whitelist
    public entry fun add_token_to_whitelist(admin: &signer, coin_type: u8) acquires RevolvVault {
        let admin_addr = signer::address_of(admin);
        let vault = borrow_global_mut<RevolvVault>(@revolv);
        
        // Check if caller is admin
        assert!(admin_addr == vault.admin, E_UNAUTHORIZED);
        
        // Add token to whitelist
        if (table::contains(&vault.whitelisted_tokens, coin_type)) {
            let status = table::borrow_mut(&mut vault.whitelisted_tokens, coin_type);
            *status = true;
        } else {
            table::add(&mut vault.whitelisted_tokens, coin_type, true);
        };
    }

    // Admin function to remove token from whitelist
    public entry fun remove_token_from_whitelist(admin: &signer, coin_type: u8) acquires RevolvVault {
        let admin_addr = signer::address_of(admin);
        let vault = borrow_global_mut<RevolvVault>(@revolv);
        
        // Check if caller is admin
        assert!(admin_addr == vault.admin, E_UNAUTHORIZED);
        
        // Remove token from whitelist
        if (table::contains(&vault.whitelisted_tokens, coin_type)) {
            let status = table::borrow_mut(&mut vault.whitelisted_tokens, coin_type);
            *status = false;
        };
    }

    // Check if token is whitelisted
    #[view]
    public fun is_token_whitelisted(coin_type: u8): bool acquires RevolvVault {
        let vault = borrow_global<RevolvVault>(@revolv);
        if (table::contains(&vault.whitelisted_tokens, coin_type)) {
            *table::borrow(&vault.whitelisted_tokens, coin_type)
        } else {
            false
        }
    }

    // Get admin address
    #[view]
    public fun get_admin(): address acquires RevolvVault {
        let vault = borrow_global<RevolvVault>(@revolv);
        vault.admin
    }

    // Helper function to get coin type ID for oracle lookup
    fun get_coin_type_id<T>(): u8 {
        if (type_info::type_of<T>() == type_info::type_of<AptosCoin>()) {
            1u8 // APT
        } else {
            // For other coins, we'll use a default mapping
            // In a real implementation, you'd have a proper mapping
            2u8 // Default to USDC for now
        }
    }

    // Helper function to get coin name for treasury tracking
    fun get_coin_name<T>(): String {
        if (type_info::type_of<T>() == type_info::type_of<AptosCoin>()) {
            string::utf8(b"APT")
        } else {
            string::utf8(b"UNKNOWN")
        }
    }
}
