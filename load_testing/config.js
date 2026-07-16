export const BASE_URLS = {
    user: "http://localhost:8080/users",
    order: "http://localhost:8080/orders",
    payment: "http://localhost:8080/payments",
    analytics: "http://localhost:8080/api",
};

export const HEADERS = {
    headers: {
        "Content-Type": "application/json",
    },
};

export const options = {
    stages: [
        { duration: "1m", target: 50 },
        { duration: "2m", target: 200 },
        { duration: "2m", target: 500 },
        { duration: "1m", target: 0 },
    ],
};