/**
 * FIX Protocol Parser for Financial Markets
 * 
 * Parses FIX messages (tag=value|separator format)
 * and converts to Nemosyne-compatible data structures
 */

export class FIXParser {
  constructor(config = {}) {
    this.separator = config.separator || '|';
    this.tagSeparator = config.tagSeparator || '=';
    this.beginString = config.beginString || 'FIX.4.4';
  }

  /**
   * Parse FIX message string
   * @param {string} fixString - Raw FIX message
   * @returns {Object} Parsed message
   */
  parse(fixString) {
    const tags = {};
    const pairs = fixString.split(this.separator);
    
    pairs.forEach(pair => {
      const [tag, value] = pair.split(this.tagSeparator);
      if (tag && value) {
        tags[tag.trim()] = value.trim();
      }
    });

    return {
      msgType: this.getMsgTypeName(tags['35']),
      raw: tags,
      parsed: this.enrichMessage(tags)
    };
  }

  getMsgTypeName(code) {
    const types = {
      '0': 'Heartbeat',
      '1': 'TestRequest',
      '2': 'ResendRequest',
      '3': 'Reject',
      '4': 'SequenceReset',
      '5': 'Logout',
      '6': 'IOI',
      '7': 'Advertisement',
      '8': 'ExecutionReport',
      '9': 'OrderCancelReject',
      'A': 'Logon',
      'D': 'NewOrderSingle',
      'E': 'NewOrderList',
      'F': 'OrderCancelRequest',
      'G': 'OrderCancelReplaceRequest',
      'H': 'OrderStatusRequest',
      'J': 'AllocationInstruction',
      'K': 'ListCancelRequest',
      'L': 'ListExecute',
      'M': 'ListStatusRequest',
      'N': 'ListStatus',
      'P': 'AllocationInstructionAck',
      'Q': 'DontKnowTrade',
      'R': 'QuoteRequest',
      'S': 'Quote',
      'T': 'SettlementInstructions',
      'V': 'MarketDataRequest',
      'W': 'MarketDataSnapshotFullRefresh',
      'X': 'MarketDataIncrementalRefresh',
      'Y': 'MarketDataRequestReject',
      'Z': 'QuoteCancel',
      'a': 'QuoteStatusRequest',
      'b': 'MassQuoteAck',
      'c': 'SecurityDefinitionRequest',
      'd': 'SecurityDefinition',
      'e': 'SecurityStatusRequest',
      'f': 'SecurityStatus',
      'g': 'TradingSessionStatusRequest',
      'h': 'TradingSessionStatus',
      'i': 'MassQuote',
      'j': 'BusinessMessageReject',
      'k': 'BidRequest',
      'l': 'BidResponse',
      'm': 'ListStrikePrice'
    };
    return types[code] || `Unknown(${code})`;
  }

  enrichMessage(tags) {
    const enriched = { ...tags };
    
    // Side mapping
    if (tags['54']) {
      const sides = { '1': 'BUY', '2': 'SELL', '3': 'BUY_MINUS', '4': 'SELL_PLUS', '5': 'SELL_SHORT', '6': 'SELL_SHORT_EXEMPT', '7': 'UNDISCLOSED', '8': 'CROSS', '9': 'CROSS_SHORT' };
      enriched.sideName = sides[tags['54']] || tags['54'];
    }
    
    // OrdStatus mapping
    if (tags['39']) {
      const statuses = { '0': 'NEW', '1': 'PARTIAL_FILL', '2': 'FILLED', '3': 'DONE_FOR_DAY', '4': 'CANCELLED', '5': 'REPLACED', '6': 'PENDING_CANCEL', '7': 'STOPPED', '8': 'REJECTED', '9': 'SUSPENDED', 'A': 'PENDING_NEW', 'B': 'CALCULATED', 'C': 'EXPIRED', 'D': 'ACCEPTED_FOR_BIDDING', 'E': 'PENDING_REPLACE' };
      enriched.statusName = statuses[tags['39']] || tags['39'];
    }
    
    // ExecType mapping
    if (tags['150']) {
      const execTypes = { '0': 'NEW', '1': 'PARTIAL_FILL', '2': 'FILL', '3': 'DONE_FOR_DAY', '4': 'CANCELLED', '5': 'REPLACE', '6': 'PENDING_CANCEL', '7': 'STOPPED', '8': 'REJECTED', '9': 'SUSPENDED', 'A': 'PENDING_NEW', 'B': 'CALCULATED', 'C': 'EXPIRED', 'D': 'RESTATED', 'E': 'PENDING_REPLACE', 'F': 'TRADE', 'G': 'TRADE_CORRECT', 'H': 'TRADE_CANCEL', 'I': 'ORDER_STATUS' };
      enriched.execTypeName = execTypes[tags['150']] || tags['150'];
    }
    
    // OrdType mapping
    if (tags['40']) {
      const ordTypes = { '1': 'MARKET', '2': 'LIMIT', '3': 'STOP', '4': 'STOP_LIMIT', '5': 'MARKET_ON_CLOSE', '6': 'WITH_OR_WITHOUT', '7': 'LIMIT_OR_BETTER', '8': 'LIMIT_WITH_OR_WITHOUT', '9': 'ON_BASIS', 'D': 'PREVIOUSLY_QUOTED', 'E': 'PREVIOUSLY_INDICATED', 'G': 'FOREX_SWAP', 'H': 'FUNARI', 'I': 'MARKET_IF_TOUCHED', 'J': 'MARKET_WITH_LEFT_OVER_LIMIT', 'K': 'PREVIOUS_FUND_VALUATION_POINT', 'L': 'NEXT_FUND_VALUATION_POINT', 'P': 'PEGGED' };
      enriched.ordTypeName = ordTypes[tags['40']] || tags['40'];
    }
    
    return enriched;
  }

