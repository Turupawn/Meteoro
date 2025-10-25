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
forge inspect src/TwoPartyWarGame.sol abi --json --via-ir | tee ../frontend/public/json_abi/MyContract.json > ../backend/json_abi/MyContract.json
```

## Verify Token

```bash
forge verify-contract --rpc-url https://carrot.megaeth.com/rpc --verifier blockscout --verifier-url https://explorer.testnet.riselabs.xyz/api/ 0x7dfDdF0aa8084dF7eD63f1ddBC0C1dce436a5e8c src/GachaToken.sol:GachaToken
```

## Verify Game

```bash
forge verify-contract --rpc-url https://carrot.megaeth.com/rpc --verifier blockscout --verifier-url https://explorer.testnet.riselabs.xyz/api/ 0x1234567890123456789012345678901234567890 src/TwoPartyWarGame.sol:TwoPartyWarGame
```


## RPCs

```bash
https://carrot.megaeth.com/rpc
https://6342.rpc.thirdweb.com
```