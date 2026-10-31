import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import {
  authTokensFromRequest,
  bearerToken,
  verifyFirstValidToken,
} from "./authenticate.js";

const SECRET = "test-secret";

test("Bearer dipakai sebelum cookie, dan cookie kadaluarsa tidak menimpa Bearer yang sah", () => {
  const req = {
    headers: { authorization: "Bearer live-token" },
    cookies: { access_token: "stale-cookie" },
  };
  assert.equal(bearerToken(req), "live-token");
  assert.deepEqual(authTokensFromRequest(req), ["live-token", "stale-cookie"]);

  const live = jwt.sign({ sub: "hub" }, SECRET, { expiresIn: "1h" });
  const stale = jwt.sign({ sub: "old", exp: Math.floor(Date.now() / 1000) - 30 }, SECRET);
  const decoded = verifyFirstValidToken([live, stale], SECRET);
  assert.equal(decoded.sub, "hub");
});

test("cookie sah dipakai jika Bearer sudah mati", () => {
  const live = jwt.sign({ sub: "cookie" }, SECRET, { expiresIn: "1h" });
  const stale = jwt.sign({ sub: "header", exp: Math.floor(Date.now() / 1000) - 30 }, SECRET);
  const decoded = verifyFirstValidToken([stale, live], SECRET);
  assert.equal(decoded.sub, "cookie");
});

test("tanpa token minta session renewal, token mati tetap 401 expired", () => {
  assert.throws(() => verifyFirstValidToken([], SECRET), /session renewal/);
  const stale = jwt.sign({ sub: "old", exp: Math.floor(Date.now() / 1000) - 30 }, SECRET);
  assert.throws(
    () => verifyFirstValidToken([stale], SECRET),
    /Invalid or expired token/,
  );
});