  /**
   * Convert FIX message to Nemosyne record
   * @param {Object} parsedFix - Output from parse()
   * @returns {Object} Nemosyne-compatible record
   */
  toNemosyneRecord(parsedFix) {
    const p = parsedFix.parsed;
    
    return {
      id: p['11'] || p['37'] || `order-${Date.now()}`,
      symbol: p['55'],
      side: p['54'],
      sideName: p.sideName,
      quantity: parseFloat(p['38']) || 0,
      price: parseFloat(p['44']) || 0,
      orderType: p['40'],
      orderTypeName: p.ordTypeName,
      status: p['39'],
      statusName: p.statusName,
      execType: p['150'],
      execTypeName: p.execTypeName,
      timestamp: p['60'] || new Date().toISOString(),
      msgType: parsedFix.msgType,
      leavesQty: parseFloat(p['151']) || 0,
      cumQty: parseFloat(p['14']) || 0,
      avgPx: parseFloat(p['6']) || 0,
      raw: parsedFix.raw
    };
  }
}

/**
 * Market Data Aggregator
 * Processes order book updates for visualization
 */
export class MarketDataAggregator {
  constructor(depth = 10) {
    this.depth = depth;
    this.orderBook = { bids: [], asks: [] };
    this.trades = [];
    this.maxTrades = 100;
  }

  update(snapshot) {
    // Update bids (sorted descending)
    if (snapshot.bids) {
      this.orderBook.bids = snapshot.bids
        .sort((a, b) => b.price - a.price)
        .slice(0, this.depth);
    }
    
    // Update asks (sorted ascending)
    if (snapshot.asks) {
      this.orderBook.asks = snapshot.asks
        .sort((a, b) => a.price - b.price)
        .slice(0, this.depth);
    }
    
    // Add trades
    if (snapshot.trade) {
      this.trades.push({
        ...snapshot.trade,
        timestamp: Date.now()
      });
      
      // Trim old trades
      if (this.trades.length > this.maxTrades) {
        this.trades.shift();
      }
    }
  }

  getNemosyneData() {
    return {
      bids: this.orderBook.bids.map((b, i) => ({
        level: i,
        side: 'bid',
        price: b.price,
        size: b.size,
        total: this.orderBook.bids.slice(0, i + 1).reduce((sum, x) => sum + x.size, 0)
      })),
      asks: this.orderBook.asks.map((a, i) => ({
        level: i,
        side: 'ask',
        price: a.price,
        size: a.size,
        total: this.orderBook.asks.slice(0, i + 1).reduce((sum, x) => sum + x.size, 0)
      })),
      trades: this.trades.slice(-20),
      spread: this.orderBook.asks[0]?.price - this.orderBook.bids[0]?.price || 0
    };
  }

  getMidPrice() {
    const bestBid = this.orderBook.bids[0]?.price || 0;
    const bestAsk = this.orderBook.asks[0]?.price || 0;
    return (bestBid + bestAsk) / 2;
  }

  getVolumeWeightedPrice() {
    let totalVolume = 0;
    let totalPriceVolume = 0;
    
    [...this.orderBook.bids, ...this.orderBook.asks].forEach(level => {
      totalVolume += level.size;
      totalPriceVolume += level.price * level.size;
    });
    
    return totalVolume > 0 ? totalPriceVolume / totalVolume : 0;
  }
}
