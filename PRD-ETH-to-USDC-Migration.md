# PRD: ETH to USDC Migration

## Overview

This document outlines the migration from using native ETH to USDC (ERC-20 token) as the primary currency for the Meteoro TwoPartyWarGame platform.

---

## Current State Analysis

### Smart Contract (`contracts/src/TwoPartyWarGame.sol`)

| Component | Current Implementation | Line Reference |
|-----------|----------------------|----------------|
| Game Entry | `rollDice() external payable` with `msg.value` | Line 130-131 |
| Bet Validation | `whitelistedBetAmounts[msg.value]` | Line 131 |
| Payout Calculation | `payout = betAmount * 2` | Line 197 |
| ETH Transfer | `_transferEth(payable(to), amount)` via low-level call | Lines 220-223 |
| Deposits | `depositFunds() external payable` | Line 373 |
| Withdrawals | `withdrawFunds()` using `address(this).balance` | Lines 368-371 |
| Balance Check | `getContractBalance() returns address(this).balance` | Line 333 |

### Frontend (`frontend/src/web3/blockchain_stuff.js`)

| Component | Current Implementation | Line Reference |
|-----------|----------------------|----------------|
| Balance Formatting | `formatEther()` from viem | Line 67-70 |
| Transaction Value | `value: betAmount` in sendSessionTransaction | Line 570-614 |
| Balance Polling | `wsClient.getBalance({ address })` | Lines 730-734 |
| Withdrawals | Direct ETH transfer via `walletClient.sendTransaction` | Lines 616-691 |

### UI Components

| Component | File | Current Behavior |
|-----------|------|-----------------|
| Balance Display | `hud/hudTexts/ethBalanceText.js` | Shows "X.XXXXXX ETH" |
| Bet Menu | `menus/betMenu.js` | Shows "X.XXXX ETH" per bet option |
| Insufficient Balance | `menus/insufficientBalanceMenu.js` | Points to ETH faucet |

---

## Required Changes

### 1. Smart Contract Changes

#### 1.1 Add Token Interface, Address, and Decimals

```solidity
// Add at contract level
IERC20Metadata public usdcToken;
uint8 public tokenDecimals;

// Add in constructor or initializer
constructor(
    address _vrfCoordinator,
    bytes32 _keyHash,
    uint64 _subscriptionId,
    address _usdcToken  // NEW PARAMETER
) VRFConsumerBaseV2Plus(_vrfCoordinator) Ownable(msg.sender) {
    // ... existing code ...
    usdcToken = IERC20Metadata(_usdcToken);
    tokenDecimals = usdcToken.decimals();
}
```

**Imports**: `IERC20Metadata` and `SafeERC20` from OpenZeppelin. Use `SafeERC20` for transfers.

#### 1.2 Modify rollDice Function

**Current** (`TwoPartyWarGame.sol:130-148`):
```solidity
function rollDice() external payable whenNotPaused returns (uint256 gameId) {
    require(whitelistedBetAmounts[msg.value], "Bet amount not whitelisted");
    // ... uses msg.value ...
}
```

**New**:
```solidity
function rollDice(uint256 betAmount) external whenNotPaused returns (uint256 gameId) {
    require(whitelistedBetAmounts[betAmount], "Bet amount not whitelisted");

    // Transfer USDC from player to contract (using SafeERC20)
    usdcToken.safeTransferFrom(msg.sender, address(this), betAmount);

    // ... rest of function using betAmount instead of msg.value ...
}
```

**Note on house balance**: No on-chain check for sufficient payout funds. The VRF callback resolves in a separate transaction, making "reserved balance" tracking complex. Monitor house balance via dashboard and top up as needed. With house edge, balance trends upward anyway.

#### 1.3 Replace _transferEth with _transferUSDC

**Current** (`TwoPartyWarGame.sol:220-223`):
```solidity
function _transferEth(address payable to, uint256 amount) internal {
    (bool sent,) = to.call{value: amount}("");
    require(sent, "Failed ETH transfer");
}
```

**New**:
```solidity
using SafeERC20 for IERC20Metadata;

function _transferUSDC(address to, uint256 amount) internal {
    usdcToken.safeTransfer(to, amount);
}
```

