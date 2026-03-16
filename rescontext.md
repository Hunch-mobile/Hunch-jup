Yes — here are the backend shapes currently used.

### Canonical Type Definitions

`FeedSignalItemResponse` + union wrapper from `For You`:

```10:56:C:/hunch-webapp/app/api/feed/for-you/route.ts
export interface SignalFeedItemResponse {
  id: string;
  type: 'TRADE_MILESTONE' | 'POSITION_CLOSED' | 'NEWS' | 'LEADER_ACTIVITY';
  user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    walletAddress: string;
  } | null;
  marketTicker: string;
  eventTicker: string | null;
  side: 'yes' | 'no' | null;
  milestoneType: string | null;
  milestoneValue: number | null;
  finalPnL: number | null;
  evidence: {
    id: string;
    headline: string | null;
    explanation: string | null;
    classification: string;
    highlightScore: number;
    sourceUrls: string[];
    sourceTitles: string[];
  } | null;
  createdAt: string;
  score: number;
}

export type ForYouFeedItemResponse =
  | ({ kind: 'signal'; rankScore: number } & SignalFeedItemResponse)
  | { kind: 'top_trader_trade'; id: string; createdAt: string; rankScore: number; trade: TopTraderTradeItem }
  | { kind: 'tweet'; id: string; createdAt: string; rankScore: number; tweet: MatchedTweetFeedItem };
```

`TopTraderTradeItem`:

```41:62:C:/hunch-webapp/app/lib/topTraderTradesService.ts
export interface TopTraderTradeItem {
  id: string;
  trader: {
    walletAddress: string;
    displayName: string | null;
    avatarUrl: string | null;
    xUsername: string | null;
    verifiedBadge: boolean;
    followerCount: number;
    cachedPnl: number | null;
    isFollowing: boolean;
  };
  conditionId: string;
  marketTitle: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  usdcAmount: number;
  timestamp: string;
  transactionHash: string | null;
}
```

`MatchedTweetItem` (called `MatchedTweetFeedItem` in backend):

```36:54:C:/hunch-webapp/app/lib/tweetMarketMatcher.ts
export interface MatchedTweetFeedItem {
  id: string;
  tweetId: string;
  username: string;
  accountId: string;
  content: string;
  mediaUrls: string[];
  postedAt: string;
  indexedAt: string | null;
  metrics: NewsFeedPost['metrics'];
  matchScore: number;
  matchedEvents: Array<{
    eventTicker: string;
    eventTitle: string;
    marketTicker: string;
    conditionId: string | null;
    imageUrl: string | null;
    relevanceScore: number;
  }>;
}
```

---

### Response Envelopes

`GET /api/feed/for-you` returns:

```json
{
  "items": [ /* ForYouFeedItemResponse[] */ ],
  "nextCursor": "opaque-string-or-null",
  "sourceStatus": {
    "signals": true,
    "topTraders": true,
    "tweets": true
  }
}
```

(see response construction in `for-you` route)

```362:370:C:/hunch-webapp/app/api/feed/for-you/route.ts
const response = NextResponse.json({
  items: page,
  nextCursor,
  sourceStatus: {
    signals: true,
    topTraders: topTraderRes.status === 'fulfilled',
    tweets: tweetsRes.status === 'fulfilled',
  },
});
```

`GET /api/feed/top-trader-trades` returns:

```json
{
  "trades": [ /* TopTraderTradeItem[] */ ],
  "total": 10
}
```

```28:30:C:/hunch-webapp/app/api/feed/top-trader-trades/route.ts
return NextResponse.json(
  { trades: allTrades, total: allTrades.length },
```

---

### Example `items` payload (For You)

```json
{
  "items": [
    {
      "kind": "signal",
      "rankScore": 88.4,
      "id": "cm91...",
      "type": "NEWS",
      "user": null,
      "marketTicker": "POLY-12345",
      "eventTicker": "POLY-9876",
      "side": null,
      "milestoneType": null,
      "milestoneValue": null,
      "finalPnL": null,
      "evidence": {
        "id": "ev_1",
        "headline": "Fed cut now unlikely by June",
        "explanation": "Macro prints shifted rate expectations.",
        "classification": "macro",
        "highlightScore": 0.82,
        "sourceUrls": ["https://..."],
        "sourceTitles": ["Reuters"]
      },
      "createdAt": "2026-03-14T03:07:00.000Z",
      "score": 88.4
    },
    {
      "kind": "top_trader_trade",
      "id": "top-trader-0xabc...",
      "createdAt": "2026-03-14T03:02:00.000Z",
      "rankScore": 73.2,
      "trade": {
        "id": "0xabc...",
        "trader": {
          "walletAddress": "0x123...",
          "displayName": "TraderX",
          "avatarUrl": null,
          "xUsername": "traderx",
          "verifiedBadge": true,
          "followerCount": 241,
          "cachedPnl": 12345.67,
          "isFollowing": true
        },
        "conditionId": "0xcond...",
        "marketTitle": "Will X happen?",
        "outcome": "Yes",
        "side": "BUY",
        "size": 150,
        "price": 0.61,
        "usdcAmount": 91.5,
        "timestamp": "2026-03-14T03:02:00.000Z",
        "transactionHash": "0xabc..."
      }
    },
    {
      "kind": "tweet",
      "id": "tweet-2032654700881809685",
      "createdAt": "2026-03-14T03:07:00.000Z",
      "rankScore": 69.1,
      "tweet": {
        "id": "tweet-2032654700881809685",
        "tweetId": "2032654700881809685",
        "username": "Polymarket",
        "accountId": "1261335549215989760",
        "content": "NEW POLYMARKET: US military draft authorized this year?",
        "mediaUrls": [],
        "postedAt": "2026-03-14T03:07:00.000Z",
        "indexedAt": "2026-03-14T08:22:31.727Z",
        "metrics": {
          "likeCount": 140,
          "quoteCount": 8,
          "replyCount": 57,
          "retweetCount": 25,
          "bookmarkCount": 22,
          "impressionCount": 38061
        },
        "matchScore": 35.7,
        "matchedEvents": [
          {
            "eventTicker": "POLY-9876",
            "eventTitle": "US military draft this year?",
            "marketTicker": "POLY-12345",
            "conditionId": "0xcond...",
            "imageUrl": "https://...",
            "relevanceScore": 35.7
          }
        ]
      }
    }
  ],
  "nextCursor": "eyJyYW5rU2NvcmUiOjY5LjEsImNyZWF0ZWRBdCI6IjIwMjYtMDMtMTRUMDM6MDc6MDAuMDAwWiIsImlkIjoidHdlZXQtMjAzMjY1Li4uIn0",
  "sourceStatus": {
    "signals": true,
    "topTraders": true,
    "tweets": true
  }
}
```

If you want, I can also give you a ready-to-paste `types.ts` block for your mobile app matching these exact backend contracts.