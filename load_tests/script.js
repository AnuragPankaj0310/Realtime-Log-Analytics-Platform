import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp-up to 100 users
    { duration: '1m', target: 500 },   // Spike to 500 users
    { duration: '1m', target: 1000 },  // Heavy load at 1000 users
    { duration: '30s', target: 0 },    // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate must be less than 10%
  },
};

const BASE_URL = 'http://host.docker.internal:8080'; // Nginx Gateway

export default function () {
  // Simulate user traffic mix
  const rand = Math.random();
  const uuid = 'user-' + __VU + '-' + __ITER;
  
  if (rand < 0.5) {
    // 50% traffic: User flow
    let res = http.post(`${BASE_URL}/users/profile`, null, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(res, { 'status was 200': (r) => r.status == 200 });
  } else if (rand < 0.8) {
    // 30% traffic: Checkout flow (orchestrates order + payment)
    let res = http.post(`${BASE_URL}/users/checkout`, JSON.stringify({ user_id: uuid, amount: 1200 }), {
      headers: { 'Content-Type': 'application/json' },
    });
    check(res, { 'status was 200 or 201': (r) => r.status == 200 || r.status == 201 });
  } else {
    // 20% traffic: Direct Order
    let res = http.post(`${BASE_URL}/orders`, JSON.stringify({ order_id: "order-" + uuid, amount: 1200 }), {
      headers: { 'Content-Type': 'application/json' },
    });
    check(res, { 'status was 201': (r) => r.status == 201 });
  }

  sleep(1);
}
