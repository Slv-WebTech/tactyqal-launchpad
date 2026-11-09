import { once } from "node:events";

// `fetch` (WHATWG) refuses a fixed list of "bad" ports; an OS-assigned ephemeral port can occasionally land on one,
// which made tests fail with "bad port" at random. Re-pick until we get a usable port.
const BAD = new Set([1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);

export async function listenSafe(app) {
  for (let i = 0; i < 50; i++) {
    const server = app.listen(0);
    await once(server, "listening");
    if (!BAD.has(server.address().port)) return server;
    await new Promise((r) => server.close(r));
  }
  throw new Error("could not obtain a usable test port");
}
