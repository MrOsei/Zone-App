import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import WebSocket from "ws";

const port = 3101;
const base = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const managed = !process.env.TEST_BASE_URL;
const dataDir = path.join(process.cwd(), "test-data");
let server: ChildProcess | undefined;
let serverLog = "";

async function startServer() {
  server = spawn("npm", ["start"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(port), DATA_DIR: dataDir }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  server.stdout?.on("data", (chunk) => { serverLog += chunk; });
  server.stderr?.on("data", (chunk) => { serverLog += chunk; });
  for (let attempt = 0; attempt < 80; attempt++) {
    try { const response = await fetch(`${base}/api/health`); if (response.ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not start:\n${serverLog}`);
}
async function stopServer() {
  const child = server;
  server = undefined;
  if (!child || child.exitCode !== null || child.signalCode) return;
  await new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => { if (!finished) { finished = true; clearTimeout(timer); resolve(); } };
    const signal = (name: NodeJS.Signals) => {
      try { if (child.pid) process.kill(-child.pid, name); }
      catch { try { child.kill(name); } catch { finish(); } }
    };
    child.once("exit", finish);
    signal("SIGTERM");
    const timer = setTimeout(() => { signal("SIGKILL"); finish(); }, 3000);
    timer.unref();
  });
}

before(async () => {
  if (managed) {
    rmSync(dataDir, { recursive: true, force: true });
    const buildDirectory = process.env.ZONE_BUILD_DIR || "node_modules/.cache/zone-next-production";
    if (!existsSync(path.join(process.cwd(), buildDirectory, "BUILD_ID"))) throw new Error("Run npm run build before integration tests.");
    await startServer();
  }
});
after(async () => { if (managed) { await stopServer(); rmSync(dataDir, { recursive: true, force: true }); } });

class Client {
  cookie = "";
  async request(pathname: string, options: { method?: string; body?: unknown; form?: FormData } = {}) {
    const response = await fetch(`${base}${pathname}`, { method: options.method || "GET", headers: {
      ...(this.cookie ? { Cookie: this.cookie } : {}),
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    }, body: options.form || (options.body !== undefined ? JSON.stringify(options.body) : undefined), redirect: "manual" });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  }
  async ok(pathname: string, options: { method?: string; body?: unknown; form?: FormData } = {}) {
    const result = await this.request(pathname, options);
    assert.ok(result.status >= 200 && result.status < 300, `${options.method || "GET"} ${pathname}: ${result.status} ${JSON.stringify(result.data)}`);
    return result.data;
  }
}

const alice = new Client(), bob = new Client(), celia = new Client();
let aliceId = "", bobId = "", celiaId = "", connectionId = "", conversationId = "", postId = "", communityId = "", eventId = "";

test("ZONE production social workflow and restart persistence", async () => {
  const health = await alice.ok("/api/health");
  assert.equal(health.status, "ok");
  assert.equal(health.migration, "001_initial.sql");
  assert.equal((await alice.request("/api/posts")).status, 401);

  const register = async (client: Client, name: string, username: string) => client.ok("/api/auth/register", { method: "POST", body: { name, username, email: `${username}@zone.test`, password: "correct-horse-42", city: "Cape Coast", interests: ["design", "running"] } });
  aliceId = (await register(alice, "Alice Armah", "alice_test")).user.id;
  bobId = (await register(bob, "Bob Bentil", "bob_test")).user.id;
  celiaId = (await register(celia, "Celia Cobb", "celia_test")).user.id;
  assert.equal((await bob.request("/api/auth/register", { method: "POST", body: { name: "Duplicate User", username: "alice_test", email: "other@zone.test", password: "correct-horse-42" } })).status, 409);
  assert.equal((await alice.ok("/api/auth/me")).user.id, aliceId);

  const updated = await alice.ok("/api/profile", { method: "PATCH", body: { bio: "Designing friendlier cities.", discoveryRadius: 25 } });
  assert.equal(updated.user.bio, "Designing friendlier cities.");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const form = new FormData(); form.append("avatar", new File([png], "avatar.png", { type: "image/png" }));
  const avatar = await alice.ok("/api/profile/avatar", { method: "POST", form });
  assert.match(avatar.user.avatarUrl, /^\/api\/avatars\/[a-f0-9]{48}\.png$/);
  const avatarResponse = await fetch(`${base}${avatar.user.avatarUrl}`); assert.equal(avatarResponse.status, 200);

  await alice.ok("/api/location", { method: "PUT", body: { latitude: 5.1053, longitude: -1.2466, accuracy: 20 } });
  await bob.ok("/api/location", { method: "PUT", body: { latitude: 5.11, longitude: -1.25, accuracy: 20 } });
  await celia.ok("/api/location", { method: "PUT", body: { latitude: 5.5, longitude: -1.2, accuracy: 20 } });
  const nearby = await alice.ok("/api/discovery?radius=25");
  assert.ok(nearby.people.some((person: { id: string }) => person.id === bobId));
  assert.ok(!nearby.people.some((person: { id: string }) => person.id === celiaId));
  const bobPublic = nearby.people.find((person: { id: string }) => person.id === bobId);
  assert.ok(bobPublic.distanceKm > 0 && bobPublic.distanceKm < 2);
  assert.ok(!("latitude" in bobPublic) && !("longitude" in bobPublic) && !("rawDistance" in bobPublic) && !("email" in bobPublic));
  await bob.ok("/api/settings", { method: "PATCH", body: { locationVisible: false } });
  assert.ok(!(await alice.ok("/api/discovery?radius=25")).people.some((person: { id: string }) => person.id === bobId));
  await bob.ok("/api/settings", { method: "PATCH", body: { locationVisible: true } });
  assert.ok((await alice.ok("/api/discovery?q=celia")).people.some((person: { id: string }) => person.id === celiaId));

  const request = await alice.ok("/api/connections", { method: "POST", body: { recipientId: bobId } });
  connectionId = request.id;
  assert.equal(request.status, "pending");
  assert.equal((await alice.request("/api/conversations", { method: "POST", body: { recipientId: bobId } })).status, 403);
  assert.equal((await bob.ok("/api/connections", { method: "PATCH", body: { id: connectionId, action: "accept" } })).status, "accepted");
  assert.equal((await alice.ok("/api/connections")).connections[0].status, "accepted");
  const rejected = await alice.ok("/api/connections", { method: "POST", body: { recipientId: celiaId } });
  assert.equal((await celia.ok("/api/connections", { method: "PATCH", body: { id: rejected.id, action: "reject" } })).status, "rejected");

  conversationId = (await alice.ok("/api/conversations", { method: "POST", body: { recipientId: bobId } })).conversationId;
  assert.equal((await celia.request(`/api/conversations/${conversationId}/messages`)).status, 404);
  const rejectedSocketError = await new Promise<string>((resolve, reject) => {
    const rejectedSocket = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { Cookie: "zone_session=%" } });
    const timer = setTimeout(() => reject(new Error("Unauthenticated WebSocket was not rejected")), 4000);
    rejectedSocket.on("error", (error) => { clearTimeout(timer); resolve(error.message); });
    rejectedSocket.on("open", () => { clearTimeout(timer); reject(new Error("Unauthenticated WebSocket opened")); });
  });
  assert.match(rejectedSocketError, /401/);
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { Cookie: bob.cookie } });
  const realtime = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Realtime message timed out")), 4000);
    socket.on("message", (raw) => { const payload = JSON.parse(String(raw)); if (payload.type === "message") { clearTimeout(timer); resolve(payload.data.body); } });
    socket.on("error", reject);
  });
  await new Promise<void>((resolve) => socket.on("open", () => resolve()));
  const sent = await alice.ok(`/api/conversations/${conversationId}/messages`, { method: "POST", body: { body: "Meet by the castle at 9?" } });
  assert.equal(await realtime, "Meet by the castle at 9?"); socket.close();
  const history = await bob.ok(`/api/conversations/${conversationId}/messages`);
  assert.equal(history.messages[0].id, sent.message.id);
  assert.equal(history.messages[0].body, "Meet by the castle at 9?");

  postId = (await alice.ok("/api/posts", { method: "POST", body: { body: "Who wants to start a Saturday design walk?" } })).post.id;
  const crossSite = await fetch(`${base}/api/posts`, { method: "POST", headers: { Cookie: alice.cookie, Origin: "https://attacker.invalid", "Content-Type": "application/json" }, body: JSON.stringify({ body: "Cross-site request" }) });
  assert.equal(crossSite.status, 403);
  assert.equal((await bob.ok(`/api/posts/${postId}/like`, { method: "POST", body: {} })).liked, true);
  await bob.ok(`/api/posts/${postId}/comments`, { method: "POST", body: { body: "I’m in. I’ll bring my sketchbook." } });
  const comments = await bob.ok(`/api/posts/${postId}/comments`);
  assert.equal(comments.comments.length, 1);
  const shared = await bob.ok(`/api/posts/${postId}/share`, { method: "POST", body: { body: "This sounds like our kind of Saturday." } });
  assert.ok((await bob.ok("/api/posts")).posts.some((post: { sharedPost?: { id: string } }) => post.sharedPost?.id === postId));
  await alice.ok(`/api/posts/${shared.post.id}/like`, { method: "POST", body: {} });

  communityId = (await alice.ok("/api/communities", { method: "POST", body: { name: "Coastal Designers", description: "A local room for thoughtful design walks and critiques." } })).community.id;
  assert.equal((await bob.ok(`/api/communities/${communityId}/join`, { method: "POST", body: {} })).joined, true);
  await bob.ok("/api/posts", { method: "POST", body: { communityId, body: "First community sketch session is open." } });
  assert.equal((await alice.ok(`/api/posts?communityId=${communityId}`)).posts.length, 1);

  eventId = (await alice.ok("/api/events", { method: "POST", body: { title: "Saturday design walk", description: "A relaxed walk to sketch and share local design observations.", locationName: "Cape Coast Castle entrance", startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: null } })).event.id;
  const rsvp = await bob.ok(`/api/events/${eventId}/rsvp`, { method: "POST", body: { status: "going" } });
  assert.equal(rsvp.goingCount, 2);
  assert.ok((await bob.ok("/api/notifications")).notifications.length >= 3);

  await bob.ok("/api/blocks", { method: "POST", body: { userId: celiaId } });
  assert.ok(!(await bob.ok("/api/discovery?q=celia")).people.some((person: { id: string }) => person.id === celiaId));
  const report = await bob.ok("/api/reports", { method: "POST", body: { reportedUserId: celiaId, reason: "spam", details: "Repeated unsolicited messages." } });
  assert.equal(report.report.status, "open");
  await bob.ok("/api/blocks", { method: "DELETE", body: { userId: celiaId } });
  await bob.ok("/api/settings", { method: "PATCH", body: { profileVisible: false } });
  assert.ok(!(await alice.ok("/api/discovery?q=bob_test")).people.some((person: { id: string }) => person.id === bobId));
  await bob.ok("/api/settings", { method: "PATCH", body: { profileVisible: true } });

  await alice.ok("/api/auth/logout", { method: "POST", body: {} });
  assert.equal((await alice.request("/api/auth/me")).data.user, null);
  assert.equal((await alice.request("/api/posts")).status, 401);

  if (managed) { await stopServer(); await startServer(); }
  const afterRestart = await bob.ok(`/api/conversations/${conversationId}/messages`);
  assert.equal(afterRestart.messages[0].body, "Meet by the castle at 9?");
  assert.equal((await bob.ok("/api/health")).migration, "001_initial.sql");
  assert.ok(existsSync(path.join(dataDir, "zone.sqlite")));
});
