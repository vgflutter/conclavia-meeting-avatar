import { expect, type Page } from "@playwright/test";

export async function choosePodcastStyle(page: Page, theme: string) {
  const option = page.getByTestId(`podcast-style-option-${theme}`);
  if (!await option.isVisible()) await page.getByTestId("podcast-style-chooser").click();
  await option.focus();
  await option.press("Space");
  await expect(option).toBeChecked();
  await expect(page.getByTestId("podcast-style-chooser")).toHaveAttribute("data-style", theme);
}
