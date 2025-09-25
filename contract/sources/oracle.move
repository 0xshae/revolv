module revolv::oracle {
    use std::signer;

    // Error codes
    const E_NOT_INITIALIZED: u64 = 1;
    const E_UNSUPPORTED_COIN_TYPE: u64 = 2;

    // Simple oracle state - just a marker that it's initialized
    struct Oracle has key {
        initialized: bool,
    }

    // Initialize the oracle
    public entry fun initialize(account: &signer) {
        let account_addr = signer::address_of(account);
        
        // Check if oracle is already initialized
        assert!(!exists<Oracle>(account_addr), 1); // E_ALREADY_INITIALIZED
        
        move_to(account, Oracle {
            initialized: true,
        });
    }

    // Get price for a given coin type
    public fun get_price(coin_type: u8): u64 {
        if (coin_type == 1u8) {
            // APT = 8 * 10^8
            800000000
        } else if (coin_type == 2u8) {
            // USDC = 1 * 10^8
            100000000
        } else if (coin_type == 3u8) {
            // rLP = 10 * 10^8
            1000000000
        } else {
            // Unsupported coin type
            abort std::error::invalid_argument(E_UNSUPPORTED_COIN_TYPE)
        }
    }

}
