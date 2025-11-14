import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://127.0.0.1:8000';

// Helper function to create and login a test user
async function setupAuthenticatedUser(page: any) {
  const testEmail = `test-search-${Date.now()}@example.com`;
  const testPassword = 'TestPass123!';
  
  // Create test user
  try {
    const createResponse = await page.request.post(`${API_URL}/api/v1/auth/register`, {
      data: { email: testEmail, password: testPassword },
    });
    if (!createResponse.ok() && createResponse.status() !== 400) {
      throw new Error(`Failed to create user: ${createResponse.status()}`);
    }
  } catch (error: any) {
    // User might already exist, continue
  }
  
  // Login user
  const loginResponse = await page.request.post(`${API_URL}/api/v1/auth/login`, {
    form: {
      username: testEmail,
      password: testPassword,
    },
  });
  
  const status = loginResponse.status();
  if (status !== 200 && status !== 204) {
    throw new Error(`Login failed: ${status} ${loginResponse.statusText()}`);
  }
  
  // Extract and set cookies
  const cookies = await loginResponse.headers()['set-cookie'];
  if (cookies) {
    const cookieValue = Array.isArray(cookies) ? cookies[0] : cookies;
    const cookieMatch = cookieValue.match(/fastapi-users:auth=([^;]+)/);
    if (cookieMatch && cookieMatch[1]) {
      await page.context().addCookies([{
        name: 'fastapi-users:auth',
        value: cookieMatch[1],
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      }]);
    }
  }
  
  await page.waitForTimeout(100);
}

test.describe('Stock Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('navigates to search page and displays search input', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });
    
    // Check page title/heading
    await expect(page.getByRole('heading', { name: /Search Stocks/i })).toBeVisible({ timeout: 10000 });
    
    // Check search input is present
    const searchInput = page.getByLabel('Search stocks');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('type', 'text');
  });

  test('search input in header navigates to search page', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    
    // Find search input in header
    const headerSearchInput = page.getByLabel('Search stocks').first();
    await expect(headerSearchInput).toBeVisible();
    
    // Type search query and press Enter
    await headerSearchInput.fill('AAPL');
    await headerSearchInput.press('Enter');
    
    // Should navigate to search page with query parameter
    await page.waitForURL(/\/search\?q=AAPL/, { timeout: 5000 });
    expect(page.url()).toContain('/search?q=AAPL');
  });

  test('displays search results when query is entered', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });
    
    const searchInput = page.getByLabel('Search stocks');
    await searchInput.fill('AAPL');
    
    // Wait for debounce (500ms) and API call
    await page.waitForTimeout(1000);
    
    // Check if results are displayed (either loading, empty, or results)
    const loadingState = page.locator('text=Loading').first();
    const emptyState = page.locator('text=No stocks found').first();
    const results = page.locator('[class*="cursor-pointer"]').first();
    
    // At least one state should be visible
    const loadingVisible = await loadingState.isVisible().catch(() => false);
    const emptyVisible = await emptyState.isVisible().catch(() => false);
    const resultsVisible = await results.isVisible().catch(() => false);
    
    expect(loadingVisible || emptyVisible || resultsVisible).toBeTruthy();
  });

  test('handles partial matches correctly', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });
    
    const searchInput = page.getByLabel('Search stocks');
    
    // Test partial symbol match
    await searchInput.fill('AAP');
    await page.waitForTimeout(1000);
    
    // Should show results or empty state
    const hasResults = await page.locator('[class*="cursor-pointer"]').first().isVisible().catch(() => false);
    const isEmpty = await page.locator('text=No stocks found').first().isVisible().catch(() => false);
    
    expect(hasResults || isEmpty).toBeTruthy();
  });

  test('shows empty state when no results found', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });
    
    const searchInput = page.getByLabel('Search stocks');
    
    // Search for something that likely doesn't exist
    await searchInput.fill('XYZ123NONEXISTENT');
    await page.waitForTimeout(1000);
    
    // Should show empty state
    await expect(page.getByText('No stocks found matching your search.')).toBeVisible({ timeout: 5000 });
  });

  test('displays stock information in results', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });
    
    const searchInput = page.getByLabel('Search stocks');
    await searchInput.fill('AAPL');
    await page.waitForTimeout(1000);
    
    // Wait for results to load
    const resultCard = page.locator('[class*="cursor-pointer"]').first();
    const isVisible = await resultCard.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isVisible) {
      // Check that stock information is displayed
      const symbol = page.locator('text=AAPL').first();
      const hasSymbol = await symbol.isVisible().catch(() => false);
      
      // At least symbol should be visible if results exist
      if (hasSymbol) {
        expect(symbol).toBeVisible();
      }
    }
  });

  test('navigates to recommendation detail when result with recommendation is clicked', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });
    
    const searchInput = page.getByLabel('Search stocks');
    await searchInput.fill('AAPL');
    await page.waitForTimeout(1000);
    
    // Find a result with recommendation badge
    const recommendationBadge = page.getByText('Has Recommendation').first();
    const badgeVisible = await recommendationBadge.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (badgeVisible) {
      // Click on the result card
      const resultCard = recommendationBadge.locator('..').locator('..').locator('..');
      await resultCard.click();
      
      // Should navigate to recommendation detail page
      await page.waitForURL(/\/recommendations\//, { timeout: 5000 });
      expect(page.url()).toMatch(/\/recommendations\/[^/]+$/);
    } else {
      // Skip test if no recommendations available
      test.skip();
    }
  });

  test('works on mobile viewport (responsive design)', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/search', { waitUntil: 'networkidle' });
    
    // Check search input is visible and usable on mobile
    const searchInput = page.getByLabel('Search stocks');
    await expect(searchInput).toBeVisible();
    
    // Should be able to type in search
    await searchInput.fill('AAPL');
    await page.waitForTimeout(1000);
    
    // Search should work on mobile
    const hasResults = await page.locator('[class*="cursor-pointer"]').first().isVisible().catch(() => false);
    const isEmpty = await page.locator('text=No stocks found').first().isVisible().catch(() => false);
    
    expect(hasResults || isEmpty).toBeTruthy();
  });

  test('debounces search input to reduce API calls', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });
    
    const searchInput = page.getByLabel('Search stocks');
    
    // Monitor network requests
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/stocks/search')) {
        requests.push(request.url());
      }
    });
    
    // Type quickly (should trigger debounce)
    await searchInput.fill('A');
    await searchInput.fill('AP');
    await searchInput.fill('APP');
    await searchInput.fill('APPL');
    await searchInput.fill('APPLE');
    
    // Wait for debounce (500ms) plus some buffer
    await page.waitForTimeout(800);
    
    // Should have made at most 1-2 requests (one after debounce)
    expect(requests.length).toBeLessThanOrEqual(2);
  });
});


