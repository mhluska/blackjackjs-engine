const assert = require('assert');

const Utils = require('./utils');
const GameObject = require('./game-object');
const Hand = require('./hand');

module.exports = class Player extends GameObject {
  constructor() {
    super();

    this.resetHands();
  }

  addHand(cards) {
    const hand = new Hand(cards);
    hand.on('change', () => this.emit('change'));
    this.hands.push(hand);

    return hand;
  }

  resetHands() {
    this.hands = [];
    this.addHand();
  }

  takeCard(card, { hand } = {}) {
    if (hand) {
      assert(this.hands.includes(hand), 'Hand must belong to player');
    }

    const targetHand = hand || this.hands[0];
    targetHand.cards.push(card);
    this.emit('change');
  }

  removeCards({ hand } = {}) {
    if (hand) {
      return hand.removeCards();
    } else {
      const cards = this.hands.map((hand) => hand.removeCards()).flat();
      this.resetHands();
      this.emit('change');
      return cards;
    }
  }

  // TODO: Consider using `Proxy`.
  get cards() {
    return this.hands[0].cards;
  }

  // TODO: Consider using `Proxy`.
  get visibleCards() {
    return this.hands[0].visibleCards;
  }

  // TODO: Consider using `Proxy`.
  get busted() {
    return this.hands[0].busted;
  }

  // TODO: Consider using `Proxy`.
  get blackjack() {
    return this.hands[0].blackjack;
  }

  // TODO: Consider using `Proxy`.
  get cardTotal() {
    return this.hands[0].cardTotal;
  }

  // TODO: Consider using `Proxy`.
  get hasPairs() {
    return this.hands[0].hasPairs;
  }
};
