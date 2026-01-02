## Deploy both game and token

```bash
source .env && forge script TwoPartyWarGameScript --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy --via-ir
```

## Deploy only game

```bash
source .env && forge script DeployWithExistingTokenScript --sig "run(address)" 0x1234567890123456789012345678901234567890 --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy --via-ir
```

## Update ABIs

```bash
forge inspect src/TwoPartyWarGame.sol:TwoPartyWarGame abi --json --via-ir > ../frontend/public/json_abi/MyContract.json
```

## Verify Token

```bash
forge verify-contract --rpc-url https://testnet.riselabs.xyz --verifier blockscout --verifier-url https://explorer.testnet.riselabs.xyz/api/ 0x1234567890123456789012345678901234567890 src/GachaToken.sol:GachaToken
```

## Verify Game

```bash
forge verify-contract --rpc-url https://testnet.riselabs.xyz --verifier blockscout --verifier-url https://explorer.testnet.riselabs.xyz/api/ 0x1234567890123456789012345678901234567890 src/TwoPartyWarGame.sol:TwoPartyWarGame
```

## Update Bet Amounts and Multipliers

```bash
source .env && forge script UpdateBetAmountsScript --sig "run(address)" 0x1234567890123456789012345678901234567890 --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy --via-ir
```

## Withdraw ETH from Old Contract

```bash
source .env && forge script WithdrawFromOldContractScript --sig "run(address)" 0x1234567890123456789012345678901234567890 --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy --via-ir
```
