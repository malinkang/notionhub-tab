# NotionHub Tab

NotionHub Tab turns your own Notion databases, WeRead notes, and music library
into a browser new tab page.

The extension is focused on display only. It does not connect to a NotionHub
account, and it does not upload your Notion token, WeRead key, Unsplash key, or
Pixabay key to NotionHub servers. Credentials are stored locally in browser
storage.

## Features

- Dark glass-style new tab page
- Apple, Bing, Unsplash, Pixabay, or Notion-powered backgrounds
- Clock and date display
- Notion database notes or WeRead notes
- Notion music database player
- Collapsible APlayer music player in the lower-left corner
- Background blur, brightness, fade, refresh frequency, and video mute settings
- Local-only token and API key storage

## Background Sources

Apple and Bing work without an API key.

Unsplash requires your own Unsplash Access Key. Pixabay requires your own Pixabay
API Key. The default search keyword is `wallpaper`.

Notion backgrounds require:

- Notion integration token
- Database or data source ID
- Image source: page cover or file property

If you choose a file property, open settings and click `读取` to load the Notion
schema, then select the image property.

## Notes

Notes can come from either a Notion database or WeRead.

For a Notion database, configure:

- Notion integration token
- Database or data source ID
- Content property
- Optional title, source/book, date, and cover properties

For WeRead, enter your own WeRead key. The extension only uses it locally to
fetch note data for the new tab.

## Music

Music is loaded from your own Notion database. Configure:

- Notion integration token
- Database or data source ID
- Song title property
- Audio file property
- Optional lyrics, cover, and artist properties

Only pages with an audio file are shown in the player.

## Development

```bash
pnpm install
pnpm dev
```

Build a Chrome MV3 extension:

```bash
pnpm build
```

The build output is written to `build/chrome-mv3-prod`.

## Privacy

All tokens and API keys are stored in local browser storage. This extension calls
the APIs you configure directly from the browser:

- Notion API
- WeRead API
- Unsplash API
- Pixabay API
- Bing image endpoint

It does not send your credentials to NotionHub.

## NotionHub

If you want to automatically sync WeRead, NetEase Cloud Music, flomo, podcasts,
and other services into Notion, use NotionHub:

https://www.notionhub.app
