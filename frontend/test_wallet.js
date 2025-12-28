
import { RiseWallet } from 'rise-wallet';
import { createClient, http } from 'viem';
import { riseTestnet } from 'viem/chains';

async function testWalletCreation() {
    console.log("Starting Rise Wallet creation test...");

    try {
        // Attempt 1: No args (v0.2.29 style)
        console.log("Attempting RiseWallet.create() without arguments...");
        const wallet1 = RiseWallet.create();
        console.log("✅ Success (No args):", !!wallet1);

        // Attempt 2: With chains (v0.3.0 style)
        try {
            console.log("Attempting RiseWallet.create() with chains config...");
            const wallet2 = RiseWallet.create({ chains: [riseTestnet] });
            console.log("✅ Success (With chains):", !!wallet2);
        } catch (e) {
            console.log("ℹ️ Note: Create with chains failed (Expected if using v0.2.29):", e.message);
        }

        console.log("Test completed.");

    } catch (error) {
        console.error("❌ Fatal Error:", error);
        process.exit(1);
    }
}

testWalletCreation();
