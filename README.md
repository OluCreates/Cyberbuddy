# CyberBuddy - AI Content Detector

A Chrome browser extension that detects AI-generated content across text, images, videos, and audio in real-time.

  Problem

While AI detection tools exist, they're fragmented:
- GPTZero only checks text
- Hive AI only checks images  
- Users must juggle multiple tools
- No unified solution for all content types

  Solution

CyberBuddy is an all-in-one browser extension that:
- Detects AI text using linguistic pattern analysis
- Identifies AI images through pixel-level analysis
- Scans videos for deepfake indicators
- Verifies audio sources for synthetic voices
- Provides instant verdicts: Green (Human), Yellow (Uncertain), Red (AI)
- 100% local processing - no data leaves your browser

  Features

- **Multi-Modal Detection**: Text, images, videos, and audio
- **Real-Time Analysis**: Scan any webpage with one click
- **Privacy-First**: All processing happens locally
- **Scan History**: Track your last 25 scans
- **Zero Dependencies**: Pure vanilla JavaScript

 Tech Stack

- **JavaScript** (Vanilla - no frameworks)
- **Chrome Extension APIs** (storage, tabs, runtime, action)
- **Canvas API** (image/video analysis)
- **DOM TreeWalker** (text extraction)
- **RegEx** (pattern matching)
- **Statistical Analysis** (burstiness, perplexity indicators)

 Installation

### From Source

1. Clone this repository:
```bash
   git clone https://github.com/TheCreator771/cyberbuddy.git

Open Chrome and go to chrome://extensions/
Enable Developer mode (toggle in top right)
Click "Load unpacked"
Select the cyberbuddy folder
The extension is now installed! Click the icon to start scanning.

