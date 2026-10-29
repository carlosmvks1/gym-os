import { test, expect } from "@playwright/test";

test("complete calibration flow survives reload", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Start workout" }).click();
  await page.locator("#exerciseSelect").selectOption("Incline Dumbbell Press");

  await page.locator("#weightInput").fill("22.5");
  await page.locator("#repsInput").fill("10");
  await page.locator("#rirInput").fill("4");
  await page.getByRole("button", { name: "Log set" }).click();

  await expect(page.locator("#coachHeadline")).toHaveText("Increase the load.");
  await expect(page.locator("#weightInput")).toHaveValue("25");

  await page.locator("#repsInput").fill("9");
  await page.locator("#rirInput").fill("2");
  await page.getByRole("button", { name: "Log set" }).click();

  await expect(page.locator("#coachHeadline")).toHaveText("Hold the load.");
  await expect(page.locator("#weightInput")).toHaveValue("25");

  await page.locator("#repsInput").fill("8");
  await page.locator("#rirInput").fill("1");
  await page.getByRole("button", { name: "Log set" }).click();

  await expect(page.locator("#coachHeadline")).toHaveText("Working load provisionally calibrated.");
  await expect(page.locator("#sessionMeta")).toContainText("3 sets logged");

  await page.reload();
  await expect(page.locator("#workoutView")).toBeVisible();
  await expect(page.locator("#sessionMeta")).toContainText("3 sets logged");

  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.locator("#homeView")).toBeVisible();
  await expect(page.locator("#historyList")).toContainText("3 sets");
});

test("PWA shell reloads while offline after service worker activation", async ({ page, context }) => {
  await page.goto("/");

  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service workers unavailable");
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
        location.reload();
      });
    }
  });

  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { name: "Gym OS" })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Gym OS" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start workout" })).toBeVisible();

  await context.setOffline(false);
});
