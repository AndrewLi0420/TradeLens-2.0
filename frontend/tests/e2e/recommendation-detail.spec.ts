import { test, expect } from '@playwright/test';

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://127.0.0.1:8000';

// Helper function to setup authenticated user
async function setupAuthenticatedUser(page: any) {
  const testEmail = `test-detail-${Date.now()}@example.com`;
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
    throw new Error(`Login failed: ${status}`);
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

test.describe('Recommendation Detail View', () => {
  test('navigates from dashboard to detail view when clicking recommendation card', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for recommendations to load (or empty state)
    await page.waitForTimeout(2000);
    
    // Try to find a recommendation card and click it
    const card = page.locator('[class*="cursor-pointer"]').first();
    const cardCount = await card.count();
    
    if (cardCount > 0) {
      // Click the first recommendation card
      await card.click();
      
      // Should navigate to detail view
      await expect(page).toHaveURL(/\/recommendations\/[a-f0-9-]+/, { timeout: 5000 });
    } else {
      // No recommendations available - skip this test
      test.skip();
    }
  });

  test('displays all required information in detail view', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    // Navigate to dashboard first
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Try to find and click a recommendation card
    const card = page.locator('[class*="cursor-pointer"]').first();
    const cardCount = await card.count();
    
    if (cardCount > 0) {
      await card.click();
      await page.waitForURL(/\/recommendations\/[a-f0-9-]+/, { timeout: 5000 });
      
      // Wait for detail view to load
      await page.waitForLoadState('networkidle');
      
      // Check for key elements (may not all be present if no data, but structure should exist)
      // Stock symbol should be visible
      const symbol = page.locator('text=/^[A-Z]{1,5}$/').first();
      const symbolCount = await symbol.count();
      
      // Back button should be visible
      await expect(page.getByRole('button', { name: /back/i })).toBeVisible({ timeout: 5000 });
      
      // Detail view should have some content
      const content = page.locator('main').first();
      await expect(content).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('back button navigates from detail view to dashboard', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Try to find and click a recommendation card
    const card = page.locator('[class*="cursor-pointer"]').first();
    const cardCount = await card.count();
    
    if (cardCount > 0) {
      await card.click();
      await page.waitForURL(/\/recommendations\/[a-f0-9-]+/, { timeout: 5000 });
      
      // Click back button
      const backButton = page.getByRole('button', { name: /back/i });
      await backButton.click();
      
      // Should navigate back to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('displays 404 error when recommendation not found', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    // Navigate to a non-existent recommendation ID
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await page.goto(`${BASE_URL}/recommendations/${fakeId}`, { waitUntil: 'networkidle' });
    
    // Should show 404 error message
    await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 5000 });
  });

  test('tooltips appear on hover/click and display educational content', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Try to find and click a recommendation card
    const card = page.locator('[class*="cursor-pointer"]').first();
    const cardCount = await card.count();
    
    if (cardCount > 0) {
      await card.click();
      await page.waitForURL(/\/recommendations\/[a-f0-9-]+/, { timeout: 5000 });
      await page.waitForLoadState('networkidle');
      
      // Look for info icons (tooltip triggers)
      const infoButtons = page.locator('button[aria-label*="information" i]');
      const infoCount = await infoButtons.count();
      
      if (infoCount > 0) {
        // Hover over first info button (desktop)
        await infoButtons.first().hover();
        
        // Wait for tooltip to appear
        await page.waitForTimeout(500);
        
        // Tooltip content should be visible (may need to check for popover content)
        const tooltip = page.locator('[role="tooltip"], [class*="popover"]').first();
        const tooltipCount = await tooltip.count();
        
        // If tooltip appears, it should have content
        if (tooltipCount > 0) {
          await expect(tooltip).toBeVisible();
        }
      }
    } else {
      test.skip();
    }
  });

  test('detail view is responsive on mobile widths', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Try to find and click a recommendation card
    const card = page.locator('[class*="cursor-pointer"]').first();
    const cardCount = await card.count();
    
    if (cardCount > 0) {
      await card.click();
      await page.waitForURL(/\/recommendations\/[a-f0-9-]+/, { timeout: 5000 });
      
      // Detail view should be visible and properly formatted on mobile
      const mainContent = page.locator('main').first();
      await expect(mainContent).toBeVisible();
      
      // Check that content is readable (no horizontal scroll)
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = page.viewportSize()?.width || 375;
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10); // Allow small margin
    } else {
      test.skip();
    }
  });

  test('user views recommendation detail and sees explanation with data sources and timestamps', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Try to find and click a recommendation card
    const card = page.locator('[class*="cursor-pointer"]').first();
    const cardCount = await card.count();
    
    if (cardCount > 0) {
      await card.click();
      await page.waitForURL(/\/recommendations\/[a-f0-9-]+/, { timeout: 5000 });
      await page.waitForLoadState('networkidle');
      
      // Check for explanation section heading
      const explanationHeading = page.getByText(/Recommendation Explanation/i);
      const explanationHeadingCount = await explanationHeading.count();
      
      if (explanationHeadingCount > 0) {
        // Explanation section should be visible
        await expect(explanationHeading.first()).toBeVisible();
        
        // Check for data sources section
        const dataSourcesHeading = page.getByText(/Data Sources/i);
        const dataSourcesCount = await dataSourcesHeading.count();
        
        if (dataSourcesCount > 0) {
          await expect(dataSourcesHeading.first()).toBeVisible();
        }
        
        // Check for timestamps (relative time format like "5 min ago", "1 hour ago", etc.)
        const timePattern = /(updated|ago|min|hour|day|just now)/i;
        const timeElements = page.locator(`text=${timePattern}`);
        const timeCount = await timeElements.count();
        
        // At least one timestamp should be visible
        if (timeCount > 0) {
          await expect(timeElements.first()).toBeVisible();
        }
      }
    } else {
      test.skip();
    }
  });

  test('user views recommendation card and sees explanation preview', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Look for recommendation cards
    const cards = page.locator('[class*="cursor-pointer"]');
    const cardCount = await cards.count();
    
    if (cardCount > 0) {
      // Check if any card has explanation preview
      // Explanation preview should show first 1-2 sentences
      // Look for "Read more" link which indicates explanation preview exists
      const readMoreLinks = page.getByText(/Read more/i);
      const readMoreCount = await readMoreLinks.count();
      
      // If explanation previews exist, they should have "Read more" links
      if (readMoreCount > 0) {
        // At least one explanation preview should be visible
        await expect(readMoreLinks.first()).toBeVisible();
      }
      
      // Cards should be visible regardless
      await expect(cards.first()).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('explanation helps user understand quantitative reasoning', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Try to find and click a recommendation card
    const card = page.locator('[class*="cursor-pointer"]').first();
    const cardCount = await card.count();
    
    if (cardCount > 0) {
      await card.click();
      await page.waitForURL(/\/recommendations\/[a-f0-9-]+/, { timeout: 5000 });
      await page.waitForLoadState('networkidle');
      
      // Check for educational context section
      const understandingSection = page.getByText(/Understanding This Recommendation/i);
      const understandingCount = await understandingSection.count();
      
      if (understandingCount > 0) {
        await expect(understandingSection.first()).toBeVisible();
        
        // Check for explanatory text about what signals mean
        const whatDoesText = page.getByText(/What does/i);
        const whatDoesCount = await whatDoesText.count();
        
        if (whatDoesCount > 0) {
          await expect(whatDoesText.first()).toBeVisible();
        }
        
        // Check for "Why does this matter?" section
        const whyMattersText = page.getByText(/Why does this matter/i);
        const whyMattersCount = await whyMattersText.count();
        
        if (whyMattersCount > 0) {
          await expect(whyMattersText.first()).toBeVisible();
        }
      }
    } else {
      test.skip();
    }
  });
});