**Compatibility Note**: Use OpenZeppelin `SafeERC20` for broader ERC-20 compatibility (tokens that return no boolean).

#### 1.4 Update Deposit/Withdraw Functions

**Current** (`TwoPartyWarGame.sol:368-373`):
```solidity
function withdrawFunds(uint256 amount) external onlyOwner {
    require(amount <= address(this).balance, "Insufficient balance");
    _transferEth(payable(owner()), amount);
}

function depositFunds() external payable onlyOwner {}
```

**New**:
```solidity
function withdrawFunds(uint256 amount) external onlyOwner {
    require(amount <= usdcToken.balanceOf(address(this)), "Insufficient balance");
    _transferUSDC(owner(), amount);
}

function depositFunds(uint256 amount) external onlyOwner {
    usdcToken.safeTransferFrom(msg.sender, address(this), amount);
}
```

#### 1.5 Update Balance Check

**Current** (`TwoPartyWarGame.sol:333`):
```solidity
function getContractBalance() external view returns (uint256) {
    return address(this).balance;
}
```

**New**:
```solidity
function getContractBalance() external view returns (uint256) {
    return usdcToken.balanceOf(address(this));
}
```

#### 1.6 Remove Payable Receive Function

**Current** (`TwoPartyWarGame.sol:128`):
```solidity
receive() external payable {}
```

**New**: Remove entirely. With `selfdestruct` deprecated (post-Cancun), there's no practical way for ETH to be force-sent to the contract. If ETH somehow appears (e.g., coinbase rewards - extremely rare), the contract is upgradeable so a rescue function can be added later.

#### 1.7 Add USDC Address Getter

```solidity
function getUSDCAddress() external view returns (address) {
    return address(usdcToken);
}
```

#### 1.8 Add Token Decimals Getter (for frontend init)

```solidity
function getTokenDecimals() external view returns (uint8) {
    return tokenDecimals;
}
```

#### 1.9 Whitelisted Bet Amounts Use Token Decimals

- Store whitelisted bet amounts in smallest units using `tokenDecimals`.
- When setting new bet tiers, convert `displayAmount * (10 ** tokenDecimals)` so the contract and frontend stay compatible with different token decimal schemes.

#### 1.10 Extend getInitialFrontendGameState

- Add `tokenDecimals` to the return tuple so the frontend gets decimals during initial state load.
- Frontend should read and store it in `gameState.setTokenDecimals(...)`.

---

### 2. Frontend Changes

#### 2.1 Configuration Updates (`walletConfig.js`)

**Add USDC Token Address**:
```javascript
// Line 9 - Add new constant
export const USDC_TOKEN_ADDRESS = import.meta.env.USDC_TOKEN_ADDRESS;
export const USDC_FAUCET_URL = import.meta.env.USDC_FAUCET_URL;
```

#### 2.2 Balance Formatting (`blockchain_stuff.js`)

**Current** (Line 67-70):
```javascript
export function formatBalance(weiBalance, shownDecimals = 6) {
  const balanceInEth = formatEther(weiBalance)
  return Number(balanceInEth).toFixed(shownDecimals)
}
```

**New**:
```javascript
import { formatUnits } from 'viem';

export function formatBalance(balance, tokenDecimals, shownDecimals = 2) {
  const balanceInToken = formatUnits(balance, tokenDecimals)
  return Number(balanceInToken).toFixed(shownDecimals)
}
```

#### 2.3 Add USDC Approval Flow (`blockchain_stuff.js`)

**Add new function before rollDice**:
```javascript
const USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }]
  }
];

export async function approveUSDC(amount) {
  const txData = encodeFunctionData({
    abi: USDC_ABI,
    functionName: 'approve',
    args: [MY_CONTRACT_ADDRESS, amount]
  });

  const hash = await sendSessionTransaction({
    to: USDC_TOKEN_ADDRESS,
    value: 0n,
    data: txData
  });

  return hash;
}

export async function checkUSDCAllowance() {
  const allowance = await wsClient.readContract({
    address: USDC_TOKEN_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: [wallet.address, MY_CONTRACT_ADDRESS]
  });
  return allowance;
}

export async function getUSDCBalance(address) {
  const balance = await wsClient.readContract({
    address: USDC_TOKEN_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [address]
  });
  return balance;
}
```

