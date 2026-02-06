const { chromium } = require('playwright');

/**
 * Scrapes a Twitter/X thread and extracts tweets from the original poster (OP)
 * @param {string} url - The URL of the tweet
 * @returns {Promise<string[]>} - Array of tweet texts from the OP
 */
async function scrapeThread(url) {
  let browser;
  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    // Navigate to the tweet
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for tweets to load
    await page.waitForTimeout(3000);

    // Extract the username from the first tweet (OP)
    const opUsername = await page.evaluate(() => {
      const firstTweet = document.querySelector('[data-testid="tweet"]');
      if (!firstTweet) return null;
      
      const usernameElement = firstTweet.querySelector('[data-testid="User-Name"] a[role="link"]');
      if (usernameElement) {
        const href = usernameElement.getAttribute('href');
        return href ? href.split('/')[1] : null;
      }
      return null;
    });

    console.log('OP Username:', opUsername);

    if (!opUsername) {
      throw new Error('Could not identify original poster');
    }

    // Extract all tweets from the OP in the thread
    const tweets = await page.evaluate((username) => {
      const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
      const texts = [];

      tweetElements.forEach(tweet => {
        // Check if this tweet is from the OP
        const usernameElement = tweet.querySelector('[data-testid="User-Name"] a[role="link"]');
        if (usernameElement) {
          const href = usernameElement.getAttribute('href');
          const tweetUsername = href ? href.split('/')[1] : null;

          if (tweetUsername === username) {
            // Extract tweet text
            const tweetTextElement = tweet.querySelector('[data-testid="tweetText"]');
            if (tweetTextElement) {
              texts.push(tweetTextElement.innerText);
            }
          }
        }
      });

      return texts;
    }, opUsername);

    await browser.close();
    return tweets;

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw new Error(`Failed to scrape thread: ${error.message}`);
  }
}

module.exports = { scrapeThread };
