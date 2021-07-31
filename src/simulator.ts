import Game, { GameSettings } from './game';
import Utils from './utils';
import { PlayerStrategy } from './player';
import { DeepPartial, TableRules } from './types';

export type SimulatorSettings = {
  debug: boolean;
  playerStrategy: 'basic-strategy' | 'basic-strategy-i18';
  playerBetSpread?: number[];
  playerSpots?: number[];
  playerTablePosition: number;
  playerBankroll: number;
  hands: number;
} & TableRules;

export type SimulatorResult = {
  amountEarned: string;
  amountWagered: string;
  expectedValue: string;
  handsLost: string;
  handsPlayed: string;
  handsPushed: string;
  handsWon: string;
  houseEdge: string;
  tableRules: string;
  timeElapsed: string;
  variance: string;
};

const minimumBet = 10 * 100;

export const SETTINGS_DEFAULTS: SimulatorSettings = {
  // Simulator-only settings.
  hands: 10 ** 5,
  playerStrategy: 'basic-strategy',
  playerBetSpread: undefined,
  playerSpots: undefined,

  debug: false,
  playerTablePosition: 1,
  playerBankroll: minimumBet * 1000 * 1000,

  // Table rules
  allowDoubleAfterSplit: true,
  allowLateSurrender: true,
  blackjackPayout: '3:2',
  deckCount: 2,
  hitSoft17: true,
  maxHandsAllowed: 4,
  maximumBet: 1000 * 100,
  minimumBet,
  playerCount: 6,
};

// TODO: Move to stats utils.
function sum(data: number[]) {
  return data.reduce((a, b) => a + b, 0);
}

// TODO: Move to stats utils.
function mean(data: number[]) {
  return sum(data) / data.length;
}

// TODO: Move to stats utils.
function variance(data: number[]) {
  const dataMean = mean(data);
  return sum(data.map((num) => (num - dataMean) ** 2)) / (data.length - 1);
}

function formatTableRules(settings: GameSettings) {
  return [
    `${Utils.formatCents(settings.minimumBet, {
      stripZeroCents: true,
    })}–${Utils.formatCents(settings.maximumBet, { stripZeroCents: true })}`,
    `${settings.deckCount}D`,
    settings.blackjackPayout,
    settings.hitSoft17 ? 'H17' : 'S17',
    settings.allowDoubleAfterSplit ? 'DAS' : null,
    settings.allowLateSurrender ? 'LS' : null,
    // TODO: Add a setting for resplit aces.
    'RSA',
  ].join(' ');
}

function parsePlayerStrategy(strategy: string): PlayerStrategy {
  switch (strategy) {
    case 'basic-strategy-i18':
      return PlayerStrategy.BASIC_STRATEGY_I18;
    default:
    case 'basic-strategy':
      return PlayerStrategy.BASIC_STRATEGY;
  }
}

export default class Simulator {
  settings: SimulatorSettings;
  playerStrategy: PlayerStrategy;

  constructor(settings: DeepPartial<SimulatorSettings>) {
    // TODO: Avoid `as` here. Otherwise returns `Partial<SimulatorSettings>`.
    this.settings = Utils.mergeDeep(
      SETTINGS_DEFAULTS,
      settings
    ) as SimulatorSettings;

    this.playerStrategy = parsePlayerStrategy(this.settings.playerStrategy);
  }

  clampToArray(index: number, array: number[]): number {
    return array[Utils.clamp(Math.floor(index), 0, array.length - 1)];
  }

  betAmount(hiLoTrueCount: number): number {
    // Each array index corresponds to a true count. For example, index 0 = TC
    // 0, index 1 = TC 1 and so on.
    if (this.settings.playerBetSpread) {
      return this.clampToArray(hiLoTrueCount, this.settings.playerBetSpread);
    }

    // TODO: Allow computing optimal bet spreads.
    // Simple bet spread strategy, for $10 minimum:
    // TC < 1: $10
    // TC 1: $10 * 2^0 = $10
    // TC 2: $10 * 2^1 = $20
    // TC 3: $10 * 2^2 = $40
    // TC 4: $10 * 2^3 = $80
    return hiLoTrueCount < 1
      ? this.settings.minimumBet
      : this.settings.minimumBet * 2 ** (Math.min(5, hiLoTrueCount) - 1);
  }

  spotCount(hiLoTrueCount: number): number {
    // Each array index corresponds to a true count. For example, index 0 = TC
    // 0, index 1 = TC 1 and so on.
    if (this.settings.playerSpots) {
      return this.clampToArray(hiLoTrueCount, this.settings.playerSpots);
    }

    // TODO: Allow computing optimal number of spots.
    // By default, we just play one spot regardless of the true count.
    return 1;
  }

  run(): SimulatorResult {
    const startTime = Date.now();

    const game = new Game({
      ...this.settings,

      debug: this.settings.debug,
      animationDelay: 0,
      disableEvents: true,
      playerStrategyOverride: {
        [this.settings.playerTablePosition]: this.playerStrategy,
      },
    });

    const bankroll = [game.player.balance];
    let handsWon = 0;
    let handsLost = 0;
    let handsPushed = 0;
    let handsPlayed = 0;
    let amountWagered = 0;

    while (handsPlayed < this.settings.hands) {
      const betAmount = this.betAmount(game.shoe.hiLoTrueCount);
      const spotCount = this.spotCount(game.shoe.hiLoRunningCount);

      game.run(betAmount, spotCount);

      bankroll.push(game.player.balance);

      for (const result of game.player.handWinner.values()) {
        handsPlayed += 1;
        amountWagered += betAmount;

        switch (result) {
          case 'player':
            handsWon += 1;
            break;
          case 'dealer':
            handsLost += 1;
            break;
          case 'push':
            handsPushed += 1;
            break;
        }
      }
    }

    const amountEarned = bankroll[bankroll.length - 1] - bankroll[0];

    // TODO: Estimate this based on number of players at the table.
    const handsPerHour = 50;
    const hoursPlayed = handsPlayed / handsPerHour;

    return {
      amountEarned: Utils.formatCents(amountEarned),
      amountWagered: Utils.formatCents(amountWagered),
      expectedValue: `${Utils.formatCents(amountEarned / hoursPlayed)}/hour`,
      handsLost: Utils.abbreviateNumber(handsLost),
      handsPlayed: Utils.abbreviateNumber(handsPlayed),
      handsPushed: Utils.abbreviateNumber(handsPushed),
      handsWon: Utils.abbreviateNumber(handsWon),
      houseEdge: `${((-amountEarned / amountWagered) * 100).toFixed(2)}%`,
      tableRules: formatTableRules(game.settings),
      timeElapsed: Utils.formatTime(Date.now() - startTime),
      variance: Utils.formatCents(variance(bankroll)),
    };
  }
}
