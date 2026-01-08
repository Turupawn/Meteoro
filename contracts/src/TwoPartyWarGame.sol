// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {GachaToken} from "./GachaToken.sol";

interface IVRFCoordinator {
    function requestRandomNumbers(uint32 numNumbers, uint256 seed) external returns (uint256);
}

interface IVRFConsumer {
    function rawFulfillRandomNumbers(
        uint256 requestId,
        uint256[] memory randomNumbers
    ) external;
}

contract TwoPartyWarGame is Initializable, Context, Pausable, UUPSUpgradeable, IVRFConsumer {
    // Custom Ownable implementation for upgradeable contracts
    address private _owner;

    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function __Ownable_init(address initialOwner) internal onlyInitializing {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }
    enum State { NotStarted, Pending, Completed }

    struct Game {
        State gameState;
        address playerAddress;
        uint256 betAmount;
        uint256 requestTimestamp;
        uint256 playerCard;
        uint256 houseCard;
        uint256 completedTimestamp;
        bool playerWon;
    }

    IVRFCoordinator public coordinator;
    GachaToken public gachaToken;

    mapping(uint256 gameId => Game) public games;
    mapping(address player => uint256[] gameIds) playerGames;
    mapping(uint256 requestId => uint256 gameId) public requestToGame;
    mapping(address player => bool) public hasPendingGame;
    
    // Whitelisted bet amounts
    mapping(uint256 betAmount => bool) public whitelistedBetAmounts;
    uint256[] public betAmountsArray;

    uint256 public constant MAX_RETURN_HISTORY = 10;
    uint256 public nextGameId;
    uint256 public requestCount;
    
    uint256 public tieRewardMultiplier;
    mapping(uint256 betAmount => uint256 multiplier) public betAmountMultipliers;

    event GameRequested(address indexed player, uint256 indexed gameId, uint256 indexed requestId, uint256 betAmount);
    event GameCompleted(
        address indexed player,
        uint256 indexed gameId,
        uint256 playerCard,
        uint256 houseCard,
        address winner,
        uint256 payout
    );
    event GameTied(uint256 indexed gameId, address indexed player, uint256 playerCard, uint256 houseCard, uint256 tieReward);
    event TieRewardMinted(address indexed player, uint256 amount, uint256 gameId);
    event BetAmountsUpdated(uint256[] newBetAmounts);
    event TieRewardMultiplierUpdated(uint256 newMultiplier);
    event BetAmountMultiplierUpdated(uint256 betAmount, uint256 multiplier);

    constructor() {
        _disableInitializers();
    }

    function initialize(address _coordinator, address _gachaToken, address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        // Pausable doesn't need initialization (paused defaults to false)
        // UUPSUpgradeable doesn't need initialization
        
        coordinator = IVRFCoordinator(_coordinator);
        gachaToken = GachaToken(_gachaToken);
        nextGameId = 1;
        requestCount = 0;
        tieRewardMultiplier = 10 ether;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    receive() external payable {}

    function rollDice() external payable whenNotPaused returns (uint256 gameId) {
        require(whitelistedBetAmounts[msg.value], "Bet amount not whitelisted");
        require(!hasPendingGame[msg.sender], "Already has a pending game");
        require(address(this).balance >= msg.value, "Insufficient contract balance for payout");

        hasPendingGame[msg.sender] = true;

        gameId = nextGameId++;
        uint256 seed = requestCount++;
        uint256 requestId = coordinator.requestRandomNumbers(1, seed);

        games[gameId] = Game({
            gameState: State.Pending,
            playerAddress: msg.sender,
            betAmount: msg.value,
            requestTimestamp: block.timestamp,
            playerCard: 0,
            houseCard: 0,
            completedTimestamp: 0,
            playerWon: false
        });

        playerGames[msg.sender].push(gameId);
        requestToGame[requestId] = gameId;

        emit GameRequested(msg.sender, gameId, requestId, msg.value);
        return gameId;
    }

    function rawFulfillRandomNumbers(
        uint256 requestId,
        uint256[] memory randomNumbers
    ) external override {
        require(msg.sender == address(coordinator), "Only coordinator can fulfill");
        require(randomNumbers.length > 0, "No random numbers provided");

        uint256 gameId = requestToGame[requestId];
        require(gameId != 0, "Unknown request ID");

        Game storage game = games[gameId];
        require(game.gameState == State.Pending, "Game not pending");

        address player = game.playerAddress;
        uint256 betAmount = game.betAmount;

        // Calculate cards from random number using keccak256 for better distribution
        uint256 randomNumber = randomNumbers[0];
        bytes32 playerHash = keccak256(abi.encodePacked(randomNumber, "player"));
        bytes32 houseHash = keccak256(abi.encodePacked(randomNumber, "house"));
        uint256 playerCard = (uint256(playerHash) % 13) + 2;
        uint256 houseCard = (uint256(houseHash) % 13) + 2;

        game.playerCard = playerCard;
        game.houseCard = houseCard;
        game.completedTimestamp = block.timestamp;
        game.gameState = State.Completed;

        hasPendingGame[player] = false;

        address winner;
        uint256 payout = 0;

        if (playerCard > houseCard) {
            // Player wins - gets 2x bet
            winner = player;
            payout = betAmount * 2;
            game.playerWon = true;
            _transferEth(payable(player), payout);
        } else if (houseCard > playerCard) {
            // House wins - bet stays in contract
            winner = address(this);
            game.playerWon = false;
        } else {
            // Tie - return bet to player and mint gacha tokens
            winner = address(0);
            game.playerWon = false;
            _transferEth(payable(player), betAmount);
            
            uint256 betMultiplier = betAmountMultipliers[betAmount];
            if (betMultiplier == 0) {
                betMultiplier = 1;
            }
            uint256 tieReward = playerCard * tieRewardMultiplier * betMultiplier;
            gachaToken.mint(player, tieReward);
            emit TieRewardMinted(player, tieReward, gameId);
            emit GameTied(gameId, player, playerCard, houseCard, tieReward);
        }

        emit GameCompleted(player, gameId, playerCard, houseCard, winner, payout);
        delete requestToGame[requestId];
    }

    function _transferEth(address payable to, uint256 amount) internal {
        (bool sent,) = to.call{value: amount}("");
        require(sent, "Failed ETH transfer");
    }

    // View functions
    function getInitialFrontendGameState(address player) external view returns (
        uint256 playerEthBalance,
        uint256 playerGachaTokenBalance,
        State gameState,
        uint256 gameId,
        uint256 playerCard,
        uint256 houseCard,
        Game[] memory recentHistory,
        uint256 tieRewardMultiplierValue,
        uint256[] memory betAmounts,
        uint256[] memory betAmountMultipliersArray
    ) {
        uint256 currentGameId = getCurrentGameId(player);
        Game storage playerGame = games[currentGameId];

        recentHistory = _getRecentHistory(player);
        (betAmounts, betAmountMultipliersArray) = _getBetConfig();

        return (
            player.balance,
            gachaToken.balanceOf(player),
            playerGame.gameState,
            currentGameId,
            playerGame.playerCard,
            playerGame.houseCard,
            recentHistory,
            tieRewardMultiplier,
            betAmounts,
            betAmountMultipliersArray
        );
    }

    function _getRecentHistory(address player) internal view returns (Game[] memory recentHistory) {
        uint256 historyLength = playerGames[player].length;
        uint256 returnLength = historyLength > MAX_RETURN_HISTORY ? MAX_RETURN_HISTORY : historyLength;
        recentHistory = new Game[](returnLength);

        for (uint256 i = 0; i < returnLength; i++) {
            uint256 gameIdToAdd = playerGames[player][historyLength - returnLength + i];
            recentHistory[i] = games[gameIdToAdd];
        }
    }

    function _getBetConfig() internal view returns (uint256[] memory betAmounts, uint256[] memory betAmountMultipliersArray) {
        betAmounts = betAmountsArray;
        betAmountMultipliersArray = new uint256[](betAmountsArray.length);
        
        for (uint256 i = 0; i < betAmountsArray.length; i++) {
            uint256 multiplier = betAmountMultipliers[betAmountsArray[i]];
            betAmountMultipliersArray[i] = multiplier == 0 ? 1 : multiplier;
        }
    }

    function getFrontendGameState(address player) external view returns (
        uint256 playerEthBalance,
        uint256 playerGachaTokenBalance,
        State gameState,
        uint256 gameId,
        uint256 playerCard,
        uint256 houseCard
    ) {
        uint256 currentGameId = getCurrentGameId(player);
        Game storage playerGame = games[currentGameId];
        return (
            player.balance,
            gachaToken.balanceOf(player),
            playerGame.gameState,
            currentGameId,
            playerGame.playerCard,
            playerGame.houseCard
        );
    }

    function getGames(uint256 offset, uint256 amount, bool ascendant) external view returns (Game[] memory) {
        uint256 endIndex = offset + amount;
        if (endIndex > nextGameId) {
            endIndex = nextGameId;
        }

        uint256 actualAmount = endIndex - offset;
        Game[] memory result = new Game[](actualAmount);

        for (uint256 i = 0; i < actualAmount; i++) {
            uint256 id;
            if (ascendant) {
                id = offset + i + 1;
            } else {
                id = nextGameId - offset - i;
            }
            result[i] = games[id];
        }
        
        return result;
    }

    function getCurrentGameId(address player) public view returns(uint256) {
        uint256 gameAmount = playerGames[player].length;
        if (gameAmount == 0)
            return 0;
        return playerGames[player][gameAmount-1];
    }

    function getBetAmountsArray() external view returns (uint256[] memory) {
        return betAmountsArray;
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Owner functions
    function setBetAmounts(uint256[] memory _betAmounts) external onlyOwner {
        for (uint256 i = 0; i < betAmountsArray.length; i++) {
            whitelistedBetAmounts[betAmountsArray[i]] = false;
        }
        
        betAmountsArray = _betAmounts;
        for (uint256 i = 0; i < _betAmounts.length; i++) {
            whitelistedBetAmounts[_betAmounts[i]] = true;
        }
        
        emit BetAmountsUpdated(_betAmounts);
    }

    function setTieRewardMultiplier(uint256 _newMultiplier) external onlyOwner {
        tieRewardMultiplier = _newMultiplier;
        emit TieRewardMultiplierUpdated(_newMultiplier);
    }

    function setBetAmountMultiplier(uint256 _betAmount, uint256 _multiplier) external onlyOwner {
        betAmountMultipliers[_betAmount] = _multiplier;
        emit BetAmountMultiplierUpdated(_betAmount, _multiplier);
    }

    function setGachaToken(address _gachaToken) external onlyOwner {
        gachaToken = GachaToken(_gachaToken);
    }

    function setCoordinator(address _coordinator) external onlyOwner {
        coordinator = IVRFCoordinator(_coordinator);
    }

    function withdrawFunds(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        _transferEth(payable(owner()), amount);
    }

    function depositFunds() external payable onlyOwner {}

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}

