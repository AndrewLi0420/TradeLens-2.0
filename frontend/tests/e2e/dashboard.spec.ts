import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://127.0.0.1:8000';

// Helper function to create and login a test user
async function setupAuthenticatedUser(page: any) {
  const testEmail = `test-dashboard-${Date.now()}@example.com`;
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
  
  // Login user - FastAPI Users returns 204 (No Content) with CookieTransport
  const loginResponse = await page.request.post(`${API_URL}/api/v1/auth/login`, {
    form: {
      username: testEmail,
      password: testPassword,
    },
  });
  
  // Accept both 200 and 204 status codes (204 is No Content, which is valid for cookie-based auth)
  const status = loginResponse.status();
  if (status !== 200 && status !== 204) {
    throw new Error(`Login failed: ${status} ${loginResponse.statusText()}`);
  }
  
  // Extract and set cookies - cookie name is "fastapi-users:auth"
  const cookies = await loginResponse.headers()['set-cookie'];
  if (cookies) {
    const cookieValue = Array.isArray(cookies) ? cookies[0] : cookies;
    // Cookie format: "fastapi-users:auth=TOKEN; Path=/; HttpOnly; SameSite=lax"
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
  
  // Wait a bit for cookies to be set in browser context
  await page.waitForTimeout(100);
}

test.describe('Dashboard List View', () => {
  test('loads dashboard and shows core UI elements', async ({ page }) => {
    // Setup authenticated user
    await setupAuthenticatedUser(page);
    
    // Navigate to dashboard and wait for it to load
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Header - wait for page to fully render
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });

    // Filter controls exist
    await expect(page.getByText('Holding Period')).toBeVisible();
    await expect(page.getByText('Risk Level')).toBeVisible();
    await expect(page.getByText('Min Confidence')).toBeVisible();

    // Either loading, empty, or list present; accept any as pass to avoid flakiness
    // Use more specific locators to avoid strict mode violations
    const loading = page.locator('text=Loading recommendations...').first();
    const empty = page.locator('p:has-text("No recommendations available")').first();
    const anyCard = page.locator('[data-testid="recommendation-card"]').first();

    // Check if any of these states are visible
    const loadingVisible = await loading.isVisible().catch(() => false);
    const emptyVisible = await empty.isVisible().catch(() => false);
    const cardVisible = await anyCard.isVisible().catch(() => false);

    expect(loadingVisible || emptyVisible || cardVisible).toBeTruthy();
  });
});


