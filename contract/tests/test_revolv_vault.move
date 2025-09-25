#[test_only]
module revolv::test_revolv_vault {
    use revolv::revolv_vault;
    use revolv::oracle;

    #[test]
    fun test_get_pending_yield() {
        // Test with 100 rLP tokens (smaller amount to avoid overflow)
        let rlp_amount = 100 * 100000000; // 100 rLP with 8 decimals
        
        // Get pending yield
        let pending_yield = revolv_vault::get_pending_yield(rlp_amount);
        
        // Expected calculation:
        // rLP value = (100 * 10^8) * (10 * 10^8) / 10^8 = 100 * 10 * 10^8 = 10^11
        // Yield = 10^11 / 100 = 10^9 = 1,000,000,000 (in dollars)
        assert!(pending_yield == 1000000000, 0);
    }

    #[test]
    fun test_get_pending_yield_zero() {
        // Test with 0 rLP tokens
        let pending_yield = revolv_vault::get_pending_yield(0);
        assert!(pending_yield == 0, 1);
    }

    #[test]
    fun test_get_pending_yield_small_amount() {
        // Test with 1 rLP token (10^8 units)
        let rlp_amount = 100000000; // 1 rLP with 8 decimals
        
        let pending_yield = revolv_vault::get_pending_yield(rlp_amount);
        
        // Expected calculation:
        // rLP value = 10^8 * (10 * 10^8) / 10^8 = 10 * 10^8
        // Yield = 10 * 10^8 / 100 = 10^7 = 10,000,000 (in dollars)
        assert!(pending_yield == 10000000, 2);
    }
}
