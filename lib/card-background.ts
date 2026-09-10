/** Week 0 starts on the last Saturday in August; the 12-art season set then rotates. */
export function cardBackground(date: string) {
  const year = Number(date.slice(0, 4));
  const augustEnd = new Date(Date.UTC(year, 7, 31));
  const start = augustEnd.getTime() - ((augustEnd.getUTCDay() + 1) % 7) * 86400000;
  const week = Math.floor((Date.parse(`${date}T12:00:00Z`) - start) / 604800000);
  const index = ((week % 12) + 12) % 12;
  return {
    src: `/card-backgrounds/${String(index + 1).padStart(2, '0')}.png`,
    accent: ['#b9ff42', '#ffac55', '#5ce9ff', '#e1adff', '#ff8ddb', '#ffe08a',
      '#ff81e1', '#abecff', '#f6e254', '#b7f95a', '#ffb585', '#ff8f96'][index],
  };
}
