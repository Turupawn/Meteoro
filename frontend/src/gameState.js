class GameState {
  constructor() {
    this.playerEthBalance = 0n
    this.playerGachaTokenBalance = 0n
    this.playerUsdcBalance = 0n
    
    // VRF game states: 0: NotStarted, 1: Pending, 2: Completed
    this.gameState = 0n
    this.gameId = 0n
    this.playerCard = 0n
    this.houseCard = 0n
    this.recentHistory = []
    
    this.betAmounts = []
    this.betAmountMultipliers = []
    this.selectedBetAmount = null
    this.tieRewardMultiplier = 0n
    
    this.listeners = {
      balanceUpdate: [],
      gameStateUpdate: [],
      betAmountUpdate: []
    }
  }

  updateBalances(ethBalance, gachaBalance, usdcBalance) {
    this.playerEthBalance = ethBalance
    this.playerGachaTokenBalance = gachaBalance
    this.playerUsdcBalance = usdcBalance
    this.notifyListeners('balanceUpdate', { ethBalance, gachaBalance, usdcBalance })
  }

  getEthBalance() {
    return this.playerEthBalance
  }

  getGachaTokenBalance() {
    return this.playerGachaTokenBalance
  }

  getUsdcBalance() {
    return this.playerUsdcBalance
  }

  getGachaTokenBalanceFormatted() {
    return this.playerGachaTokenBalance.toString()
  }

  updateGameState(newGameState) {
    this.gameState = newGameState.gameState
    this.gameId = newGameState.gameId
    this.playerCard = newGameState.playerCard || 0n
    this.houseCard = newGameState.houseCard || 0n
    this.recentHistory = newGameState.recentHistory || []
    this.notifyListeners('gameStateUpdate', newGameState)
  }

  getGameState() {
    return {
      gameState: this.gameState,
      gameId: this.gameId,
      playerCard: this.playerCard,
      houseCard: this.houseCard,
      recentHistory: this.recentHistory
    }
  }

  updateBetConfiguration(betAmounts, betAmountMultipliers, tieRewardMultiplier) {
    this.betAmounts = betAmounts
    this.betAmountMultipliers = betAmountMultipliers
    this.tieRewardMultiplier = tieRewardMultiplier
    
    const storedBetAmount = localStorage.getItem('selectedBetAmount')
    if (storedBetAmount) {
      const storedBetAmountBigInt = BigInt(storedBetAmount)
      const isValidBetAmount = betAmounts.includes(storedBetAmountBigInt)
      if (isValidBetAmount) {
        this.selectedBetAmount = storedBetAmountBigInt
      } else {
        this.selectedBetAmount = betAmounts[0]
        localStorage.setItem('selectedBetAmount', betAmounts[0].toString())
      }
    } else {
      this.selectedBetAmount = betAmounts[0]
      localStorage.setItem('selectedBetAmount', betAmounts[0].toString())
    }
    
    this.notifyListeners('betAmountUpdate', { betAmounts, betAmountMultipliers })
  }

  getBetAmounts() {
    return this.betAmounts
  }

  getBetAmountMultipliers() {
    return this.betAmountMultipliers
  }

  getSelectedBetAmount() {
    return this.selectedBetAmount || this.betAmounts?.[0] || 0n
  }

  setSelectedBetAmount(betAmount) {
    this.selectedBetAmount = betAmount
    localStorage.setItem('selectedBetAmount', betAmount.toString())
    this.notifyListeners('betAmountUpdate', { selectedBetAmount: betAmount })
  }

  getBetAmountMultiplier(betAmount) {
    const index = this.betAmounts.findIndex(amount => amount === betAmount)
    return index >= 0 ? this.betAmountMultipliers[index] : 1n
  }

  getMinimumPlayableBalance() {
    const selectedBetAmount = this.getSelectedBetAmount()
    if (!selectedBetAmount || selectedBetAmount === 0n) {
      return 0n
    }
    return selectedBetAmount
  }

  // Event listener management
  addListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback)
    }
  }

  removeListener(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback)
      if (index > -1) {
        this.listeners[event].splice(index, 1)
      }
    }
  }

  notifyListeners(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in ${event} listener:`, error)
        }
      })
    }
  }

  isGameReady() {
    return this.betAmounts && this.betAmounts.length > 0 && this.selectedBetAmount
  }

  hasInsufficientBalance() {
    return this.playerUsdcBalance < this.getMinimumPlayableBalance()
  }

  // Check if game is pending (waiting for VRF)
  isGamePending() {
    return this.gameState === 1n
  }

  // Debug method
  getState() {
    return {
      playerEthBalance: this.playerEthBalance.toString(),
      playerGachaTokenBalance: this.playerGachaTokenBalance.toString(),
      playerUsdcBalance: this.playerUsdcBalance.toString(),
      gameState: this.gameState.toString(),
      gameId: this.gameId.toString(),
      playerCard: this.playerCard.toString(),
      houseCard: this.houseCard.toString(),
      recentHistory: this.recentHistory,
      betAmounts: this.betAmounts.map(b => b.toString()),
      betAmountMultipliers: this.betAmountMultipliers.map(b => b.toString()),
      selectedBetAmount: this.selectedBetAmount?.toString(),
      tieRewardMultiplier: this.tieRewardMultiplier.toString()
    }
  }
}

const gameState = new GameState()

export default gameState

export const getPlayerEthBalance = () => gameState.getEthBalance()
export const getPlayerGachaTokenBalance = () => gameState.getGachaTokenBalance()
export const getPlayerUsdcBalance = () => gameState.getUsdcBalance()
export const getPlayerGachaTokenBalanceFormatted = () => gameState.getGachaTokenBalanceFormatted()
export const getBetAmountsArray = () => gameState.getBetAmounts()
export const getBetAmountMultiplier = (betAmount) => gameState.getBetAmountMultiplier(betAmount)
export const getSelectedBetAmount = () => gameState.getSelectedBetAmount()
export const setSelectedBetAmount = (betAmount) => gameState.setSelectedBetAmount(betAmount)
export const getMinimumPlayableBalance = () => gameState.getMinimumPlayableBalance()
export const getGameState = () => gameState.getGameState()
export const updateGameState = (newGameState) => gameState.updateGameState(newGameState)
export const updateBalances = (ethBalance, gachaBalance, usdcBalance) => gameState.updateBalances(ethBalance, gachaBalance, usdcBalance)
export const updateBetConfiguration = (betAmounts, betAmountMultipliers, tieRewardMultiplier) =>
  gameState.updateBetConfiguration(betAmounts, betAmountMultipliers, tieRewardMultiplier)
export const addGameStateListener = (event, callback) => gameState.addListener(event, callback)
export const removeGameStateListener = (event, callback) => gameState.removeListener(event, callback)
export const isGamePending = () => gameState.isGamePending()
