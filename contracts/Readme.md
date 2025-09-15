## Compile

```bash
source .env && forge script TwoPartyWarGameScript --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY --legacy
```

## Update ABIs

```bash
forge inspect src/TwoPartyWarGame.sol abi --json | tee ../frontend/public/json_abi/MyContract.json > ../backend/json_abi/MyContract.json
```
