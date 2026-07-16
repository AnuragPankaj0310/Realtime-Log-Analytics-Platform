import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URLS, HEADERS } from "./config.js";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "2m", target: 200 },
    { duration: "30s", target: 0 },
  ],
};

export default function () {
  const random = Math.random();
  let response;

  // 55% User Service
  if (random < 0.55) {
    const action = Math.random();

    if (action < 0.4) {
      response = http.post(
        `${BASE_URLS.user}/login`,
        JSON.stringify({
          email: `user${__VU}@gmail.com`,
          password: "password123",
        }),
        HEADERS
      );
    } else if (action < 0.7) {
      response = http.post(
        `${BASE_URLS.user}/signup`,
        JSON.stringify({
          email: `user${__VU}_${__ITER}@gmail.com`,
          password: "password123",
          name: `User ${__VU}`,
        }),
        HEADERS
      );
    } else if (action < 0.9) {
      response = http.post(`${BASE_URLS.user}/profile`, "{}", HEADERS);
    } else {
      response = http.post(`${BASE_URLS.user}/logout`, "{}", HEADERS);
    }
  }

  // 20% Order Service
  else if (random < 0.75) {
    response = http.post(
      BASE_URLS.order,
      JSON.stringify({
        order_id: `ORD-${__VU}-${__ITER}`,
        customer_id: `CUS-${__VU}`,
        amount: Math.floor(Math.random() * 1000) + 100,
      }),
      HEADERS
    );
  }

  
  // 15% Payment Service
  else if (random < 0.90) {
    response = http.post(
      BASE_URLS.payment,
      JSON.stringify({
        payment_id: `PAY-${__VU}-${__ITER}`,
        order_id: `ORD-${__VU}-${__ITER}`,
        amount: Math.floor(Math.random() * 1000) + 100,
      }),
      HEADERS
    );
  }

  // 10% Analytics API
  else {
    const endpoints = [
      "/summary",
      "/dashboard",
      "/leaderboard",
      "/alerts",
    ];

    const endpoint =
      endpoints[Math.floor(Math.random() * endpoints.length)];

    response = http.get(
      `http://localhost:8080/api${endpoint}`
    );
  }
}