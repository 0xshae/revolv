#[test_only]
module revolv::test_oracle {
    use revolv::oracle;

    #[test]
    fun test_get_price_apt() {
        let price = oracle::get_price(1u8);
        assert!(price == 800000000, 0); // APT = 8 * 10^8
    }

    #[test]
    fun test_get_price_usdc() {
        let price = oracle::get_price(2u8);
        assert!(price == 100000000, 1); // USDC = 1 * 10^8
    }

    #[test]
    fun test_get_price_rlp() {
        let price = oracle::get_price(3u8);
        assert!(price == 1000000000, 2); // rLP = 10 * 10^8
    }

    #[test]
    #[expected_failure(abort_code = 0x10002)] // E_UNSUPPORTED_COIN_TYPE
    fun test_get_price_invalid() {
        let _price = oracle::get_price(99u8);
    }
}
