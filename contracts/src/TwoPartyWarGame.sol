// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./GachaToken.sol";

contract TwoPartyWarGame is Ownable {
    enum State { NotStarted, Committed, HashPosted, Revealed, Forfeited }

    struct Game {
        State gameState;

        address playerAddress;
        bytes32 playerCommit;
        uint commitTimestamp;

        bytes32 houseHash;
        uint houseHashTimestamp;

        bytes32 playerSecret;
        uint playerCard;
        uint houseCard;
        uint revealTimestamp;
    }

    mapping(uint gameId => Game) public games;
    mapping(address player => uint[] gameIds) playerGames;
    
    uint public constant MAX_RETURN_HISTORY = 10;
    uint public constant MAX_PENDING_GAMES = 20;
    
    address public immutable house;
    uint public constant STAKE_AMOUNT = 0.000001 ether;
    uint public nextGameId;
    uint public lastRandomnessPostedGameId;
    uint public pendingGameCount;
    
    GachaToken public gachaToken;
    uint public tieRewardAmount = 100 ether;

    event GameForfeited(address indexed player, address house);
    event GameCreated(address indexed player, bytes32 commitHash, uint gameId);
    event TieRewardMinted(address indexed player, uint amount, uint gameId);
    event TieRewardAmountUpdated(uint newAmount);

    modifier onlyHouse() {
        require(msg.sender == house, "Not house");
        _;
    }

    modifier hasStaked() {
        require(msg.value == STAKE_AMOUNT, "Incorrect stake amount");
        _;
    }

    modifier hasStakedForMultiple(uint count) {
        require(msg.value == STAKE_AMOUNT * count, "Incorrect stake amount for multiple games");
        _;
    }

    constructor(address _house, address _gachaToken) Ownable(msg.sender) {
        house = _house;
        gachaToken = GachaToken(_gachaToken);
    }

    // Public functions
    function commit(bytes32 _commitHash) external payable hasStaked {
        require(pendingGameCount < MAX_PENDING_GAMES, "Too many pending games");
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
            
            houseHash: bytes32(0),
            houseHashTimestamp: 0,
            playerSecret: bytes32(0),
            playerCard: 0,
            houseCard: 0,
            revealTimestamp: 0
        });

        nextGameId++;
        pendingGameCount++;
        games[nextGameId] = newGame;
        playerGames[msg.sender].push(nextGameId);
        emit GameCreated(msg.sender, _commitHash, nextGameId);
    }

    function multiPostRandomness(bytes32[] memory randomness) external payable hasStakedForMultiple(randomness.length) onlyHouse {
        require(randomness.length > 0, "Should not be 0");
        require(randomness.length <= pendingGameCount, "Too many randomness values");
        for (uint i = 0; i < randomness.length; i++) {
            uint gameId = lastRandomnessPostedGameId + i + 1;
            Game storage playerGame = games[gameId];
            if(playerGame.gameState != State.Forfeited)
            {
                require(playerGame.gameState == State.Committed, "Game has to be commited");
                playerGame.gameState = State.HashPosted;
                playerGame.houseHash = randomness[i];
                playerGame.houseHashTimestamp = block.timestamp;
            }
        }
        lastRandomnessPostedGameId += randomness.length;
        pendingGameCount -= randomness.length;
    }

    function reveal(bytes32 _secret) external {
        Game storage playerGame = games[getCurrentGameId(msg.sender)];
        require(playerGame.gameState == State.HashPosted, "Game not ready for reveal");
        require(keccak256(abi.encode(_secret)) == playerGame.playerCommit, "Player secret invalid");
        
        (uint playerCard, uint houseCard) = calculateGameCards(_secret, playerGame.houseHash);

        address winner;
        bool isTie = false;
        
        if (playerCard > houseCard) {
            winner = msg.sender;
        } else if (houseCard > playerCard) {
            winner = house;
        } else {
            // Cards are equal - it's a tie
            isTie = true;
            winner = address(0); // No winner in a tie
        }

        playerGame.gameState = State.Revealed;
        playerGame.playerSecret = _secret;
        playerGame.playerCard = playerCard;
        playerGame.houseCard = houseCard;
        playerGame.revealTimestamp = block.timestamp;

        uint totalStake = STAKE_AMOUNT * 2;
        if (isTie) {
            gachaToken.mint(msg.sender, tieRewardAmount);
            emit TieRewardMinted(msg.sender, tieRewardAmount, getCurrentGameId(msg.sender));
            transferETH(payable(house), totalStake);
        } else {
            transferETH(payable(winner), totalStake);
        }
    }

    function forfeit() external {
        Game storage playerGame = games[getCurrentGameId(msg.sender)];
        // AI: keep it commented out for now
        require(playerGame.gameState == State.HashPosted ||
                playerGame.gameState == State.Committed
                , "Game not in correct state to forfeit"
        );
        playerGame.gameState = State.Forfeited;
        transferETH(payable(house), STAKE_AMOUNT);
        emit GameForfeited(msg.sender, house);
    }

    // Helpers
    function transferETH(address to, uint amount) internal {
        (bool sent,) = payable(to).call{value: amount}("");
        require(sent, "Failed ETH transfer");
    }

    function calculateGameCards(bytes32 secret, bytes32 houseHash) public pure returns (uint, uint) {
        uint xorResult = uint(secret) ^ uint(houseHash);
        uint playerCard = ((xorResult >> 128) % 13) + 1;
        uint houseCard = ((xorResult & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) % 13) + 1;
        return (playerCard, houseCard);
    }

    // View functions
    function getGameState(address player) external view returns (
        uint player_eth_balance,
        uint player_gacha_token_balance,
        State gameState,
        bytes32 playerCommit,
        bytes32 houseHash,
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
            playerGame.houseHash,
            currentGameId,
            recentHistory
        );
    }

    function getBackendGameState() external view returns (uint,uint) {
        return (
            lastRandomnessPostedGameId,
            pendingGameCount
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

    // Owner functions
    function setTieRewardAmount(uint _newAmount) external onlyOwner {
        tieRewardAmount = _newAmount;
        emit TieRewardAmountUpdated(_newAmount);
    }

    function setGachaToken(address _gachaToken) external onlyOwner {
        gachaToken = GachaToken(_gachaToken);
    }

    function withdrawStuckFunds() external onlyOwner {
        require(address(this).balance > 0, "No funds to withdraw");
        transferETH(payable(house), address(this).balance);
    }
}