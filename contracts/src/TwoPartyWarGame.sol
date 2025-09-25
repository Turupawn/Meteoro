// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {GachaToken} from "./GachaToken.sol";

contract TwoPartyWarGame is Ownable, Pausable {
    enum State { NotStarted, Committed, HashPosted, Revealed, Forfeited }

    struct Game {
        State gameState;

        address playerAddress;
        bytes32 playerCommit;
        uint commitTimestamp;
        uint betAmount;

        bytes32 houseRandomness;
        uint houseRandomnessTimestamp;

        bytes32 playerSecret;
        uint playerCard;
        uint houseCard;
        uint revealTimestamp;
    }

    mapping(uint gameId => Game) public games;
    mapping(address player => uint[] gameIds) playerGames;
    
    // Whitelisted bet amounts
    mapping(uint betAmount => bool) public whitelistedBetAmounts;
    uint[] public betAmountsArray;

    uint public constant MAX_RETURN_HISTORY = 10;
    uint public constant MAX_PENDING_GAMES = 20;
    
    address public immutable HOUSE;
    uint public nextGameId;
    // Packed storage: upper 128 bits = lastRandomnessPostedGameId, lower 128 bits = pendingGameCount
    uint private packedGameState;
    
    GachaToken public gachaToken;
    uint public tieRewardAmount = 100 ether;

    event GameForfeited(address indexed player, address house);
    event GameCreated(address indexed player, bytes32 commitHash, uint gameId, uint betAmount);
    event TieRewardMinted(address indexed player, uint amount, uint gameId);
    event TieRewardAmountUpdated(uint newAmount);
    event BetAmountsUpdated(uint[] newBetAmounts);

    constructor(address _house, address _gachaToken) Ownable(msg.sender) {
        HOUSE = _house;
        gachaToken = GachaToken(_gachaToken);
        nextGameId = 1;
    }
    // Public functions
    function commit(bytes32 _commitHash) external payable whenNotPaused {
        require(whitelistedBetAmounts[msg.value], "Bet amount not whitelisted");
        require(pendingGameCount() < MAX_PENDING_GAMES, "Too many pending games");
        Game memory playerGame = games[getCurrentGameId(msg.sender)];
        require(playerGame.gameState == State.NotStarted ||
                    playerGame.gameState == State.Revealed ||
                    playerGame.gameState == State.Forfeited,
                "Player already committed");

        Game memory newGame = Game({
            gameState: State.Committed,
            playerAddress: msg.sender,
            playerCommit: _commitHash,
            commitTimestamp: block.timestamp,
            betAmount: msg.value,
            
            houseRandomness: bytes32(0),
            houseRandomnessTimestamp: 0,
            playerSecret: bytes32(0),
            playerCard: 0,
            houseCard: 0,
            revealTimestamp: 0
        });

        _incrementPendingGameCount();
        games[nextGameId] = newGame;
        playerGames[msg.sender].push(nextGameId);
        emit GameCreated(msg.sender, _commitHash, nextGameId, msg.value);
        nextGameId++;
    }

    function multiPostRandomness(bytes32[] memory randomness) external payable whenNotPaused {
        require(msg.sender == HOUSE, "Not house");
        require(randomness.length > 0, "Should not be 0");
        require(randomness.length <= pendingGameCount(), "Too many randomness values");
        
        uint totalExpectedValue = 0;
        for (uint i = 0; i < randomness.length; i++) {
            uint gameId = lastRandomnessPostedGameId() + i + 1;
            Game storage playerGame = games[gameId];
            if(playerGame.gameState != State.Forfeited) {
                require(playerGame.gameState == State.Committed, "Game has to be commited");
                totalExpectedValue += playerGame.betAmount;
                playerGame.gameState = State.HashPosted;
                playerGame.houseRandomness = randomness[i];
                playerGame.houseRandomnessTimestamp = block.timestamp;
            }
        }
        require(msg.value == totalExpectedValue, "Incorrect total bet amount");
        
        _decrementPendingGameCount(randomness.length);
        _incrementLastRandomnessPostedGameId(randomness.length);
    }

    function reveal(bytes32 _secret) external whenNotPaused {
        Game storage playerGame = games[getCurrentGameId(msg.sender)];
        require(playerGame.gameState == State.HashPosted, "Game not ready for reveal");
        require(keccak256(abi.encode(_secret)) == playerGame.playerCommit, "Player secret invalid");
        
        (uint playerCard, uint houseCard) = calculateGameCards(_secret, playerGame.houseRandomness);

        address winner;
        bool isTie = false;
        
        if (playerCard > houseCard) {
            winner = msg.sender;
        } else if (houseCard > playerCard) {
            winner = HOUSE;
        } else {
            isTie = true;
            winner = address(0);
        }

        playerGame.gameState = State.Revealed;
        playerGame.playerSecret = _secret;
        playerGame.playerCard = playerCard;
        playerGame.houseCard = houseCard;
        playerGame.revealTimestamp = block.timestamp;

        uint totalStake = playerGame.betAmount * 2;
        if (isTie) {
            gachaToken.mint(msg.sender, tieRewardAmount);
            emit TieRewardMinted(msg.sender, tieRewardAmount, getCurrentGameId(msg.sender));
            transferEth(payable(HOUSE), totalStake);
        } else {
            transferEth(payable(winner), totalStake);
        }
    }

    function forfeit() external whenNotPaused {
        Game storage playerGame = games[getCurrentGameId(msg.sender)];
        require(playerGame.gameState == State.HashPosted ||
                playerGame.gameState == State.Committed
                , "Game not in correct state to forfeit"
        );
        playerGame.gameState = State.Forfeited;
        transferEth(payable(HOUSE), playerGame.betAmount);
        emit GameForfeited(msg.sender, HOUSE);
    }

    // Helpers
    function transferEth(address to, uint amount) internal {
        (bool sent,) = payable(to).call{value: amount}("");
        require(sent, "Failed ETH transfer");
    }

    function calculateGameCards(bytes32 secret, bytes32 houseRandomness) public pure returns (uint, uint) {
        uint xorResult = uint(secret) ^ uint(houseRandomness);
        uint playerCard = ((xorResult >> 128) % 13) + 2;
        uint houseCard = ((xorResult & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) % 13) + 2;
        return (playerCard, houseCard);
    }

    // View functions
    function getFrontendGameState(address player) external view returns (
        uint playerEthBalance,
        uint playerGachaTokenBalance,
        State gameState,
        bytes32 playerCommit,
        bytes32 houseRandomness,
        uint gameId,
        Game[] memory recentHistory
    ) {
        uint currentGameId = getCurrentGameId(player);
        Game storage playerGame = games[currentGameId];

        uint historyLength = playerGames[player].length;
        uint returnLength = historyLength > MAX_RETURN_HISTORY ? MAX_RETURN_HISTORY : historyLength;
        recentHistory = new Game[](returnLength);

        for (uint i = 0; i < returnLength; i++) {
            uint gameIdToAdd = playerGames[player][historyLength - returnLength + i];
            recentHistory[i] = games[gameIdToAdd];
        }

        return (
            player.balance,
            gachaToken.balanceOf(player),
            playerGame.gameState,
            playerGame.playerCommit,
            playerGame.houseRandomness,
            currentGameId,
            recentHistory
        );
    }

    function getBackendGameState() external view returns (uint, uint, uint[] memory) {
        uint currentPendingCount = pendingGameCount();
        uint[] memory pendingBetAmounts = new uint[](currentPendingCount);
        uint pendingIndex = 0;
        
        for (uint i = lastRandomnessPostedGameId() + 1; i <= nextGameId && pendingIndex < currentPendingCount; i++) {
            Game storage game = games[i];
            if (game.gameState == State.Committed) {
                pendingBetAmounts[pendingIndex] = game.betAmount;
                pendingIndex++;
            }
        }
        
        return (
            lastRandomnessPostedGameId(),
            currentPendingCount,
            pendingBetAmounts
        );
    }

    function getGames(uint offset, uint amount, bool ascendant) external view returns (Game[] memory) {
        uint endIndex = offset + amount;
        if (endIndex > nextGameId) {
            endIndex = nextGameId;
        }

        uint actualAmount = endIndex - offset;
        Game[] memory result = new Game[](actualAmount);

        for (uint i = 0; i < actualAmount; i++) {
            uint gameId;
            if (ascendant) {
                gameId = offset + i + 1; // +1 because game IDs start from 1
            } else {
                gameId = nextGameId - offset - i;
            }
            result[i] = games[gameId];
        }
        
        return result;
    }

    function getCurrentGameId(address player) public view returns(uint) {
        uint gameAmount = playerGames[player].length;
        if (gameAmount == 0)
            return 0;
        return playerGames[player][gameAmount-1];
    }

    function getBetAmountsArray() external view returns (uint[] memory) {
        return betAmountsArray;
    }

    // Owner functions
    function setBetAmounts(uint[] memory _betAmounts) external onlyOwner {
        for (uint i = 0; i < betAmountsArray.length; i++) {
            whitelistedBetAmounts[betAmountsArray[i]] = false;
        }
        
        betAmountsArray = _betAmounts;
        for (uint i = 0; i < _betAmounts.length; i++) {
            whitelistedBetAmounts[_betAmounts[i]] = true;
        }
        
        emit BetAmountsUpdated(_betAmounts);
    }

    function setTieRewardAmount(uint _newAmount) external onlyOwner {
        tieRewardAmount = _newAmount;
        emit TieRewardAmountUpdated(_newAmount);
    }

    function setGachaToken(address _gachaToken) external onlyOwner {
        gachaToken = GachaToken(_gachaToken);
    }

    function withdrawStuckFunds() external onlyOwner {
        require(address(this).balance > 0, "No funds to withdraw");
        transferEth(payable(owner()), address(this).balance);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Bit manipulation functions
    function lastRandomnessPostedGameId() public view returns (uint) {
        return packedGameState >> 128;
    }

    function pendingGameCount() public view returns (uint) {
        return packedGameState & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    }

    function _setLastRandomnessPostedGameId(uint _value) private {
        uint currentPendingCount = pendingGameCount();
        packedGameState = (_value << 128) | currentPendingCount;
    }

    function _setPendingGameCount(uint _value) private {
        uint currentLastPosted = lastRandomnessPostedGameId();
        packedGameState = (currentLastPosted << 128) | _value;
    }

    function _incrementLastRandomnessPostedGameId(uint _increment) private {
        uint currentValue = lastRandomnessPostedGameId();
        _setLastRandomnessPostedGameId(currentValue + _increment);
    }

    function _incrementPendingGameCount() private {
        uint currentValue = pendingGameCount();
        _setPendingGameCount(currentValue + 1);
    }

    function _decrementPendingGameCount(uint _decrement) private {
        uint currentValue = pendingGameCount();
        _setPendingGameCount(currentValue - _decrement);
    }
    // End of bit manipulation functions
}