#### 2.4 Fetch Token Decimals on App Init (`blockchain_stuff.js`)

```javascript
export async function getTokenDecimals() {
  const decimals = await wsClient.readContract({
    address: MY_CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTokenDecimals'
  });
  return Number(decimals);
}
```

**Initialization**: Extend `getInitialFrontendGameState` to include `tokenDecimals` (from contract), then store it in `gameState.setTokenDecimals(...)` during initial state load.

#### 2.5 Update rollDice Function (`blockchain_stuff.js`)

**Current** (Lines 570-614):
```javascript
export async function rollDice() {
  const betAmount = gameState.getSelectedBetAmount()
  const txData = encodeFunctionData({
    abi: CONTRACT_ABI,
    functionName: 'rollDice',
    args: []
  })
  const hash = await sendSessionTransaction({
    to: MY_CONTRACT_ADDRESS,
    value: betAmount,  // ETH sent here
    data: txData
  })
}
```

**New**:
```javascript
export async function rollDice() {
  const betAmount = gameState.getSelectedBetAmount()

  // Check and approve USDC if needed
  const currentAllowance = await checkUSDCAllowance();
  if (currentAllowance < betAmount) {
    // Approve max uint256 for unlimited future approvals (or specific amount)
    await approveUSDC(BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'));
  }

  const txData = encodeFunctionData({
    abi: CONTRACT_ABI,
    functionName: 'rollDice',
    args: [betAmount]  // Pass bet amount as argument now
  })

  const hash = await sendSessionTransaction({
    to: MY_CONTRACT_ADDRESS,
    value: 0n,  // No ETH sent - USDC transferred via contract
    data: txData
  })
}
```

#### 2.6 Update Balance Polling (`blockchain_stuff.js`)

**Current** (Lines 730-734):
```javascript
balancePoll = setInterval(async () => {
  const ethBalance = await wsClient.getBalance({ address: wallet.address })
  const currentGacha = gameState.getGachaTokenBalance()
  updateBalances(ethBalance, currentGacha)
}, BALANCE_POLL_INTERVAL)
```

**New**:
```javascript
balancePoll = setInterval(async () => {
  const usdcBalance = await getUSDCBalance(wallet.address);
  const currentGacha = gameState.getGachaTokenBalance();
  updateBalances(usdcBalance, currentGacha);
}, BALANCE_POLL_INTERVAL)
```

**Note**: Keep a lightweight ETH balance poll (or on-demand check) for gas messaging.

#### 2.7 Update withdrawFunds Function (`blockchain_stuff.js`)

**Current** (Lines 616-691): Transfers ETH directly.

**New**: Must transfer USDC token instead:
```javascript
export async function withdrawFunds(destinationAddress) {
  const [usdcBalance, gachaTokenAddress] = await Promise.all([
    getUSDCBalance(wallet.address),
    wsClient.readContract({
      address: MY_CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'gachaToken'
    })
  ]);

  // Transfer GachaTokens (unchanged)
  // ...

  // Transfer USDC instead of ETH
  const usdcTransferData = encodeFunctionData({
    abi: USDC_ABI,
    functionName: 'transfer',
    args: [destinationAddress, usdcBalance]
  });

  const usdcHash = await walletClient.sendTransaction({
    to: USDC_TOKEN_ADDRESS,
    value: 0n,
    data: usdcTransferData,
    gas: BigInt(GAS_LIMIT)
  });
}
```

---

### 3. UI Component Changes

#### 3.1 ETH Balance Text (`hud/hudTexts/ethBalanceText.js`)

**Current** (Line 86):
```javascript
this.balanceText = `${formatBalance(balance, ETH_BALANCE_DECIMALS)} ETH`
```

**New**:
```javascript
this.balanceText = `$${formatBalance(balance, gameState.getTokenDecimals(), TOKEN_BALANCE_DECIMALS)} USDC`
```

**Rename file** to `usdcBalanceText.js` for clarity.

#### 3.2 Bet Menu (`menus/betMenu.js`)

**Current** (Line 200):
```javascript
const labelText = `${formatBalance(betAmount, BET_AMOUNT_DECIMALS)} ETH`
```

**New**:
```javascript
const labelText = `$${formatBalance(betAmount, gameState.getTokenDecimals(), BET_AMOUNT_DECIMALS)}`
```

