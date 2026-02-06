# Contributing to Listen Thread

Thank you for your interest in contributing to Listen Thread!

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:
- A clear description of the problem
- Steps to reproduce the issue
- Expected vs actual behavior
- Your environment (OS, Node.js version, etc.)

### Suggesting Features

We welcome feature suggestions! Please open an issue with:
- A clear description of the feature
- Use cases and benefits
- Any implementation ideas you might have

### Code Contributions

1. **Fork the repository**

2. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the existing code style
   - Add comments for complex logic
   - Update documentation if needed

4. **Test your changes**
   ```bash
   npm start
   ```
   - Test the web interface
   - Test the API endpoints
   - Verify TTS and audio merging work

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add feature: your feature description"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request**
   - Describe what your PR does
   - Reference any related issues
   - Wait for review

## Development Setup

```bash
# Clone the repo
git clone https://github.com/ZarzueloM/listen-thread.git
cd listen-thread

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Install system dependencies (Ubuntu/Debian)
sudo apt-get install ffmpeg espeak

# Start development server
npm start
```

## Code Style

- Use 2 spaces for indentation
- Use meaningful variable names
- Add comments for complex logic
- Follow existing patterns in the codebase

## Areas for Contribution

### High Priority
- [ ] Add tests (unit and integration)
- [ ] Implement rate limiting
- [ ] Add support for more TTS engines
- [ ] Improve error handling
- [ ] Add request queue system

### Medium Priority
- [ ] Support for Instagram threads
- [ ] Support for Reddit threads
- [ ] Add API authentication
- [ ] Create Docker image
- [ ] Add TypeScript support

### Low Priority
- [ ] Web UI improvements
- [ ] Multiple language support
- [ ] Voice selection options
- [ ] Audio quality settings
- [ ] Download progress indicator

## Testing

Currently, the project doesn't have automated tests. If you'd like to contribute tests, that would be greatly appreciated!

Suggested testing areas:
- Text normalization
- Text chunking
- TTS generation
- Audio merging
- API endpoints
- Scraping logic

## Documentation

Help improve documentation by:
- Fixing typos or unclear instructions
- Adding more examples
- Translating to other languages
- Creating video tutorials
- Writing blog posts

## Questions?

Feel free to open an issue for any questions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the ISC License.
