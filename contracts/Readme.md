## Deploy both game and token

```bash
source .env && forge script TwoPartyWarGameScript --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy
```

## Deploy only game

```bash
source .env && forge script DeployWithExistingTokenScript --sig "run(address)" 0x1234567890123456789012345678901234567890 --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy
```

## Update ABIs

```bash
forge inspect src/TwoPartyWarGame.sol abi --json | tee ../frontend/public/json_abi/MyContract.json > ../backend/json_abi/MyContract.json
```
