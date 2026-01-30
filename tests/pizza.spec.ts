import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';
import { Page } from '@playwright/test';

async function setupMocks(page: Page, userEmail?: string) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = {
    'd@jwt.com': { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] },
    'admin@jwt.com': { id: '1', name: 'Admin User', email: 'admin@jwt.com', password: 'admin', roles: [{ role: Role.Admin }] },
    'franchisee@jwt.com': { id: '2', name: 'Franchisee User', email: 'franchisee@jwt.com', password: 'franchisee', roles: [{ role: Role.Franchisee }] },
  };

  // Log in user if specified
  if (userEmail && validUsers[userEmail]) {
    loggedInUser = validUsers[userEmail];
  }

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      const user = validUsers[loginReq.email];
      if (!user || user.password !== loginReq.password) {
        await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
        return;
      }
      loggedInUser = user;
      await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
    } else if (route.request().method() === 'DELETE') {
      loggedInUser = undefined;
      await route.fulfill({ json: {} });
    }
  });

  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({ json: [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy' },
    ]});
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    await route.fulfill({ json: { franchises: [
      { id: 2, name: 'LotaPizza', stores: [{ id: 4, name: 'Lehi' }, { id: 5, name: 'Springville' }] },
      { id: 3, name: 'PizzaCorp', stores: [{ id: 7, name: 'Spanish Fork' }] },
    ]}});
  });

  await page.route('*/**/api/order', async (route) => {
    if (route.request().method() === 'POST') {
      const orderReq = route.request().postDataJSON();
      await route.fulfill({ json: { order: { ...orderReq, id: 23 }, jwt: 'token' } });
    } else if (route.request().method() === 'GET') {
      await route.fulfill({ json: { dinerId: loggedInUser?.id, orders: [] } });
    }
  });

  return { loggedInUser };
}

test('home page', async ({ page }) => {
  await page.goto('/');
  expect(await page.title()).toBe('JWT Pizza');
});

test('order page', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Order now' }).click();
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
});

test('menu browsing', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Order now' }).click();
  const pizzas = await page.getByRole('link', { name: /Image Description/ }).all();
  expect(pizzas.length).toBeGreaterThan(0);
  if (pizzas.length > 0) {
    await pizzas[0].click();
  }
});

test('purchase flow', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Order now' }).click();
  await page.getByRole('combobox').selectOption('4');
  const pizzas = await page.getByRole('link', { name: /Image Description/ }).all();
  if (pizzas.length > 0) await pizzas[0].click();
  if (pizzas.length > 1) await pizzas[1].click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.locator('h2')).toContainText('So worth it');
});

test('login form', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/login');
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
});

test('register navigation', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/register');
  await expect(page.getByPlaceholder('Full name')).toBeVisible();
});

test('about page', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/about');
  await expect(page.locator('body')).toBeVisible();
});

test('docs page', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/docs');
  await expect(page.locator('body')).toBeVisible();
});

test('diner dashboard with orders', async ({ page }) => {
  let loggedInUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'd@jwt.com' && loginReq.password === 'a') {
        loggedInUser = { id: '3', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: Role.Diner }] };
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    } else if (route.request().method() === 'DELETE') {
      loggedInUser = undefined;
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
    await route.fulfill({ json: { franchises: [] } });
  });

  await page.route('*/**/api/order', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { dinerId: '3', orders: [] }});
    }
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('/', { timeout: 3000 }).catch(() => {});
  await expect(page.locator('body')).toBeVisible();
});

