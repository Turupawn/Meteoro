// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TwoPartySlotGame {
    enum State { NotStarted, Committed, Revealed }

    struct Game {
        address player;
        address house;
        bytes32 playerCommit;
        bytes32 houseHash;
        bytes32 playerSecret;
        uint256 playerStake;
        uint256 houseStake;
        State playerState;
        bool housePosted;
        uint256 result;
        address winner;
    }

    // Map player address to their game
    mapping(address => Game) public games;
    address public immutable house;
    uint256 public constant STAKE_AMOUNT = 0.0000000003 ether;

    event GameResult(address indexed player, address winner, uint256 result);
    event GameForfeited(address indexed player, address house);
    event GameCreated(address indexed player, bytes32 commitHash);

    modifier onlyPlayer() {
        require(games[msg.sender].player == msg.sender, "Not player");
        _;
    }

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
        require(playerGame.playerState == State.NotStarted, "Player already committed");
        
        playerGame.player = msg.sender;
        playerGame.house = house;
        playerGame.playerCommit = _commitHash;
        playerGame.playerStake = msg.value;
        playerGame.playerState = State.Committed;
        
        emit GameCreated(msg.sender, _commitHash);
    }

    /// @dev House posts their hash and stake for a specific player's game
    function postHash(address player, bytes32 _hash) external payable hasStaked {
        require(msg.sender == house, "Only house can post hash");
        Game storage playerGame = games[player];
        require(playerGame.playerState == State.Committed, "Player must commit first");
        require(!playerGame.housePosted, "House already posted hash");
        
        playerGame.houseHash = _hash;
        playerGame.houseStake = msg.value;
        playerGame.housePosted = true;
    }

    /// @dev Player reveals their secret and the result is computed
    function reveal(bytes32 _secret) external {
        Game storage playerGame = games[msg.sender];
        require(playerGame.playerState == State.Committed, "Player not ready to reveal");
        require(playerGame.housePosted, "House must post hash first");
        require(keccak256(abi.encode(_secret)) == playerGame.playerCommit, "Player secret invalid");
        
        playerGame.playerSecret = _secret;
        playerGame.playerState = State.Revealed;
        
        // Generate result using house's hash directly
        uint256 xorResult = (uint256(_secret) ^ uint256(playerGame.houseHash)) & 0xFFFFFFFF;
        
        address winner = (xorResult % 2 == 0) ? playerGame.player : playerGame.house;
        uint256 totalStake = playerGame.houseStake + playerGame.playerStake;
        
        // Reset game state BEFORE transfer
        _resetGame(msg.sender);
        
        // Emit event and transfer after reset
        emit GameResult(msg.sender, winner, xorResult);
        payable(winner).transfer(totalStake);
    }

    /// @dev Internal function to reset the game
    function _resetGame(address player) internal {
        Game storage playerGame = games[player];
        playerGame.playerCommit = bytes32(0);
        playerGame.houseHash = bytes32(0);
        playerGame.playerSecret = bytes32(0);
        playerGame.playerStake = 0;
        playerGame.houseStake = 0;
        playerGame.playerState = State.NotStarted;
        playerGame.housePosted = false;
        playerGame.result = 0;
        playerGame.winner = address(0);
    }

    /// @dev Player can forfeit the game if they lost their secret
    function forfeit() external {
        Game storage playerGame = games[msg.sender];
        require(playerGame.playerState == State.Committed, "Player must be committed to forfeit");
        require(playerGame.housePosted, "House must have posted hash to forfeit");
        
        // House wins by default
        uint256 totalStake = playerGame.houseStake + playerGame.playerStake;
        
        // Reset game state BEFORE transfer
        _resetGame(msg.sender);
        
        // Emit event and transfer after reset
        emit GameForfeited(msg.sender, house);
        emit GameResult(msg.sender, house, 0); // 0 indicates forfeit
        payable(house).transfer(totalStake);
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
        State playerState,
        bool housePosted,
        uint256 playerStake,
        uint256 houseStake,
        address winner
    ) {
        Game storage playerGame = games[player];
        return (
            playerGame.playerState,
            playerGame.housePosted,
            playerGame.playerStake,
            playerGame.houseStake,
            playerGame.winner
        );
    }
}
