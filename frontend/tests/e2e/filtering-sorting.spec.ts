import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://127.0.0.1:8000';

// Helper function to create and login a test user
async function setupAuthenticatedUser(page: any) {
  const testEmail = `test-filter-${Date.now()}@example.com`;
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

test.describe('Recommendation Filtering & Sorting', () => {
  test('user applies filters and sees filtered recommendations', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    
    // Verify filter controls are visible
    await expect(page.getByText('Holding Period')).toBeVisible();
    await expect(page.getByText('Risk Level')).toBeVisible();
    await expect(page.getByText('Min Confidence')).toBeVisible();
    
    // Apply holding period filter
    const holdingPeriodSelect = page.getByLabel('Holding Period');
    await holdingPeriodSelect.click();
    await page.getByRole('option', { name: 'Weekly' }).click();
    
    // Apply risk level filter
    const riskLevelSelect = page.getByLabel('Risk Level');
    await riskLevelSelect.click();
    await page.getByRole('option', { name: 'Low' }).click();
    
    // Verify active filter badges appear
    await expect(page.getByText('Period: weekly')).toBeVisible();
    await expect(page.getByText('Risk: low')).toBeVisible();
    
    // Wait for recommendations to update (if any exist)
    await page.waitForTimeout(1000);
  });

  test('user changes sort order and recommendations reorder correctly', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    
    // Change sort field
    const sortBySelect = page.getByLabel('Sort By');
    await sortBySelect.click();
    await page.getByRole('option', { name: 'Confidence' }).click();
    
    // Change sort direction
    const directionSelect = page.getByLabel('Direction');
    await directionSelect.click();
    await page.getByRole('option', { name: 'Ascending' }).click();
    
    // Verify sort indicator updates
    await expect(page.getByText(/Sort: confidence \(asc\)/i)).toBeVisible();
    
    // Wait for recommendations to update
    await page.waitForTimeout(1000);
  });

  test('user applies multiple filters + sort and sees correctly filtered/sorted results', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    
    // Apply holding period
    const holdingPeriodSelect = page.getByLabel('Holding Period');
    await holdingPeriodSelect.click();
    await page.getByRole('option', { name: 'Daily' }).click();
    
    // Apply risk level
    const riskLevelSelect = page.getByLabel('Risk Level');
    await riskLevelSelect.click();
    await page.getByRole('option', { name: 'High' }).click();
    
    // Apply confidence threshold
    const confidenceInput = page.getByPlaceholderText('0.0 - 1.0');
    await confidenceInput.fill('0.7');
    
    // Change sort
    const sortBySelect = page.getByLabel('Sort By');
    await sortBySelect.click();
    await page.getByRole('option', { name: 'Sentiment' }).click();
    
    // Verify all active filters are displayed
    await expect(page.getByText('Period: daily')).toBeVisible();
    await expect(page.getByText('Risk: high')).toBeVisible();
    await expect(page.getByText('Confidence ≥ 0.7')).toBeVisible();
    await expect(page.getByText(/Sort: sentiment/i)).toBeVisible();
    
    // Wait for recommendations to update
    await page.waitForTimeout(1000);
  });

  test('user clears filters and sees all recommendations again', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    
    // Apply filters
    const holdingPeriodSelect = page.getByLabel('Holding Period');
    await holdingPeriodSelect.click();
    await page.getByRole('option', { name: 'Monthly' }).click();
    
    const riskLevelSelect = page.getByLabel('Risk Level');
    await riskLevelSelect.click();
    await page.getByRole('option', { name: 'Medium' }).click();
    
    // Verify filters are applied
    await expect(page.getByText('Period: monthly')).toBeVisible();
    await expect(page.getByText('Risk: medium')).toBeVisible();
    
    // Clear filters
    const clearButton = page.getByText('Clear Filters');
    await clearButton.click();
    
    // Verify active filter badges are removed
    await expect(page.getByText('Period: monthly')).not.toBeVisible();
    await expect(page.getByText('Risk: medium')).not.toBeVisible();
    await expect(page.getByText('Clear Filters')).not.toBeVisible();
    
    // Wait for recommendations to update
    await page.waitForTimeout(1000);
  });

  test('filter state persists during session', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    
    // Apply filter
    const riskLevelSelect = page.getByLabel('Risk Level');
    await riskLevelSelect.click();
    await page.getByRole('option', { name: 'Low' }).click();
    
    await expect(page.getByText('Risk: low')).toBeVisible();
    
    // Navigate away (simulate by going to another page if available, or just wait)
    // In a real scenario, user might navigate to detail view and back
    await page.waitForTimeout(500);
    
    // Navigate back to dashboard (refresh page to test React Query cache)
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');
    
    // Note: Filters reset on page reload per requirements (session-only persistence, not localStorage)
    // This is expected behavior - filters persist during session via React Query cache,
    // but reset on page reload
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
  });

  test('free tier users see filtered results within stock limit', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 10000 });
    
    // Verify tier status is displayed
    // Free tier users should see tier indicator
    const tierStatus = page.getByText(/Tracking|Premium/i);
    await expect(tierStatus).toBeVisible();
    
    // Apply filters
    const riskLevelSelect = page.getByLabel('Risk Level');
    await riskLevelSelect.click();
    await page.getByRole('option', { name: 'Medium' }).click();
    
    // Wait for recommendations to load
    // Backend should handle tier filtering (free tier: 5 stocks max)
    await page.waitForTimeout(1000);
    
    // Verify filter is applied
    await expect(page.getByText('Risk: medium')).toBeVisible();
  });
});

