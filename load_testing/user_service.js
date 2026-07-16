import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URLS, HEADERS } from "./config.js";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 50 },
    { duration: "2m", target: 100 },
    { duration: "30s", target: 0 },
  ],
};

export default function () {
  const random = Math.random();

  let response;

  if (random < 0.4) {
    // Login (40%)
    response = http.post(
      `${BASE_URLS.user}/login`,
      JSON.stringify({
        email: `user${__VU}@example.com`,
        password: "password123",
      }),
      HEADERS
    );
  } else if (random < 0.7) {
    // Signup (30%)
    response = http.post(
      `${BASE_URLS.user}/signup`,
      JSON.stringify({
        email: `newuser${__VU}_${__ITER}@example.com`,
        password: "password123",
        name: `User ${__VU}`,
      }),
      HEADERS
    );
  } else if (random < 0.9) {
    // Profile (20%)
    response = http.post(
      `${BASE_URLS.user}/profile`,
      "{}",
      HEADERS
    );
  } else {
    // Logout (10%)
    response = http.post(
      `${BASE_URLS.user}/logout`,
      "{}",
      HEADERS
    );
  }

  check(response, {
    "status is 200": (r) => r.status === 200,
  });

  sleep(0.2);
}