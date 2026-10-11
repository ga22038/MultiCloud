import http from "k6/http";
import { check, sleep } from "k6";
export const options = {
  stages: [{duration: "20s", target: 5}, {duration: "40s", target: 20}, {duration: "20s", target: 0}],
  thresholds: {http_req_failed: ["rate<0.01"], http_req_duration: ["p(95)<500"]},
};
const base = __ENV.TEST_BASE_URL || "http://127.0.0.1:8080";
export function setup() {
  if (!__ENV.K6_USERNAME || !__ENV.K6_PASSWORD) throw new Error("Provide K6_USERNAME and K6_PASSWORD through environment variables.");
  const response = http.post(`${base}/api/v1/session`, JSON.stringify({username: __ENV.K6_USERNAME, password: __ENV.K6_PASSWORD}), {headers: {"Content-Type": "application/json", Origin: base}});
  if (response.status !== 200 || !response.cookies.polaris_session) throw new Error("Could not establish load-test session.");
  return {cookie: response.cookies.polaris_session[0].value};
}
export default function(data) {
  const response = http.get(`${base}/api/v1/inventory?pageSize=25`, {headers: {Cookie: `polaris_session=${data.cookie}`}});
  check(response, {"inventory response": result => result.status === 200, "valid list": result => Array.isArray(result.json("data"))});
  sleep(1);
}
