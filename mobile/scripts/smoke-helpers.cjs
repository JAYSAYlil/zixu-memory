async function completeWelcome(page) {
  const start = page.getByRole('button', { name: '开始记录', exact: true });
  await start.waitFor({ state: 'visible' });
  await start.click();
  await start.waitFor({ state: 'detached' });
}

module.exports = { completeWelcome };
