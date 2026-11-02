# Hibira Realtime for Bubble

Realtime updates, presence ("who's online"), typing indicators and approvals for [Bubble](https://bubble.io) apps,
on [Hibira](https://hibira.io)'s hosted, Pusher-compatible WebSockets. No API Connector or Toolbox scripts: drop an
element on a page, publish events from any workflow.

- **Hibira Channel** element: joins a channel and fires *an event is received*, with the event in its states.
  Presence channels list who is online and fire *a member joins* / *a member leaves*.
- **Server actions**: Publish event, Authorize channel, Request approval, Get approval, Get channel users.
- Every Hibira Channel element on a page shares **one connection**, so a visitor counts once against your plan.
- Private and presence channels are authorized **inside a normal Bubble workflow** with `Current User`, so it works on
  every Bubble plan (no backend workflow needed).

## Setup

1. Create a free account at [hibira.io](https://hibira.io) and create an app. Copy its **App ID**, **Key** and
   **Secret** (the secret is shown once).
2. In the app's settings in the Hibira portal, add your Bubble domains to **Allowed origins**, for example
   `https://yourapp.bubbleapps.io` and your custom domain.
3. In Bubble, install **Hibira Realtime** from the plugin marketplace, then fill in **App key**, **App ID** and
   **App secret** on the Plugins tab. Leave **Host** empty (it defaults to `ws.hibira.io`).

## Receive events

Drop a **Hibira Channel** element on the page and set **Channel**, for example `orders` or
`"order-" & Current page's order's unique id`. Then add a workflow:

> When **Hibira Channel A** *an event is received* → use `Hibira Channel A's Last data` (or `Last value`)

| Field | What it does |
| --- | --- |
| Channel | Channel to join. `private-` and `presence-` prefixes make it private or presence. Change it to switch channels; empty leaves. |
| Only these events | Optional comma list of event names. Empty: every event. |
| Value key | Optional key of the event's JSON data copied into **Last value**, with dots for nested keys (`order.status`). |
| Member name key | Presence: key of each member's info shown in **Member names**. Default `name`. |
| Show status | Shows a small connection badge. Off: the element draws nothing. |

**States:** Connection state, Socket ID, Subscribed, Channel type, Last event, Last data, Last value, Last channel,
Event count, Member count, Member IDs, Member names, My ID, My name, Changed member ID, Changed member name,
Auth socket ID, Auth channel, Error.

**Events:** an event is received, the channel is joined, authorization is needed, a member joins, a member leaves,
is connected, is disconnected, an error occurs.

**Element actions:** Complete authorization, Send client event, Reconnect, Disconnect.

## Send events

In any workflow, add **Hibira - Publish event**:

| Field | Example |
| --- | --- |
| Channels | `orders` (or several, comma-separated, up to 100) |
| Event | `order-updated` |
| Data | `{"order": {"id": 42, "status": "shipped"}}`, or plain text (sent as `{"text": "..."}`) |
| Data fields | Key/value pairs sent as a JSON object instead of Data |
| Skip socket ID | A Hibira Channel's **Socket ID**, so the sender doesn't get its own event |

It returns **Success** and **Error message** instead of stopping the workflow.

## Private and presence channels

Channels named `private-…` or `presence-…` ask your app before each user joins. Add one workflow:

> When **Hibira Channel A** *authorization is needed*
> 1. **Hibira - Authorize channel**: Socket ID = `Hibira Channel A's Auth socket ID`, Channel =
>    `Hibira Channel A's Auth channel`, User ID = `Current User's unique id`, User name = `Current User's name`.
>    Add an **Only when** condition to decide who may join.
> 2. **Complete authorization** (element action on Hibira Channel A): Auth = `Result of step 1's Auth`,
>    Channel data = `Result of step 1's Channel data`.

If step 1 doesn't run, the subscription is refused after 15 seconds and the element fires *an error occurs*.

On presence channels, **Member count**, **Member IDs** and **Member names** stay up to date. On private and presence
channels, **Send client event** sends straight from the browser to everyone else (turn on client events in the
Hibira app settings): typing indicators, cursors, "someone is editing".

## Approvals

**Hibira - Request approval** creates a decision request and returns an **Approval link** to send to a person (it
can also announce the request on a channel or by push). **Hibira - Get approval** returns **Status** (`pending`,
`approved`, `rejected`, `expired`), **Choice** and **Comment**, and can wait up to 25 seconds for the answer. Typical
use: a refund over a limit waits for a manager.

## Development

This repository is the plugin in Bubble's GitHub sync format, so the Bubble plugin editor can read it:

- `meta_data.json`: the marketplace listing and the instructions shown to app builders.
- `shared_tech_params.json`: the plugin settings (App key, Host, App ID, App secret).
- `elements/AXA/`: the Hibira Channel element. `headers.html` holds the runtime (one shared pusher-js connection per
  page); `initialize.js`, `update.js`, `reset.js` and `element_actions/` are thin wrappers around it.
- `actions/<ID>/`: one server-side action each (`params.json`, `server.js`, `client.js`).
- IDs such as `AXA` or `AYb` are what users' apps refer to: never change or reuse one.

Bubble actions can't share modules, so every `server.js` starts with the same helper block. Edit
`tools/helpers.js`, then run `node tools/sync-helpers.mjs`.

```sh
npm ci
npm test       # structure checks + server actions against the official pusher library (no network)
npm run e2e    # element + server actions in Chromium against a running server (see below)
```

`npm run e2e` expects a Pusher-compatible server at `http://127.0.0.1:6001` with app `test-app`, key `test-key`,
secret `test-secret-0123456789abcdef` and client events on, or `HIBIRA_HOST`, `HIBIRA_APP_ID`, `HIBIRA_KEY` and
`HIBIRA_SECRET` for another one. It stands in for Bubble's element runtime and workflows, and checks presence,
authorization (allowed and refused), publishing with a skipped socket, event filters, client events, channel switching
and disconnecting.

Publishing to the Bubble marketplace: [docs/publishing.md](docs/publishing.md).

## License

MIT

## 中文摘要

Hibira Realtime 是給 Bubble 的外掛：在頁面放一個 **Hibira Channel** 元素、設定頻道，就能在工作流程裡接收即時事件；
任何工作流程都能用 **Hibira - Publish event** 推送事件。`presence-` 頻道會列出在線成員並觸發加入/離開事件，
`private-`/`presence-` 頻道在一般 Bubble 工作流程中以 Current User 授權（不需要後端工作流程或付費方案）。
另有審批（Request approval / Get approval）與查詢在線使用者的伺服器動作。同一頁面所有元素共用一條連線。
設定：在 hibira.io 建立應用，將 App key、App ID、App secret 填入 Bubble 的 Plugins 頁，並把 Bubble 網域加入
Allowed origins。
