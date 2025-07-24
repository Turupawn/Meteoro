// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TwoPartyWarGame {
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
        address winner;
        uint revealTimestamp;
    }

    mapping(uint gameId => Game) public games;
    mapping(address player => uint[] gameIds) playerGames;
    
    uint public constant MAX_RETURN_HISTORY = 10;
    
    address public immutable house;
    uint public constant STAKE_AMOUNT = 0.000001 ether;
    uint public nextGameId;

    event GameForfeited(address indexed player, address house);
    event GameCreated(address indexed player, bytes32 commitHash, uint gameId);

    modifier onlyHouse() {
        require(msg.sender == house, "Not house");
        _;
    }

    modifier hasStaked() {
        require(msg.value == STAKE_AMOUNT, "Incorrect stake amount");
        _;
    }

    constructor(address _house) {
        house = _house;
    }

    function commit(bytes32 _commitHash) external payable hasStaked {
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
            winner: address(0),
            revealTimestamp: 0
        });

        nextGameId++;
        games[nextGameId] = newGame;
        playerGames[msg.sender].push(nextGameId);
        emit GameCreated(msg.sender, _commitHash, nextGameId);
    }

    function multiPostHash(uint32[] memory gameIds, bytes32[] memory randomness) external payable hasStaked onlyHouse {
        for (uint i = 0; i < gameIds.length; i++) {
            Game storage playerGame = games[gameIds[i]];
            require(playerGame.gameState == State.Committed, "Game has to be commited");
            playerGame.gameState = State.HashPosted;
            playerGame.houseHash = randomness[i];
            playerGame.houseHashTimestamp = block.timestamp;
        }
    }

    function reveal(bytes32 _secret) external {
        Game storage playerGame = games[getCurrentGameId(msg.sender)];
        require(playerGame.gameState == State.HashPosted, "Game not ready for reveal");
        require(keccak256(abi.encode(_secret)) == playerGame.playerCommit, "Player secret invalid");
        
        (uint playerCard, uint houseCard) = calculateGameCards(_secret, playerGame.houseHash);

        address winner;
        if (playerCard > houseCard) {
            winner = msg.sender;
        } else {
            winner = house;
        }

        playerGame.gameState = State.Revealed;

        playerGame.playerSecret = _secret;
        playerGame.playerCard = playerCard;
        playerGame.houseCard = houseCard;
        playerGame.winner = winner;
        playerGame.revealTimestamp = block.timestamp;

        uint totalStake = STAKE_AMOUNT * 2;
        payable(winner).transfer(totalStake);
    }

    function calculateGameCards(bytes32 secret, bytes32 houseHash) public pure returns (uint, uint) {
        uint xorResult = uint(secret) ^ uint(houseHash);
        uint playerCard = ((xorResult >> 128) % 13) + 1;
        uint houseCard = ((xorResult & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) % 13) + 1;
        return (playerCard, houseCard);
    }

    function forfeit() external {
        Game storage playerGame = games[getCurrentGameId(msg.sender)];
        // AI: keep it commented out for now
        //require(playerGame.gameState == State.HashPosted, "Game not in correct state to forfeit");
        
        
        playerGame.gameState = State.Forfeited;
        
        // Transfer stakes to house
        uint totalStake = STAKE_AMOUNT * 2;
        // AI: keep it commented out for now
        //payable(house).transfer(totalStake);
        
        // Emit events
        emit GameForfeited(msg.sender, house);
    }

    // Add a function to withdraw stuck funds (only house)
    function withdrawStuckFunds() external onlyHouse {
        require(address(this).balance > 0, "No funds to withdraw");
        (bool sent,) = payable(house).call{value: address(this).balance}("");
        require(sent, "Failed to send Ether");
    }

    // Function to get game state and last 10 games for a specific player
    function getGameState(address player) external view returns (
        uint player_balance,
        State gameState,
        bytes32 playerCommit,
        bytes32 houseHash,
        uint gameId,
        Game[] memory recentHistory
    ) {
        uint currentGameId = getCurrentGameId(player);
        Game storage playerGame = games[currentGameId];
        
        // Create a new array for the last 10 games
        uint historyLength = playerGames[player].length;
        uint returnLength = historyLength > MAX_RETURN_HISTORY ? MAX_RETURN_HISTORY : historyLength;
        recentHistory = new Game[](returnLength);
        
        // Copy the last 10 games (or all if less than 10)
        for (uint i = 0; i < returnLength; i++) {
            uint gameIdToAdd = playerGames[player][historyLength - returnLength + i];
            recentHistory[i] = games[gameIdToAdd];
        }
        
        return (
            player.balance,
            playerGame.gameState,
            playerGame.playerCommit,
            playerGame.houseHash,
            currentGameId,
            recentHistory
        );
    }

    function getCurrentGameId(address player) public view returns(uint) {
        uint gameAmount = playerGames[player].length;
        if (gameAmount == 0)
            return 0;
        return playerGames[player][gameAmount-1];
    }
}