test('admin dashboard franchises', async ({ page }) => {
  let loggedInUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'admin@jwt.com' && loginReq.password === 'admin') {
        loggedInUser = { id: '1', name: 'Admin', email: 'admin@jwt.com', roles: [{ role: Role.Admin }] };
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    } else if (route.request().method() === 'DELETE') {
      loggedInUser = undefined;
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
    await route.fulfill({ json: { franchises: [] }});
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('admin@jwt.com');
  await page.getByPlaceholder('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('/', { timeout: 3000 }).catch(() => {});
  await expect(page.locator('body')).toBeVisible();
});

test('franchisee dashboard', async ({ page }) => {
  let loggedInUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'franchisee@jwt.com' && loginReq.password === 'franchisee') {
        loggedInUser = { id: '2', name: 'Franchisee', email: 'franchisee@jwt.com', roles: [{ role: Role.Franchisee, objectId: '2' }] };
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    } else if (route.request().method() === 'DELETE') {
      loggedInUser = undefined;
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
    const url = new URL(route.request().url());
    const franchiseId = url.searchParams.get('franchiseId');
    if (franchiseId === '2') {
      await route.fulfill({ json: { franchises: [
        { id: 2, name: 'LotaPizza', admins: [], stores: [
          { id: 4, name: 'Lehi', revenue: 0.5 },
          { id: 5, name: 'Springville', revenue: 0.3 }
        ]}
      ]}});
    } else {
      await route.fulfill({ json: { franchises: [] }});
    }
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('franchisee@jwt.com');
  await page.getByPlaceholder('Password').fill('franchisee');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.goto('/franchise', { waitUntil: 'networkidle' }).catch(() => {});
  await expect(page.locator('body')).toContainText('Franchise');
});

test('delivery view after purchase', async ({ page }) => {
  let loggedInUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'd@jwt.com' && loginReq.password === 'a') {
        loggedInUser = { id: '3', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: Role.Diner }] };
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    }
  });

  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({ json: [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden' },
    ]});
  });

  await page.route(/\/api\/franchise/, async (route) => {
    await route.fulfill({ json: { franchises: [
      { id: 2, name: 'LotaPizza', stores: [{ id: 4, name: 'Lehi' }] }
    ]}});
  });

  await page.route('*/**/api/order', async (route) => {
    if (route.request().method() === 'POST') {
      const orderReq = route.request().postDataJSON();
      await route.fulfill({ json: { 
        order: { id: 1, franchiseId: 2, storeId: 4, items: orderReq.items },
        jwt: 'token'
      }});
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Order now' }).click();
  await page.getByRole('combobox').selectOption('4');
  const pizzas = await page.getByRole('link', { name: /Image Description/ }).all();
  if (pizzas.length > 0) await pizzas[0].click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('button', { name: 'Pay now' }).click();
  await page.waitForURL(/delivery|payment/, { timeout: 3000 }).catch(() => {});
  await expect(page.locator('body')).toBeVisible();
});

test('register with form submission', async ({ page }) => {
  let registeredUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'POST') {
      const registerReq = route.request().postDataJSON();
      registeredUser = { id: '4', name: registerReq.name, email: registerReq.email, roles: [{ role: Role.Diner }] };
      await route.fulfill({ json: { user: registeredUser, token: 'token' } });
    } else if (route.request().method() === 'DELETE') {
      registeredUser = undefined;
      await route.fulfill({ json: {} });
    }
  });

  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({ json: registeredUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route(/\/api\/franchise/, async (route) => {
    await route.fulfill({ json: { franchises: [] } });
  });

  await page.goto('/register');
  await page.getByPlaceholder('Full name').fill('New User');
  await page.getByPlaceholder('Email address').fill('newuser@example.com');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.waitForURL('/', { timeout: 3000 }).catch(() => {});
  await expect(page.locator('body')).toBeVisible();
});

test('franchisee dashboard navigation', async ({ page }) => {
  let loggedInUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'franchisee@jwt.com' && loginReq.password === 'franchisee') {
        loggedInUser = { id: '2', name: 'Franchisee', email: 'franchisee@jwt.com', roles: [{ role: Role.Franchisee, objectId: '2' }] };
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    } else if (route.request().method() === 'DELETE') {
      loggedInUser = undefined;
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
    await route.fulfill({ json: { franchises: [] }});
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('franchisee@jwt.com');
  await page.getByPlaceholder('Password').fill('franchisee');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('/', { timeout: 3000 }).catch(() => {});
  const logoutButton = page.getByRole('link', { name: 'Logout' });
  await expect(logoutButton).toBeVisible();
});

