import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10, // low constant load
  duration: '1h', // run for 1 hour
};

const BASE_URL = 'http://host.docker.internal:8080';

export default function () {
  const rand = Math.random();
  const uuid = 'user-' + __VU + '-' + __ITER;
  
  if (rand < 0.5) {
    http.post(`${BASE_URL}/users/profile`, null, { headers: { 'Content-Type': 'application/json' } });
  } else if (rand < 0.8) {
    http.post(`${BASE_URL}/users/checkout`, JSON.stringify({ user_id: uuid, amount: 1200 }), { headers: { 'Content-Type': 'application/json' } });
  } else {
    http.post(`${BASE_URL}/orders`, JSON.stringify({ order_id: "order-" + uuid, amount: 1200 }), { headers: { 'Content-Type': 'application/json' } });
  }

  sleep(1);
}
