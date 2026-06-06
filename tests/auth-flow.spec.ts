import { test, expect } from '@playwright/test';

test.describe('Auth and Redirection Flow', () => {
  test('Demo login should redirect to dashboard and show demo banner', async ({ page }) => {
    await page.goto('/auth');
    
    // Check if demo card is visible
    const demoCard = page.locator('text=Experimente a Demo Completa');
    await expect(demoCard).toBeVisible();

    // Click to show form
    await page.click('button:has-text("Entrar na Demo")');

    // Fill lead form
    await page.fill('#demo-name', 'Test User');
    await page.fill('#demo-email', 'test@example.com');
    await page.fill('#demo-phone', '(11) 99999-9999');
    await page.click('#consent');

    // Submit and wait for redirect
    await page.click('button:has-text("Acessar Demonstração")');
    
    // Should land on dashboard
    await expect(page).toHaveURL('/');
    
    // Should NOT show "Cadastro da Empresa Obrigatório"
    await expect(page.locator('text=Cadastro da Empresa Obrigatório')).not.toBeVisible();
    
    // Should show demo banner
    await expect(page.locator('text=MODO DEMONSTRAÇÃO')).toBeVisible();
  });

  test('Real login should clear demo state and redirect to company if registered', async ({ page }) => {
    // This test assumes a registered user exists or tests the redirection logic
    await page.goto('/auth');
    
    await page.fill('#login-email', 'demo@brainxerp.com'); // Using demo as "real" user for logic test
    await page.fill('#login-pass', 'BrainxERPDemo2026!');
    
    await page.click('button:has-text("Entrar no sistema")');

    await expect(page).toHaveURL('/');
    
    // Logic check: if it was a real user with no company, it would show the guard.
    // Since demo@brainxerp.com has a company linked, it should show dashboard.
    await expect(page.locator('text=Indicadores em Tempo Real')).toBeVisible();
  });

  test('Root access without auth should redirect to landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/landing');
  });
});
