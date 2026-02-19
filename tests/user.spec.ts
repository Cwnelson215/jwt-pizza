import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

test('diner can edit profile from dashboard', async ({ page }) => {
  let loggedInUser: User = { id: '3', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: Role.Diner }] };

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'd@jwt.com' && loginReq.password === 'a') {
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({ json: {} });
    }
  });

  await page.route('*/**/api/user/**', async (route) => {
    const url = route.request().url();
    if (url.endsWith('/api/user/me') && route.request().method() === 'GET') {
      await route.fulfill({ json: loggedInUser });
    } else if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      loggedInUser = { ...loggedInUser, name: body.name, email: body.email };
      await route.fulfill({ json: { user: loggedInUser, token: 'newtoken' } });
    } else {
      await route.continue();
    }
  });

  await page.route('*/**/api/order', async (route) => {
    await route.fulfill({ json: { dinerId: '3', orders: [] } });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route(/\/api\/franchise/, async (route) => {
    await route.fulfill({ json: { franchises: [] } });
  });

  // Login
  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('/', { timeout: 3000 }).catch(() => {});

  // Navigate to diner dashboard
  await page.goto('/diner-dashboard');
  await expect(page.locator('body')).toContainText('Kai Chen');

  // Click Edit button
  await page.getByRole('button', { name: 'Edit' }).click();

  // Verify dialog opens with current values
  await expect(page.getByPlaceholder('Name')).toBeVisible();

  // Change name
  await page.getByPlaceholder('Name').clear();
  await page.getByPlaceholder('Name').fill('Updated Name');

  // Click Update
  await page.getByRole('button', { name: 'Update' }).click();

  // Verify name changed
  await expect(page.locator('body')).toContainText('Updated Name');
});

test('diner can cancel edit dialog', async ({ page }) => {
  const loggedInUser: User = { id: '3', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: Role.Diner }] };

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
    }
  });

  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order', async (route) => {
    await route.fulfill({ json: { dinerId: '3', orders: [] } });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route(/\/api\/franchise/, async (route) => {
    await route.fulfill({ json: { franchises: [] } });
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('/', { timeout: 3000 }).catch(() => {});

  await page.goto('/diner-dashboard');
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByPlaceholder('Name')).toBeVisible();

  // Click Cancel
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Dialog should be closed
  await expect(page.getByPlaceholder('Name')).not.toBeVisible();
});

test('admin can see and manage users', async ({ page }) => {
  const loggedInUser: User = { id: '1', name: 'Admin', email: 'admin@jwt.com', roles: [{ role: Role.Admin }] };
  let users = [
    { id: '1', name: 'Admin', email: 'admin@jwt.com', roles: [{ role: Role.Admin }] },
    { id: '2', name: 'TestUser', email: 'test@jwt.com', roles: [{ role: Role.Diner }] },
    { id: '3', name: 'Another', email: 'another@jwt.com', roles: [{ role: Role.Diner }] },
  ];

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({ json: {} });
    }
  });

  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route(/\/api\/franchise/, async (route) => {
    await route.fulfill({ json: { franchises: [], more: false } });
  });

  // Handle both list users (GET /api/user?...) and delete user (DELETE /api/user/id)
  await page.route(/\/api\/user\/\d+$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      const urlParts = route.request().url().split('/');
      const userId = urlParts[urlParts.length - 1];
      users = users.filter((u) => u.id !== userId);
      await route.fulfill({ json: { message: 'user deleted' } });
    } else {
      await route.continue();
    }
  });

  await page.route(/\/api\/user(\?|$)/, async (route) => {
    if (route.request().method() === 'GET') {
      const url = new URL(route.request().url());
      const nameFilter = url.searchParams.get('name') || '*';
      let filtered = users;
      if (nameFilter !== '*') {
        const pattern = nameFilter.replace(/\*/g, '').toLowerCase();
        filtered = users.filter((u) => u.name.toLowerCase().includes(pattern));
      }
      await route.fulfill({ json: { users: filtered, more: false } });
    } else {
      await route.continue();
    }
  });

  // Login as admin
  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('admin@jwt.com');
  await page.getByPlaceholder('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('/', { timeout: 3000 }).catch(() => {});

  // Navigate to admin dashboard
  await page.goto('/admin-dashboard');

  // Verify users table is visible
  await expect(page.getByText('Users')).toBeVisible();
  await expect(page.locator('body')).toContainText('TestUser');
  await expect(page.locator('body')).toContainText('test@jwt.com');

  // Delete a user
  const deleteButtons = await page.getByRole('button', { name: 'Delete' }).all();
  expect(deleteButtons.length).toBeGreaterThan(0);
  await deleteButtons[0].click();

  // Wait for the table to update
  await expect(page.locator('body')).not.toContainText('TestUser', { timeout: 5000 });
});
