// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TwoPartyWarGame {
    enum State { NotStarted, Committed, HashPosted }

    struct Game {
        bytes32 playerCommit;
        bytes32 houseHash;
        State gameState;
    }

    // Map player address to their game
    mapping(address => Game) public games;
    address public immutable house;
    uint256 public constant STAKE_AMOUNT = 0.0000000003 ether;

    event GameResult(address indexed player, address winner, uint256 playerCard, uint256 houseCard);
    event GameForfeited(address indexed player, address house);
    event GameCreated(address indexed player, bytes32 commitHash);

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

    /// @dev Player commits to the game by sending ETH and a hash of their secret
    function commit(bytes32 _commitHash) external payable hasStaked {
        Game storage playerGame = games[msg.sender];
        require(playerGame.gameState == State.NotStarted, "Player already committed");
        
        playerGame.playerCommit = _commitHash;
        playerGame.gameState = State.Committed;
        
        emit GameCreated(msg.sender, _commitHash);
    }

    /// @dev House posts their hash and stake for a specific player's game
    function postHash(address player, bytes32 _hash) external payable hasStaked {
        require(msg.sender == house, "Only house can post hash");
        Game storage playerGame = games[player];
        require(playerGame.gameState == State.Committed, "Player must commit first");
        
        playerGame.houseHash = _hash;
        playerGame.gameState = State.HashPosted;
    }

    /// @dev Player reveals their secret and the result is computed
    function reveal(bytes32 _secret) external {
        Game storage playerGame = games[msg.sender];
        require(playerGame.gameState == State.HashPosted, "Game not ready for reveal");
        require(keccak256(abi.encode(_secret)) == playerGame.playerCommit, "Player secret invalid");
        
        // Generate result using house's hash and player's secret
        uint256 xorResult = uint256(_secret) ^ uint256(playerGame.houseHash);
        
        // Extract two card values (1-13) from the XOR result
        uint256 playerCard = ((xorResult >> 128) % 13) + 1;
        uint256 houseCard = ((xorResult & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) % 13) + 1;
        
        // Determine winner: highest card wins, ties go to house
        address winner;
        if (playerCard > houseCard) {
            winner = msg.sender;
        } else {
            winner = house;
        }
        
        // Reset game state BEFORE transfer
        _resetGame(msg.sender);
        
        // Transfer stakes to winner
        uint256 totalStake = STAKE_AMOUNT * 2;
        payable(winner).transfer(totalStake);
        
        // Emit event after transfer
        emit GameResult(msg.sender, winner, playerCard, houseCard);
    }

    /// @dev Internal function to reset the game
    function _resetGame(address player) internal {
        Game storage playerGame = games[player];
        playerGame.playerCommit = bytes32(0);
        playerGame.houseHash = bytes32(0);
        playerGame.gameState = State.NotStarted;
    }

    /// @dev Player can forfeit the game if they lost their secret
    function forfeit() external {
        Game storage playerGame = games[msg.sender];
        require(playerGame.gameState == State.HashPosted, "Game not in correct state to forfeit");
        
        // Reset game state BEFORE transfer
        _resetGame(msg.sender);
        
        // Transfer stakes to house
        uint256 totalStake = STAKE_AMOUNT * 2;
        payable(house).transfer(totalStake);
        
        // Emit events
        emit GameForfeited(msg.sender, house);
        emit GameResult(msg.sender, house, 0, 0);
    }

    // Add a function to check contract balance
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Add a function to withdraw stuck funds (only house)
    function withdrawStuckFunds() external onlyHouse {
        require(address(this).balance > 0, "No funds to withdraw");
        uint256 balance = address(this).balance;
        payable(house).transfer(balance);
    }

    // Helper functions
    function helper01String(string memory str) public pure returns(bytes32) {
        return bytes32(abi.encodePacked(str));
    }

    function helper02Commit(bytes32 b32) public pure returns(bytes32) {
        return keccak256(abi.encodePacked(b32));
    }

    // Function to get game state for a specific player
    function getGameState(address player) external view returns (
        State gameState,
        bytes32 playerCommit,
        bytes32 houseHash
    ) {
        Game storage playerGame = games[player];
        return (
            playerGame.gameState,
            playerGame.playerCommit,
            playerGame.houseHash
        );
    }

    // Helper function to get card name
    function getCardName(uint256 cardValue) public pure returns (string memory) {
        require(cardValue >= 1 && cardValue <= 13, "Invalid card value");
        
        if (cardValue == 1) return "Ace";
        if (cardValue == 11) return "Jack";
        if (cardValue == 12) return "Queen";
        if (cardValue == 13) return "King";
        
        // Convert number to string for cards 2-10
        if (cardValue == 2) return "2";
        if (cardValue == 3) return "3";
        if (cardValue == 4) return "4";
        if (cardValue == 5) return "5";
        if (cardValue == 6) return "6";
        if (cardValue == 7) return "7";
        if (cardValue == 8) return "8";
        if (cardValue == 9) return "9";
        if (cardValue == 10) return "10";
        
        return "";
    }
}
