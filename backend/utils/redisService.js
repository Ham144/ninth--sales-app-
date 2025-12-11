import Redis from "ioredis";

const redisService = new Redis({
  host: "127.0.0.1",
  port: 6379,
});

redisService.on("connect", () => {
  console.log("Redis is ready");
});

export const deleteCacheByPrefix = async (prefix) => {
  let cursor = 0;
  do {
    const reply = await redisService.scan(
      cursor,
      "MATCH",
      `${prefix}*`,
      "COUNT",
      100
    );
    cursor = Number(reply[0]);
    const keys = reply[1];

    if (keys.length > 0) {
      await redisService.del(...keys);
    }
  } while (cursor !== 0);
};

export default redisService;
