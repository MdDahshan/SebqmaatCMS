# Sebqmaat CMS

Sebqmaat CMS is a fast, lightweight, and local-first Content Management System built with **Tauri**, **React**, and **TypeScript**. It is designed to manage JSON and Markdown data files natively on your filesystem, providing a dynamic visual editor with built-in Git version control.

## Features

- **Local-First Architecture:** Edits files directly on your local filesystem using Tauri's native APIs. No database required.
- **Dynamic Form Generation:** Automatically generates a fully typed UI based on your JSON structures. Supports strings, booleans, numbers, arrays, and deeply nested objects.
- **Integrated Git Version Control:** View untracked, staged, and unstaged changes. Commit and push directly from the UI.
- **Git Diff Viewer:** Compare your current edits against the last commit side-by-side and easily revert specific lines or sections.
- **Media Preview:** Seamlessly previews images and videos (local paths, URLs, or YouTube embeds) referenced in your content.
- **Global Search:** Fast full-text search across all your content files.
- **Modern UI/UX:** Built with React, Tailwind CSS, and Framer Motion for a fluid and beautiful desktop experience.

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Framer Motion, React Hook Form
- **Backend:** Rust, Tauri
- **Build Tool:** Vite

## Getting Started

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Rust](https://www.rust-lang.org/)
- OS-specific dependencies for Tauri (e.g., `build-essential`, `libwebkit2gtk-4.0-dev` on Linux)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/SebqmaatCMS.git
   cd SebqmaatCMS
   ```

2. Install NPM dependencies:
   ```bash
   npm install
   ```

3. Run the application in development mode:
   ```bash
   npm run tauri dev
   ```

### Building for Production

To compile a standalone binary for your OS:
```bash
npm run tauri build
```
The compiled application will be available in `src-tauri/target/release/bundle/`.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page if you want to contribute.

## License

This project is open-source and available under the [MIT License](LICENSE).
