import { expect, test } from 'expo-coverage/playwright';

// Deliberately incomplete: nothing here plays a draw, the computer opponent, or the reset button.
// Run the coverage report and those branches show up as the gaps to fill.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText("X's turn");
});

test('players alternate turns', async ({ page }) => {
  await page.getByTestId('cell-0').click();
  await expect(page.getByTestId('status')).toHaveText("O's turn");
  await page.getByTestId('cell-1').click();
  await expect(page.getByTestId('status')).toHaveText("X's turn");
});

test('X wins along the top row', async ({ page }) => {
  for (const cell of [0, 3, 1, 4, 2]) await page.getByTestId(`cell-${cell}`).click();
  await expect(page.getByTestId('status')).toHaveText('X wins!');
  await expect(page.getByTestId('score')).toContainText('X 1');
});