#### 3.3 Insufficient Balance Menu (`menus/insufficientBalanceMenu.js`)

**Current** (Line 53):
```javascript
"Deposit ETH on Rise Testnet to start playing"
```

**New**:
```javascript
"Deposit USDC on Rise Testnet to start playing.\nYou still need a little ETH for gas."
```

**Update faucet link** (Line 105) to point to USDC bridge/faucet instead of ETH faucet, and keep a separate ETH faucet link for gas.

#### 3.4 Update Decimal Constants (`utils/utils.js`)

**Current**:
```javascript
export const ETH_BALANCE_DECIMALS = 6
export const BET_AMOUNT_DECIMALS = 4
```

**New**:
```javascript
export const TOKEN_BALANCE_DECIMALS = 2  // Token typically shown as $X.XX
export const BET_AMOUNT_DECIMALS = 2
```

#### 3.5 ETH Gas Requirement UI

- Keep a small ETH balance check (e.g., `getBalance` on the wallet) so approvals and rolls do not fail.
- If ETH is below a minimal threshold, show a short message: "You need a little ETH for gas."
- Keep the ETH faucet link visible on testnet.

---

### 4. Game State Changes (`gameState.js`)

#### 4.1 Rename State Variables

**Current** (Lines 3, 25-33):
```javascript
this.playerETHBalance = 0n

getETHBalance() {
  return this.playerETHBalance
}
```

**New**:
```javascript
this.playerUSDCBalance = 0n
this.tokenDecimals = 6

setTokenDecimals(decimals) {
  this.tokenDecimals = decimals
}

getTokenDecimals() {
  return this.tokenDecimals
}

getUSDCBalance() {
  return this.playerUSDCBalance
}
```

#### 4.2 Update Minimum Playable Balance

**Current** (Lines 108-115):
```javascript
getMinimumPlayableBalance() {
  const selectedBetAmount = this.getSelectedBetAmount()
  const gasFeeBufferWei = BigInt(5*1e12) // 0.000005 ETH in wei
  return selectedBetAmount + gasFeeBufferWei
}
```

**New**:
```javascript
getMinimumPlayableBalance() {
  const selectedBetAmount = this.getSelectedBetAmount()
  // No USDC buffer needed - gas is paid in ETH separately
  return selectedBetAmount
}
```

**Note**: Keep a separate ETH gas balance check in the UI to prevent failed approvals/rolls.

---

## Network Configuration

### Testnet vs Mainnet USDC Addresses

| Network | USDC Address | Notes |
|---------|-------------|-------|
| **Rise Testnet** | TBD - Deploy mock USDC | Use OpenZeppelin ERC20 mock |
| **Rise Mainnet** | TBD - Official bridged USDC | Canonical bridged USDC address |
| Ethereum Mainnet (ref) | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | Native USDC |
| Arbitrum (ref) | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | Native USDC |

### Environment Variables

**`frontend/.env` additions**:
```bash
# Testnet Configuration
USDC_TOKEN_ADDRESS=0x...  # Mock USDC on Rise Testnet
USDC_FAUCET_URL=https://...  # Where users can get test USDC

# Mainnet Configuration (separate .env.production)
USDC_TOKEN_ADDRESS=0x...  # Bridged USDC on Rise Mainnet
USDC_BRIDGE_URL=https://...  # Bridge for getting USDC on Rise
```

**Note**: Keep env variable naming consistent with existing `import.meta.env.*` usage (no `VITE_` prefix in this project).

**`contracts/.env` additions**:
```bash
USDC_TOKEN_ADDRESS=0x...
```

### Testnet Strategy

#### 1. Deploy Mock USDC with Public Mint

Create a simple ERC20 token with public mint function for testing:

```solidity
// contracts/src/MockUSDC.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    uint256 public constant MINT_AMOUNT = 1000 * 1e6; // 1000 USDC per mint
    uint256 public constant MINT_COOLDOWN = 1 hours;

    mapping(address => uint256) public lastMintTime;

    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Public mint function - anyone can mint test USDC
    /// @dev Rate limited to prevent abuse
    function mint() external {
        require(
            block.timestamp >= lastMintTime[msg.sender] + MINT_COOLDOWN,
            "Mint cooldown not elapsed"
        );
        lastMintTime[msg.sender] = block.timestamp;
        _mint(msg.sender, MINT_AMOUNT);
    }

    /// @notice Check remaining cooldown time
    function mintCooldownRemaining(address account) external view returns (uint256) {
        uint256 nextMintTime = lastMintTime[account] + MINT_COOLDOWN;
        if (block.timestamp >= nextMintTime) return 0;
        return nextMintTime - block.timestamp;
    }
}
```