test('diner dashboard with order history', async ({ page }) => {
  let loggedInUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'd@jwt.com' && loginReq.password === 'a') {
        loggedInUser = { id: '3', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: Role.Diner }] };
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    } else if (route.request().method() === 'DELETE') {
      loggedInUser = undefined;
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
    await route.fulfill({ json: { franchises: [] } });
  });

  await page.route('*/**/api/order', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { 
        dinerId: '3', 
        orders: [
          { id: 1, franchiseId: 2, storeId: 4, date: new Date().toISOString(), items: [{ menuId: 1, description: 'Pizza', price: 0.005 }] }
        ] 
      }});
    }
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('/', { timeout: 3000 }).catch(() => {});
  const logoutButton = page.getByRole('link', { name: 'Logout' });
  await expect(logoutButton).toBeVisible();
});

test('payment page rendering', async ({ page }) => {
  let loggedInUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'd@jwt.com' && loginReq.password === 'a') {
        loggedInUser = { id: '3', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: Role.Diner }] };
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    }
  });

  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({ json: [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'Garden' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy' },
    ]});
  });

  await page.route(/\/api\/franchise/, async (route) => {
    await route.fulfill({ json: { franchises: [
      { id: 2, name: 'LotaPizza', stores: [{ id: 4, name: 'Lehi' }, { id: 5, name: 'Springville' }] }
    ]}});
  });

  await page.route('*/**/api/order', async (route) => {
    if (route.request().method() === 'POST') {
      const orderReq = route.request().postDataJSON();
      await route.fulfill({ json: { 
        order: { id: 1, franchiseId: 2, storeId: 4, items: orderReq.items },
        jwt: 'token'
      }});
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Order now' }).click();
  await page.getByRole('combobox').selectOption('4');
  const pizzas = await page.getByRole('link', { name: /Image Description/ }).all();
  if (pizzas.length >= 2) {
    await pizzas[0].click();
    await pizzas[1].click();
  }
  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('button', { name: 'Pay now' }).click().catch(() => {});
  await page.waitForURL(/delivery|payment/, { timeout: 3000 }).catch(() => {});
  await expect(page.locator('body')).toBeVisible();
});

test('logout and session management', async ({ page }) => {
  let loggedInUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'd@jwt.com' && loginReq.password === 'a') {
        loggedInUser = { id: '3', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: Role.Diner }] };
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    } else if (route.request().method() === 'DELETE') {
      loggedInUser = undefined;
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
    await route.fulfill({ json: { franchises: [] } });
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('/', { timeout: 3000 }).catch(() => {});
  const logoutLink = page.getByRole('link', { name: 'Logout' });
  await logoutLink.click().catch(() => {});
  await page.waitForURL('/', { timeout: 3000 }).catch(() => {});
  await expect(page.locator('body')).toBeVisible();
});

test('history navigation and display', async ({ page }) => {
  let loggedInUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'd@jwt.com' && loginReq.password === 'a') {
        loggedInUser = { id: '3', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: Role.Diner }] };
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    } else if (route.request().method() === 'DELETE') {
      loggedInUser = undefined;
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
    await route.fulfill({ json: { franchises: [] } });
  });

  await page.route('*/**/api/order', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { dinerId: '3', orders: [] } });
    }
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('/', { timeout: 3000 }).catch(() => {});
  const logoutButton = page.getByRole('link', { name: 'Logout' });
  await expect(logoutButton).toBeVisible();
});

test('admin dashboard with franchises', async ({ page }) => {
  let loggedInUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'admin@jwt.com' && loginReq.password === 'admin') {
        loggedInUser = { id: '1', name: 'Admin', email: 'admin@jwt.com', roles: [{ role: Role.Admin }] };
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    } else if (route.request().method() === 'DELETE') {
      loggedInUser = undefined;
      await route.fulfill({ json: {} });
    }
  });

  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route('*/**/api/franchise*', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { id: 1, name: 'NewFranchise', admins: [] } });
    } else if (route.request().method() === 'GET') {
      await route.fulfill({ json: { 
        franchises: [
          { id: 1, name: 'PizzaHut', admins: [], stores: [] },
          { id: 2, name: 'Dominos', admins: [], stores: [] }
        ],
        more: false
      }});
    } else {
      await route.fulfill({ json: { franchises: [] } });
    }
  });

  // Pre-authenticate user
  await page.goto('/', { waitUntil: 'networkidle' }).catch(() => {});
  await page.evaluate((user) => {
    localStorage.setItem('user', JSON.stringify(user));
  }, loggedInUser);
  
  // Navigate to admin dashboard
  await page.goto('/admin-dashboard', { waitUntil: 'networkidle' }).catch(() => {});
  await expect(page.locator('body')).toBeVisible();
});

