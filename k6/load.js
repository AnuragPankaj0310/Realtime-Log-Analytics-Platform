import http from "k6/http";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "30s", target: 200 },
    { duration: "30s", target: 300 },
    { duration: "30s", target: 0 },
  ],
};

export default function () {
  http.post(
    "http://nginx:80/users/checkout",
    JSON.stringify({
      user_id: "demo@example.com",
      amount: Math.random() * 100,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
