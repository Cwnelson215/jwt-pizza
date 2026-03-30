import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  cloud: {
    distribution: {
      'amazon:us:columbus': { loadZone: 'amazon:us:columbus', percent: 100 },
    },
  },
  vus: 1,
  duration: '30s',
};

const BASE_URL = 'https://pizza-service.cwnel.com';
const FACTORY_URL = 'https://pizza-factory.cs329.click';

export default function () {
  // Login
  const loginRes = http.put(
    `${BASE_URL}/api/auth`,
    JSON.stringify({
      email: 'test@test.com',
      password: 'testpass',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
  });

  const authToken = JSON.parse(loginRes.body).token;

  // Get menu
  const menuRes = http.get(`${BASE_URL}/api/order/menu`);

  check(menuRes, {
    'menu status is 200': (r) => r.status === 200,
  });

  const menu = JSON.parse(menuRes.body);

  // Create order
  const orderRes = http.post(
    `${BASE_URL}/api/order`,
    JSON.stringify({
      franchiseId: 1,
      storeId: 1,
      items: [{ menuId: menu[0].id, description: menu[0].title, price: menu[0].price }],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  check(orderRes, {
    'purchase status is 200': (r) => r.status === 200,
  });

  // Verify pizza JWT
  const orderData = JSON.parse(orderRes.body);
  const pizzaJwt = orderData.jwt;

  const verifyRes = http.post(
    `${FACTORY_URL}/api/order/verify`,
    JSON.stringify({ jwt: pizzaJwt }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(verifyRes, {
    'verify status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