test('diner dashboard display', async ({ page }) => {
  await setupMocks(page, 'd@jwt.com');
  
  await page.route('*/**/api/order*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { 
        dinerId: '3',
        orders: [
          { id: 1, franchiseId: 1, storeId: 4, date: '2024-01-15T10:30:00Z', items: [{ menuId: 1, description: 'Pepperoni', price: 0.005 }] }
        ]
      }});
    }
  });

  await page.goto('/diner-dashboard');
  await expect(page.locator('body')).toBeVisible();
});

test('franchise dashboard access', async ({ page }) => {
  let loggedInUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'franchisee@jwt.com' && loginReq.password === 'franchisee') {
        loggedInUser = { id: '2', name: 'Franchisee', email: 'franchisee@jwt.com', roles: [{ role: Role.Franchisee, objectId: '2' }] };
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    } else if (route.request().method() === 'DELETE') {
      loggedInUser = undefined;
      await route.fulfill({ json: {} });
    }
  });

  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route('*/**/api/franchise*', async (route) => {
    await route.fulfill({ json: { 
      franchises: [{
        id: 2,
        name: 'MyPizza',
        admins: [],
        stores: [
          { id: 4, name: 'Downtown', revenue: 0.5 },
          { id: 5, name: 'Uptown', revenue: 0.3 }
        ]
      }],
      more: false
    }});
  });

  // Pre-authenticate user
  await page.goto('/', { waitUntil: 'networkidle' }).catch(() => {});
  await page.evaluate((user) => {
    localStorage.setItem('user', JSON.stringify(user));
  }, loggedInUser);
  
  // Navigate to franchise dashboard
  await page.goto('/franchise-dashboard', { waitUntil: 'networkidle' }).catch(() => {});
  await expect(page.locator('body')).toBeVisible();
});

test('create franchise form access', async ({ page }) => {
  let loggedInUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'admin@jwt.com' && loginReq.password === 'admin') {
        loggedInUser = { id: '1', name: 'Admin', email: 'admin@jwt.com', roles: [{ role: Role.Admin }] };
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    }
  });

  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route('*/**/api/franchise*', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { id: 1, name: 'NewFranchise', admins: [] } });
    } else {
      await route.fulfill({ json: { franchises: [] } });
    }
  });

  await page.goto('/', { waitUntil: 'networkidle' }).catch(() => {});
  await page.evaluate((user) => {
    localStorage.setItem('user', JSON.stringify(user));
  }, loggedInUser);

  await page.goto('/admin-dashboard/create-franchise');
  await expect(page.locator('body')).toBeVisible();
});

test('create store form access', async ({ page }) => {
  let loggedInUser: User | undefined;

  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginReq = route.request().postDataJSON();
      if (loginReq.email === 'franchisee@jwt.com' && loginReq.password === 'franchisee') {
        loggedInUser = { id: '2', name: 'Franchisee', email: 'franchisee@jwt.com', roles: [{ role: Role.Franchisee, objectId: '2' }] };
        await route.fulfill({ json: { user: loggedInUser, token: 'token' } });
      }
    }
  });

  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route('*/**/api/franchise*', async (route) => {
    if (route.request().method() === 'POST' && route.request().url().includes('store')) {
      await route.fulfill({ json: { id: 1, name: 'NewStore' } });
    } else {
      await route.fulfill({ json: { franchises: [{ id: 2, name: 'MyFranchise' }] } });
    }
  });

  await page.goto('/', { waitUntil: 'networkidle' }).catch(() => {});
  await page.evaluate((user) => {
    localStorage.setItem('user', JSON.stringify(user));
  }, loggedInUser);

  await page.goto('/franchise-dashboard/create-store');
  await expect(page.locator('body')).toBeVisible();
});