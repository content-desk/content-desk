import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import type { DesktopApi } from "../../src/shared/contracts";

const httpsRequired = /Base URL must use HTTPS/;

test("launches the hardened desktop shell", async () => {
  const userData = await mkdtemp(join(tmpdir(), "contentdesk-e2e-"));
  const server = createServer((request, response) => {
    if (request.url !== "/v1/chat/completions") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write(
      'data: {"id":"e2e","object":"chat.completion.chunk","created":1,"model":"mock","choices":[{"index":0,"delta":{"content":"Hello "},"finish_reason":null}]}\n\n'
    );
    setTimeout(() => {
      response.end(
        'data: {"id":"e2e","object":"chat.completion.chunk","created":1,"model":"mock","choices":[{"index":0,"delta":{"content":"from mock."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
      );
    }, 50);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("E2E mock server did not bind.");
  }
  let application = await launch(userData);
  try {
    let window = await application.firstWindow();
    await expect(
      window.getByText("ContentDesk", { exact: true }).first()
    ).toBeVisible();
    await expect(window.getByText("ContentDesk Native Chat")).toBeVisible();
    expect(
      await window.evaluate(
        () =>
          typeof (
            globalThis as unknown as {
              contentDesk: { providers: { list: unknown } };
            }
          ).contentDesk.providers.list
      )
    ).toBe("function");
    const saved = await window.evaluate(() =>
      (
        globalThis as unknown as { contentDesk: DesktopApi }
      ).contentDesk.providers.save({
        apiKey: "e2e-secret-value",
        baseUrl: "http://127.0.0.1:9/v1",
        headers: { Authorization: "Bearer e2e-private" },
        kind: "openai-compatible",
        model: "mock",
        name: "E2E Local",
      })
    );
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.data.hasApiKey).toBe(true);
      expect(saved.data.headerNames).toEqual(["Authorization"]);
      expect(JSON.stringify(saved.data)).not.toContain("e2e-secret-value");
      expect(JSON.stringify(saved.data)).not.toContain("e2e-private");
      const cleared = await window.evaluate(
        ({ id }) =>
          (
            globalThis as unknown as { contentDesk: DesktopApi }
          ).contentDesk.providers.save({
            baseUrl: "http://127.0.0.1:9/v1",
            clearHeaders: true,
            headers: {},
            id,
            kind: "openai-compatible",
            model: "mock",
            name: "E2E Local",
          }),
        { id: saved.data.id }
      );
      expect(cleared.ok).toBe(true);
      if (cleared.ok) {
        expect(cleared.data.headerNames).toEqual([]);
        expect(cleared.data.hasApiKey).toBe(true);
      }
    }
    await window.getByRole("button", { name: "设置" }).click();
    await window.getByLabel("名称").fill("Unsafe HTTP");
    await window.getByLabel("Base URL").fill("http://provider.example/v1");
    await window.getByLabel("Model").fill("mock");
    await window.getByRole("button", { exact: true, name: "保存" }).click();
    await expect(window.getByText(httpsRequired)).toBeVisible();

    await window.getByLabel("名称").fill("E2E Mock");
    await window
      .getByLabel("Base URL")
      .fill(`http://127.0.0.1:${address.port}/v1`);
    await window.getByLabel("Model").fill("mock");
    await window.getByLabel("API Key").fill("e2e-chat-secret");
    await window.getByRole("button", { exact: true, name: "保存" }).click();
    await expect(window.getByText("Provider 已保存。")).toBeVisible();

    await window.getByRole("button", { name: "对话" }).click();
    await window.locator("select").first().selectOption({ label: "E2E Mock" });
    await window.getByPlaceholder("输入消息…").fill("hello e2e");
    await window.getByRole("button", { name: "发送" }).click();
    await expect(window.getByText("Hello from mock.")).toBeVisible();

    await window.screenshot({
      fullPage: true,
      path: join(tmpdir(), "contentdesk-desktop-e2e.png"),
    });
    await application.close();
    application = await launch(userData);
    window = await application.firstWindow();
    await window
      .getByRole("button", { exact: true, name: "hello e2e" })
      .click();
    await expect(window.getByText("Hello from mock.")).toBeVisible();
  } finally {
    await application.close();
    server.closeAllConnections();
    server.close();
    await rm(userData, { force: true, recursive: true });
  }
});

function launch(userData: string) {
  return electron.launch({
    args: ["out/main/index.js", `--user-data-dir=${userData}`],
  });
}