#### 2. In-App Mint Button (Testnet Only)

Add a "Mint Test USDC" button directly in the game UI that only appears on testnet. This is better than an external faucet because:
- Users don't leave the app
- Reduces friction for new users
- Automatic wallet detection (no copy/paste addresses)

**Implementation in `insufficientBalanceMenu.js`**:

The codebase already has network detection (line 6, 116-118):
```javascript
const NETWORK = import.meta.env.NETWORK || 'rise testnet';

// Later in createScreenElements():
if (NETWORK === 'rise testnet') {
    this.elements.push(this.faucetText, this.faucetLink);
}
```

**Add Mint Button for USDC (testnet only)**:

```javascript
// In createScreenElements(), after faucetLink creation:

if (NETWORK === 'rise testnet') {
    const mintButtonY = this.scene.centerY + (isLandscapeMode ? 220 : 160);

    this.mintButton = new MenuButton(
        this.scene,
        this.scene.centerX,
        mintButtonY,
        "🪙 Mint 1000 Test USDC",
        titleFontSize,
        {
            interactive: true,
            onClick: async () => {
                this.mintButton.setText("Minting...");
                this.mintButton.disable();
                try {
                    await mintTestUSDC();
                    this.mintButton.setText("✓ Minted! (1hr cooldown)");
                } catch (error) {
                    if (error.message.includes("cooldown")) {
                        this.mintButton.setText("⏳ Cooldown active");
                    } else {
                        this.mintButton.setText("❌ Mint failed - retry");
                        this.mintButton.enable();
                    }
                }
            },
            depth: 302
        }
    );

    this.elements.push(this.faucetText, this.faucetLink, this.mintButton);
}
```

**Add mint function in `blockchain_stuff.js`**:

```javascript
const MOCK_USDC_ABI = [
    {
        name: 'mint',
        type: 'function',
        inputs: [],
        outputs: []
    },
    {
        name: 'mintCooldownRemaining',
        type: 'function',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }]
    }
];

export async function mintTestUSDC() {
    const txData = encodeFunctionData({
        abi: MOCK_USDC_ABI,
        functionName: 'mint',
        args: []
    });

    const hash = await sendSessionTransaction({
        to: USDC_TOKEN_ADDRESS,
        value: 0n,
        data: txData
    });

    // Wait for confirmation
    await wsClient.waitForTransactionReceipt({ hash });

    return hash;
}

export async function getMintCooldown() {
    const cooldown = await wsClient.readContract({
        address: USDC_TOKEN_ADDRESS,
        abi: MOCK_USDC_ABI,
        functionName: 'mintCooldownRemaining',
        args: [wallet.address]
    });
    return cooldown;
}
```

#### 3. Network-Aware UI Messaging

Update `insufficientBalanceMenu.js` messaging based on network:

```javascript
// Line 53-61, update title text:
const networkName = NETWORK === 'rise testnet' ? 'Rise Testnet' : 'Rise';
const depositMessage = NETWORK === 'rise testnet'
    ? `Get test USDC to start playing.\nMint below or use the faucet.`
    : `Deposit USDC on ${networkName} to start playing.\nBridge from Ethereum or other L2s.`;

this.title = new MenuText(
    this.scene,
    this.scene.centerX,
    titleY,
    depositMessage,
    titleFontSize,
    { depth: 302 }
);
```

#### 4. Environment Configuration

**`.env` (testnet)**:
```bash
NETWORK="rise testnet"
CONTRACT_ADDRESS=0x...
USDC_TOKEN_ADDRESS=0x...  # MockUSDC address
IS_TESTNET=true
```

**`.env.production` (mainnet)**:
```bash
NETWORK="rise mainnet"
CONTRACT_ADDRESS=0x...
USDC_TOKEN_ADDRESS=0x...  # Real bridged USDC
IS_TESTNET=false
```

