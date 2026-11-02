# Publishing to the Bubble marketplace

The plugin lives in Bubble's plugin editor; this repository is its source. Bubble only syncs with GitHub after the
account has published one marketplace item (or registered as a seller), and it syncs with a repository it creates
itself, so the first release takes these steps.

## 1. Create the plugin and publish a first version

1. Sign in at [bubble.io](https://bubble.io) (a free account works) and open
   [Plugins → New plugin](https://bubble.io/home?tab=plugins). Name it **Hibira Realtime**.
2. **General** tab: copy the name, description, categories (Technical, Productivity) and instructions from
   `meta_data.json`. Link: `https://hibira.io`. Icon: `docs/icon.png` (512×512).
3. **Settings / Versions** tab: license **Open source (MIT)**, price **Free**. Publish version `1.0.0`
   ("Initial listing").

## 2. Connect GitHub

1. Link GitHub on [Account → Marketplace → Settings](https://bubble.io/account/marketplace/settings) (only needed if
   the Bubble account wasn't created with GitHub).
2. In the plugin editor's **Versions** tab, click **Synchronize with GitHub**. Bubble creates a public repository
   named after the plugin (for example `Bubble-Plugin-Hibira-Realtime`) in the linked GitHub account.

## 3. Load this repository into Bubble

Copy this repository's plugin files into the repository Bubble created and push:

```sh
git clone https://github.com/<you>/Bubble-Plugin-Hibira-Realtime bubble-sync
git clone https://github.com/hibira-io/bubble hibira-bubble
rsync -a --delete --exclude .git --exclude node_modules hibira-bubble/ bubble-sync/
cd bubble-sync && git add -A && git commit -m "Hibira Realtime 1.1.0" && git push
```

Then click **Synchronize with GitHub** again and **Reload** in the dialog that says a new version was fetched
(closing the dialog without Reload leaves the editor unchanged). Check in the editor:

- **Shared**: App key, Host, App ID, App secret; the pusher-js header.
- **Elements**: Hibira Channel with 5 fields, 19 states, 8 events and 4 actions.
- **Actions**: Hibira - Publish event, Authorize channel, Request approval, Get approval, Get channel users.

Test it in a Bubble app (Plugins → Add plugins → your plugin, then follow the README), then publish version `1.1.0`.

If the editor refuses the files (for example because it won't take IDs it didn't assign), create the items by hand
in the editor with the captions and names from the `params.json` files, paste the code from the `.js` and
`headers.html` files, and sync once more: Bubble then writes its own IDs back to GitHub, and those replace ours here.

## Later releases

Change this repository through pull requests, then repeat step 3 and publish a new version in the editor. Never
change an existing ID: users' apps refer to them.
