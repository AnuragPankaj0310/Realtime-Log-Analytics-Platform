import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URLS, HEADERS, options } from "./config.js";

export { options };

export default function () {
    const payload = JSON.stringify({
        payment_id: `PAY-${Math.floor(Math.random() * 10000000)}`,
        order_id: `ORD-${Math.floor(Math.random() * 10000000)}`,
        amount: Math.floor(Math.random() * 5000) + 100,
    });

    const res = http.post(
        BASE_URLS.payment,
        payload,
        HEADERS
    );

    check(res, {
        "status is 200": (r) => r.status === 200,
    });

    sleep(0.2);
}