#### 5. Testnet UI Flow

```
User with 0 USDC on Testnet:
┌─────────────────────────────────────────────┐
│                                             │
│   Get test USDC to start playing.           │
│   Mint below or use the faucet.             │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │  0x1234...5678                      │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   Get test ETH for gas from faucet:         │
│   https://faucet.testnet.riselabs.xyz/      │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │     🪙 Mint 1000 Test USDC          │   │
│   └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

#### 6. Mainnet UI Flow (No Mint Button)

```
User with 0 USDC on Mainnet:
┌─────────────────────────────────────────────┐
│                                             │
│   Deposit USDC on Rise to start playing.    │
│   Bridge from Ethereum or other L2s.        │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │  0x1234...5678                      │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   Bridge USDC to Rise:                      │
│   https://bridge.risenetwork.io/            │
│                                             │
└─────────────────────────────────────────────┘
```

#### 7. Testing Checklist

- [ ] MockUSDC contract deployed on testnet
- [ ] Mint button appears ONLY on testnet
- [ ] Mint button hidden on mainnet
- [ ] User can mint 1000 test USDC with one click
- [ ] Cooldown prevents spam minting (1 hour)
- [ ] Cooldown message displays when rate limited
- [ ] User can approve contract to spend USDC
- [ ] User can place bets with USDC
- [ ] User receives USDC payouts on wins
- [ ] User can withdraw USDC to external wallet
- [ ] Balance displays correctly in UI
- [ ] Bet amounts display correctly

### Mainnet Strategy

1. **USDC Source**: Users bridge USDC from Ethereum/L2 to Rise using official bridge
2. **Contract Deployment**: Deploy new version with mainnet USDC address
3. **House Funding**: Owner deposits mainnet USDC for payouts
4. **Monitoring**: Implement balance alerts for house funds

---

## Migration Path

### Phase 1: Smart Contract Development
1. Create new contract version with USDC support
2. Deploy mock USDC on testnet
3. Deploy updated game contract with mock USDC address
4. Test all flows on testnet

### Phase 2: Frontend Updates
1. Add USDC configuration and ABI
2. Implement approval flow
3. Update all balance/amount displays
4. Update all messaging (ETH -> USDC)
5. Add new faucet/bridge links

### Phase 3: Testing
1. End-to-end testing on testnet
2. Verify all bet amounts work
3. Verify payouts are correct (2x)
4. Verify withdrawals work
5. Load testing for approval flow

### Phase 4: Mainnet Preparation
1. Identify canonical USDC on Rise Mainnet
2. Update environment configs
3. Deploy production contract
4. Fund house with USDC

### Phase 5: Launch
1. Deploy frontend with mainnet config
2. Monitor transactions
3. Verify payouts

---

## UI/UX Changes Summary

| Element | Before | After |
|---------|--------|-------|
| Balance Display | "0.123456 ETH" | "$123.45 USDC" |
| Bet Amount | "0.0001 ETH" | "$0.10" |
| Deposit Message | "Deposit ETH on Rise Testnet" | "Deposit USDC on Rise" |
| Faucet Link | ETH faucet | USDC faucet/bridge |
| New UI Element | N/A | Approval confirmation (one-time) |

### Approval Flow UX

First-time users or when allowance is insufficient:
1. Show "Approve USDC" button/modal
2. User confirms approval transaction
3. Wait for confirmation
4. Proceed to game

**Recommendation**: Approve unlimited (max uint256) on first play to avoid repeated approvals.

**Note**: Do not implement `permit` for now; use the explicit approve flow only.

---

## Dual Currency UX: USDC for Gameplay, ETH for Gas

After migrating to USDC, users will need **both currencies**:
- **USDC**: For placing bets and receiving payouts
- **ETH**: For paying transaction gas fees

### Recommended UX: Dual Balance Display

Show both balances in the HUD:

```
┌──────────────────────────────────┐
│  💵 $125.50 USDC    ⛽ 0.01 ETH  │
└──────────────────────────────────┘
```

**Implementation**:
- Keep `ethBalanceText.js` for gas display (rename to `gasBalanceText.js`, smaller font)
- Add new `usdcBalanceText.js` for game balance (primary, larger font)
- Position USDC balance prominently, ETH/gas balance secondary

### Insufficient Balance States

Handle three distinct states in `insufficientBalanceMenu.js`:

| State | User Has | Message | Action |
|-------|----------|---------|--------|
| No USDC | ETH only | "Deposit USDC to play" | Show mint button (testnet) or bridge link (mainnet) |
| No ETH | USDC only | "Need ETH for gas fees" | Show ETH faucet link |
| Neither | Nothing | "Deposit USDC and ETH" | Show both options |

**Updated balance check logic**:

```javascript
async checkBalance() {
    const wallet = getLocalWallet();
    if (!wallet) return;

    const [usdcBalance, ethBalance] = await Promise.all([
        getUSDCBalance(wallet.address),
        wsClient.getBalance({ address: wallet.address })
    ]);

    const minUSDC = getMinimumPlayableBalance();  // Bet amount
    const minETH = BigInt(5 * 1e12);              // ~0.000005 ETH for gas

    const hasEnoughUSDC = usdcBalance >= minUSDC;
    const hasEnoughETH = ethBalance >= minETH;

    if (hasEnoughUSDC && hasEnoughETH) {
        this.hide();
    } else {
        this.updateMessage(hasEnoughUSDC, hasEnoughETH);
    }
}

