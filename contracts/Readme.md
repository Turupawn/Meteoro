## Deploy All Contracts (MockUSDC, GachaToken, Game)

```bash
source .env && forge script DeployAllScript --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy --via-ir
```

Deploys MockUSDC, GachaToken, and TwoPartyWarGame. **Recommended for first deployment.**

**Important:** 
- Save the **PROXY address** from the output - this is the address users will interact with and grant EIP-7702 permissions to
- **Deposit ETH to the PROXY address**, not the implementation address
- The proxy address never changes, even after upgrades
- All state and ETH balance is stored in the proxy contract

## Deploy Game Only (With Existing Tokens)

```bash
source .env && forge script DeployGameScript --sig "run(address,address)" 0xGACHA_TOKEN_ADDRESS 0xMOCK_USDC_ADDRESS --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy --via-ir
```

Use this if you already have GachaToken and MockUSDC deployed and want to deploy a new game contract. Replace addresses with your existing token addresses.

**Note:** GachaToken is not upgradeable (standard for ERC20 tokens). If you need a new token, deploy a new one and use `setGachaToken()` on the game contract to update it.

## Upgrade Contract

```bash
source .env && forge script UpgradeScript --sig "run(address)" 0xPROXY_ADDRESS --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy --via-ir
```

Replace `0xPROXY_ADDRESS` with your actual proxy address. The proxy address remains the same after upgrades, so users don't need to grant permissions again.

## Update Bet Amounts and Multipliers

```bash
source .env && forge script UpdateBetAmountsScript --sig "run(address)" 0xPROXY_ADDRESS --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy --via-ir
```

## Update ABIs

```bash
forge inspect src/TwoPartyWarGame.sol:TwoPartyWarGame abi --json --via-ir > ../frontend/public/json_abi/TwoPartyWarGame.json
forge inspect src/MockUSDC.sol:MockUSDC abi --json > ../frontend/public/json_abi/USDC.json
```

## Verify Implementation

```bash
forge verify-contract --rpc-url https://testnet.riselabs.xyz --verifier blockscout --verifier-url https://explorer.testnet.riselabs.xyz/api/ 0xIMPLEMENTATION_ADDRESS src/TwoPartyWarGame.sol:TwoPartyWarGame
```

## Deposit ETH to Contract

You can deposit ETH to the proxy contract in two ways:

1. **Direct transfer** - Send ETH directly to the proxy address
2. **Using depositFunds()** - Call `depositFunds()` on the proxy (owner only)

**Always use the PROXY address, never the implementation address!**

## Withdraw ETH from Old Contract

```bash
source .env && forge script WithdrawFromOldContractScript --sig "run(address)" 0xOLD_CONTRACT_ADDRESS --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy --via-ir
```
