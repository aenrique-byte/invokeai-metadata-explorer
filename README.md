# InvokeAI Metadata Explorer

A powerful, browser-based tool for reviewing, filtering, and organizing thousands of InvokeAI-generated images by their metadata. All processing happens locally in your browser - your images never leave your computer.

![InvokeAI Lens](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-6.2.0-646CFF?logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?logo=typescript)

## ✨ Features

### 📸 Image Management
- **Bulk Loading**: Load thousands of PNG images at once
- **Folder Selection**: Choose entire folders of images
- **Smart Filtering**: Filter by models, tags, prompts, or custom names
- **Metadata Extraction**: Automatically reads InvokeAI metadata from PNG files

### 🔍 Powerful Search & Filter
- **Search**: Find images by prompt text or custom names
- **Tag Filtering**: Automatically extracted tags from prompts
- **Model Filtering**: Filter by AI model used
- **Liked Images**: Mark favorites for easy access

### 🎯 Organize & Export
- **Image Renaming**: Custom names for export
- **WEBP Export**: Export liked images as optimized WEBP files (85% quality)
- **Metadata Export**: Generate markdown reports with all metadata
- **Bulk Removal**: Remove filtered images or images missing metadata
- **Keyboard Navigation**: Arrow keys, L to like, Esc to close

### 🚀 Performance
- **Local Processing**: Everything runs in your browser
- **Lazy Loading**: Only renders visible images
- **Chunked Processing**: Handles thousands of images smoothly
- **Memory Efficient**: Optimized for large image collections

## 🖥️ Live Demo

Try it now: **[https://aenrique-byte.github.io/invokeai-metadata-explorer/](https://aenrique-byte.github.io/invokeai-metadata-explorer/)**

## 🛠️ Local Development

### Prerequisites
- Node.js 20+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/aenrique-byte/invokeai-metadata-explorer.git
cd invokeai-metadata-explorer

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
npm run preview
```

## 📖 How to Use

1. **Load Images**
   - Click "Select Folder" to load an entire folder of InvokeAI PNG images
   - Or click "Add Files" to select specific images

2. **Filter & Search**
   - Use the sidebar to filter by models, tags, or toggle "Only Show Liked"
   - Search by prompt text or custom names using the search bar
   - View image count: Total images vs. filtered results

3. **Review Images**
   - Click any image to view full metadata
   - Use arrow keys (← →) to navigate
   - Press 'L' to like/unlike the selected image
   - Each liked image prompts for a custom export name

4. **Organize**
   - Remove images missing metadata with "Clean Missing"
   - Remove all filtered images with "Remove Filtered"
   - Clear entire session to start fresh

5. **Export**
   - **Export Liked as WEBP**: Converts and downloads liked images as optimized WEBP files
   - **Export Metadata (MD)**: Creates a markdown file with all metadata and filenames

## 🔒 Privacy

- **100% Local Processing**: All image processing happens in your browser
- **No Uploads**: Your images never leave your computer
- **No Tracking**: No analytics, no cookies, no data collection

## 🏗️ Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling via CDN
- **PNG Metadata** - Custom metadata extraction

## 📝 License

MIT License - feel free to use this for your own projects!

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 🙏 Acknowledgments

Built for the InvokeAI community to make image management easier and faster.

---

**Note**: This tool is designed for PNG images with InvokeAI metadata. Images without metadata can still be loaded but won't have filtering capabilities.