updateMessage(hasUSDC, hasETH) {
    if (!hasUSDC && !hasETH) {
        this.title.setText("Deposit USDC and ETH to start playing.");
        this.showUSDCOptions();
        this.showETHOptions();
    } else if (!hasUSDC) {
        this.title.setText("Deposit USDC to start playing.");
        this.showUSDCOptions();
        this.hideETHOptions();
    } else if (!hasETH) {
        this.title.setText("Need ETH for gas fees.");
        this.hideUSDCOptions();
        this.showETHOptions();
    }
}
```

### Testnet: Both Faucets + Mint Button

```
┌─────────────────────────────────────────────┐
│                                             │
│   Deposit USDC and ETH to start playing.    │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │     🪙 Mint 1000 Test USDC          │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   Get test ETH for gas:                     │
│   https://faucet.testnet.riselabs.xyz/      │
│                                             │
└─────────────────────────────────────────────┘
```

### Mainnet: Bridge Instructions

```
┌─────────────────────────────────────────────┐
│                                             │
│   Deposit USDC and ETH to start playing.    │
│                                             │
│   Bridge assets to Rise:                    │
│   https://bridge.risenetwork.io/            │
│                                             │
│   Supported: USDC, ETH from Ethereum/L2s    │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Risk Considerations

| Risk | Mitigation |
|------|------------|
| USDC contract risk | Use official/canonical USDC only on mainnet |
| Approval phishing concerns | Clear messaging about what approval means |
| Decimal confusion (token-specific) | Read decimals from contract on init, explicit handling |
| User has no ETH for gas | Dual balance check, clear gas warning, show ETH faucet |
| User confused by two currencies | Clear UX explaining USDC for play, ETH for gas |
| Bridge liquidity | Link to multiple bridge options if available |
| MockUSDC abuse on testnet | Rate limit minting (1 hour cooldown) |

---

## Files Requiring Changes

### Smart Contracts
- `contracts/src/TwoPartyWarGame.sol` - Major changes
- New: `contracts/src/MockUSDC.sol` (testnet only)

### Frontend - Core
- `frontend/src/web3/blockchain_stuff.js` - Major changes
- `frontend/src/web3/walletConfig.js` - Add USDC config
- `frontend/src/gameState.js` - Rename ETH to USDC

### Frontend - UI
- `frontend/src/hud/hudTexts/ethBalanceText.js` - Rename + update display
- `frontend/src/menus/betMenu.js` - Update labels
- `frontend/src/menus/insufficientBalanceMenu.js` - Update messaging
- `frontend/src/utils/utils.js` - Update decimal constants

### Configuration
- `frontend/.env` - Add USDC addresses
- `contracts/.env` - Add USDC addresses

---

## Success Metrics

1. All existing game functionality works with USDC
2. Users can successfully bet and receive payouts in USDC
3. Balance displays are accurate and properly formatted
4. Approval flow is seamless (one-time per wallet)
5. Gas remains payable in ETH (transparent to user)
6. No decimal precision errors in payouts
