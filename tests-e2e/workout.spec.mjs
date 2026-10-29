import { test, expect } from "@playwright/test";

async function readGymOsState(page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("gym-os", 1);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const tx = db.transaction("state", "readonly");
    const store = tx.objectStore("state");
    const read = (key) =>
      new Promise((resolve, reject) => {
        const r = store.get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });

    const [activeSession, history, meta] = await Promise.all([
      read("activeSession"),
      read("history"),
      read("meta"),
    ]);

    db.close();
    return { activeSession, history, meta };
  });
}

test("complete calibration flow persists in IndexedDB and survives reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.locator("#exerciseSelect").selectOption("Incline Dumbbell Press");

  await page.locator("#weightInput").fill("22.5");
  await page.locator("#repsInput").fill("10");
  await page.locator("#rirInput").fill("4");
  await page.getByRole("button", { name: "Log set" }).click();
  await expect(page.locator("#coachHeadline")).toHaveText("Increase the load.");
  await expect(page.locator("#weightInput")).toHaveValue("25");
  await expect(page.locator("#exerciseStatus")).toContainText("Calibrating");
  await expect(page.locator("#restPanel")).toBeVisible();
  await expect(page.locator("#restTimer")).toHaveText(/\d+:\d{2}|Ready/);

  await page.locator("#repsInput").fill("9");
  await page.locator("#rirInput").fill("2");
  await page.getByRole("button", { name: "Log set" }).click();
  await expect(page.locator("#coachHeadline")).toHaveText("Hold the load.");

  await page.locator("#repsInput").fill("8");
  await page.locator("#rirInput").fill("1");
  await page.getByRole("button", { name: "Log set" }).click();
  await expect(page.locator("#coachHeadline")).toHaveText("Working load provisionally calibrated.");
  await expect(page.locator("#exerciseStatus")).toContainText("Exercise complete");
  await expect(page.locator("#restPanel")).toBeHidden();

  const active = await readGymOsState(page);
  expect(active.activeSession.sets).toHaveLength(3);
  expect(active.meta.schemaVersion).toBe(1);

  await page.reload();
  await expect(page.locator("#workoutView")).toBeVisible();
  await expect(page.locator("#sessionMeta")).toContainText("3 sets logged");

  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.locator("#homeView")).toBeVisible();
  await expect(page.locator("#historyList")).toContainText("3 sets");

  const finished = await readGymOsState(page);
  expect(finished.activeSession).toBeUndefined();
  expect(finished.history).toHaveLength(1);
  expect(finished.history[0].sets).toHaveLength(3);
});

test("legacy localStorage data migrates once into IndexedDB", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "gymos.history.v1",
      JSON.stringify([
        {
          id: "legacy-session",
          name: "Legacy Workout",
          startedAt: "2026-10-20T12:00:00.000Z",
          finishedAt: "2026-10-20T13:00:00.000Z",
          sets: [
            {
              exercise: "Lat Pulldown",
              setNumber: 1,
              weightKg: 50,
              reps: 10,
              rir: 2,
              loggedAt: "2026-10-20T12:10:00.000Z",
            },
          ],
        },
      ])
    );
  });

  await page.goto("/");
  await expect(page.locator("#historyList")).toContainText("Legacy Workout");

  const migrated = await readGymOsState(page);
  expect(migrated.history).toHaveLength(1);
  expect(migrated.history[0].id).toBe("legacy-session");

  const legacyKeys = await page.evaluate(() => ({
    active: localStorage.getItem("gymos.activeSession.v1"),
    history: localStorage.getItem("gymos.history.v1"),
  }));

  expect(legacyKeys.active).toBeNull();
  expect(legacyKeys.history).toBeNull();
});

test("PWA shell and IndexedDB workout state survive offline reload", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start workout" }).click();

  await page.locator("#exerciseSelect").selectOption("Cable Curl");
  await page.locator("#weightInput").fill("10");
  await page.locator("#repsInput").fill("12");
  await page.locator("#rirInput").fill("2");
  await page.getByRole("button", { name: "Log set" }).click();

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
  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole("heading", { name: "Gym OS" })).toBeVisible();
  await expect(page.locator("#workoutView")).toBeVisible();
  await expect(page.locator("#sessionMeta")).toContainText("1 set logged");

  await context.setOffline(false);
});
