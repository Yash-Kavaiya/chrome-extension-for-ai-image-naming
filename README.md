# AI File Namer - Chrome Extension

A Chrome extension that automatically renames downloaded images with meaningful, descriptive filenames using Google Gemini AI with built-in OCR analysis.

## Features

- **Auto-rename on download** - Intercepts image downloads and renames them with AI-generated descriptive names
- **OCR-aware naming** - If the image contains readable text, the AI incorporates key text into the filename
- **Right-click context menu** - Right-click any image on a webpage and select "Download with AI Name"
- **Rename history** - Track all renamed files in the extension popup
- **Toggle on/off** - Easily enable or disable auto-renaming

## How It Works

1. When you download an image, the extension captures it
2. The image is sent to Google Gemini AI (gemini-2.0-flash) for analysis
3. Gemini examines the visual content and any text (OCR) in the image
4. A short, descriptive filename is generated (e.g., `sunset-mountain-lake.jpg`)
5. The download is renamed automatically

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked** and select the extension folder
5. Click the extension icon and enter your Gemini API key
6. Get a free API key at [Google AI Studio](https://aistudio.google.com/apikey)

## Usage

### Automatic Mode
Simply download any image - the extension will automatically rename it.

### Manual Mode (Context Menu)
1. Right-click any image on a webpage
2. Select **"Download with AI Name"**
3. The image downloads with an AI-generated filename

### Settings
- Click the extension icon to open the popup
- Toggle auto-rename on/off
- Enter or update your Gemini API key
- Test your API key connectivity
- View recent rename history

## Supported Image Formats

JPEG, PNG, GIF, WebP, BMP, SVG

## File Structure

```
├── manifest.json     # Extension configuration
├── background.js     # Service worker (download interception, Gemini API)
├── popup.html        # Extension popup UI
├── popup.css         # Popup styles
├── popup.js          # Popup logic
└── icons/            # Extension icons
    ├── icon.svg
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## API

This extension uses the [Google Gemini API](https://ai.google.dev/gemini-api/docs) (gemini-2.0-flash model) with inline image data for vision analysis.
